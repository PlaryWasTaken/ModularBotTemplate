import { ExtendedClient } from "../../types";
import { Logger } from "winston";
import {GuildMember, TextChannel, VoiceChannel} from "discord.js";
import { Permissions, isEndNode } from "../structs/Permissions";
import {
    MetaMap,
    PermissionEntry,
} from "../../util/PermissionCompilation";

// ─── Resolver Types ───────────────────────────────────────────────────────────

export type ResolverFn = (
    args: string[],
    member: GuildMember,
    channel: TextChannel,
    client: ExtendedClient
) => Promise<boolean>;

interface ResolverRegistration {
    fn: ResolverFn;
    defaultWeight: number;
}

// ─── Resolution Types ─────────────────────────────────────────────────────────

interface Match {
    resolverId: string;
    effect: "allow" | "deny";
    weight: number;
    specificity: number; // tree depth at which this entry was matched; wildcard nodes score lower
}

export type ResolutionStatus = "granted" | "denied" | "unknown" | "abstained";

export interface ResolutionResult {
    status: ResolutionStatus;
    meta: MetaMap;
}

/** Per-request cache: avoids re-running resolvers for the same member+channel */
export type SubjectCache = Map<string, string[]>; // "memberId:channelId" → matched resolver IDs

// ─── PermissionsManager ───────────────────────────────────────────────────────

export class PermissionsManager {
    private resolvers = new Map<string, ResolverRegistration>();


    constructor(
        private readonly client: ExtendedClient,
        private readonly logger: Logger,
    ) {
    }

    // ─── Resolver Registry ───────────────────────────────────────────────────

    registerResolver(name: string, fn: ResolverFn, defaultWeight = 0): void {
        this.resolvers.set(name, { fn, defaultWeight });
    }
    public listResolvers(): string[] {
        return Array.from(this.resolvers.keys())
    }

    // ─── Subject Resolution ──────────────────────────────────────────────────

    /**
     * Resolves which active resolver IDs match this member+channel.
     * Results are cached per request via the optional SubjectCache.
     * Pass the same cache instance across multiple resolve() calls in one
     * request to avoid redundant resolver invocations.
     */
    async resolveSubjects(
        perms: Permissions,
        member: GuildMember,
        channel: TextChannel | VoiceChannel,
        cache?: SubjectCache
    ): Promise<string[]> {
        const cacheKey = `${member.id}:${channel.id}`;
        if (cache?.has(cacheKey)) return cache.get(cacheKey)!;
        const results = await Promise.all(
            [...perms.activeIds].map(async (id): Promise<string | null> => {
                const [resolverName, ...args] = id.split(".");
                const resolver = this.resolvers.get(resolverName);
                if (!resolver) {
                    this.logger.warn(`No resolver registered for: ${resolverName}`);
                    return null;
                }
                const matched = await resolver.fn(args, member, channel as TextChannel, this.client);
                return matched ? id : null;
            })
        );

        const matched = results.filter((id): id is string => id !== null);
        cache?.set(cacheKey, matched);
        return matched;
    }

    // ─── Meta Resolution ─────────────────────────────────────────────────────

    /**
     * Merges meta from a set of matched resolver IDs.
     * Higher weight overwrites lower (ascending sort, high weight is last-write).
     */
    resolveMeta(perms: Permissions, matchedIds: string[]): MetaMap {
        const sorted = matchedIds
            .map((id) => ({
                meta: perms.resolverConfigs.get(id)?.meta ?? {},
                weight: this.getEffectiveWeight(perms, id),
            }))
            .sort((a, b) => a.weight - b.weight); // ascending: high weight overwrites

        const merged: MetaMap = {};
        for (const { meta } of sorted) {
            Object.assign(merged, meta);
        }
        return merged;
    }

    /**
     * Returns merged meta for a member across all their matching resolver IDs.
     * Useful for feature flags, cooldowns, and other non-permission attributes.
     */
    async getMemberMeta(
        perms: Permissions,
        member: GuildMember,
        channel: TextChannel,
        cache?: SubjectCache
    ): Promise<MetaMap> {
        const matched = await this.resolveSubjects(perms, member, channel, cache);
        return this.resolveMeta(perms, matched);
    }

    // ─── Permission Resolution ───────────────────────────────────────────────

    /**
     * Resolves a permission path for a member.
     *
     * Status semantics:
     *   "granted"   — a matching allow rule won
     *   "denied"    — a matching deny rule won
     *   "unknown"   — the path does not exist in the tree at all
     *   "abstained" — the path exists but no resolver matched; caller decides default
     */
    async resolve(
        permissionPath: string,
        perms: Permissions,
        member: GuildMember,
        channel: TextChannel | VoiceChannel,
        cache?: SubjectCache
    ): Promise<ResolutionResult> {
        const subjects = await this.resolveSubjects(perms, member, channel, cache);
        const subjectSet = new Set(subjects);

        const matches = this.collectMatches(perms, permissionPath, subjectSet);

        if (matches === null) {
            // Path not found anywhere in the tree including wildcard parents
            return { status: "unknown", meta: {} };
        }

        if (matches.length === 0) {
            return { status: "abstained", meta: {} };
        }

        // Sort: specificity DESC → weight DESC → deny beats allow at equal rank
        matches.sort(
            (a, b) =>
                b.specificity - a.specificity ||
                b.weight - a.weight ||
                (a.effect === "deny" && b.effect === "allow" ? -1 : 1)
        );

        const winner = matches[0];
        const meta = this.resolveMeta(perms, matches.map((m) => m.resolverId));

        return {
            status: winner.effect === "allow" ? "granted" : "denied",
            meta,
        };
    }

    // ─── Tree Traversal ───────────────────────────────────────────────────────

    /**
     * Walks the permission tree for a dotted path, collecting all matching
     * allow/deny entries from both exact nodes and wildcard parents.
     *
     * Returns null if the path is completely unknown (no exact node and no
     * wildcard ancestor). Returns an empty array if the path is known but
     * no subject matched any entry.
     */
    private collectMatches(
        perms: Permissions,
        permissionPath: string,
        subjects: Set<string>
    ): Match[] | null {
        const segments = permissionPath.split(".");
        let current = perms.permissions;
        const matches: Match[] = [];
        let pathFound = false;

        for (let depth = 0; depth < segments.length; depth++) {
            const segment = segments[depth];

            if (!current || isEndNode(current)) break;

            // Collect wildcard matches at this depth (lower specificity)
            const wildcardEntry = current.get("*");
            if (wildcardEntry && isEndNode(wildcardEntry)) {
                pathFound = true;
                this.collectEntryMatches(perms, wildcardEntry, subjects, depth, matches);
            }

            const next = current.get(segment);
            if (!next) break;

            if (isEndNode(next)) {
                // Exact leaf — highest specificity for this depth
                pathFound = true;
                this.collectEntryMatches(perms, next, subjects, depth + 1, matches);
                break;
            }

            current = next;
        }

        return pathFound ? matches : null;
    }

    private collectEntryMatches(
        perms: Permissions,
        entry: PermissionEntry,
        subjects: Set<string>,
        specificity: number,
        out: Match[]
    ): void {
        for (const id of entry.allow) {
            if (subjects.has(id)) {
                out.push({
                    resolverId: id,
                    effect: "allow",
                    weight: this.getEffectiveWeight(perms, id),
                    specificity,
                });
            }
        }
        for (const id of entry.deny) {
            if (subjects.has(id)) {
                out.push({
                    resolverId: id,
                    effect: "deny",
                    weight: this.getEffectiveWeight(perms, id),
                    specificity,
                });
            }
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private getEffectiveWeight(perms: Permissions, resolverId: string): number {
        const configWeight = perms.resolverConfigs.get(resolverId)?.weight;
        if (configWeight !== undefined) return configWeight;
        const resolverName = resolverId.split(".")[0];
        return this.resolvers.get(resolverName)?.defaultWeight ?? 0;
    }
}