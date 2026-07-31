import {  PermissionOverrideTree } from "../types";
import { Permissions, isEndNode } from "../classes/structs/Permissions";
import {Logger} from "winston";

// ─── Core Types ─────────────────────────────────────────────────────────────

export type MetaValue = string | number | boolean;

export interface MetaMap {
    [key: string]: MetaValue | undefined;
}

/** Per-resolver config: weight lives here, not in MetaMap */
export interface ResolverConfig {
    weight?: number;
    meta?: MetaMap;
}

/** Authored in YAML — override-centric */
export interface OverrideConfig {
    id: string;        // resolver ID: "Role.123", "Titles.active.yumeko"
    weight?: number;   // explicit weight, overrides resolver default
    allow: string[];   // permission paths
    deny: string[];
    meta?: MetaMap;    // pure data, no reserved keys
}

/** Stored in DB — permission-centric */
export interface PermissionEntry {
    allow: string[];   // resolver IDs
    deny: string[];
}

/** Keyed by resolver ID: "Role.123" → { weight, meta } */
export type ResolverConfigStore = Map<string, ResolverConfig>;

/** All resolver IDs seen in any allow/deny during compilation */
export type ActiveResolverIds = Set<string>;

export type CompileResult = Permissions

// ─── Compiler ────────────────────────────────────────────────────────────────

export function compileOverrides(overrides: OverrideConfig[], logger: Logger): CompileResult {
    const tree = new Permissions(logger, new Map());
    const resolverConfigs: ResolverConfigStore = new Map();
    const activeIds: ActiveResolverIds = new Set();

    for (const override of overrides) {
        // Store resolver-level config keyed by ID
        if (override.weight !== undefined || override.meta) {
            resolverConfigs.set(override.id, {
                weight: override.weight,
                meta: override.meta,
            });
        }

        for (const path of override.allow) {
            activeIds.add(override.id);
            const existing = tree.getEndNode(path, true);
            if (!existing) tree.set(path, { allow: [override.id], deny: [] });
            else if (!existing.allow.includes(override.id)) existing.allow.push(override.id);
        }

        for (const path of override.deny) {
            activeIds.add(override.id);
            const existing = tree.getEndNode(path, true);
            if (!existing) tree.set(path, { allow: [], deny: [override.id] });
            else if (!existing.deny.includes(override.id)) existing.deny.push(override.id);
        }
    }
    tree.resolverConfigs = resolverConfigs
    tree.activeIds = activeIds
    return tree
}

// ─── Decompiler ──────────────────────────────────────────────────────────────

export function decompilePermissions(
    tree: PermissionOverrideTree,
    resolverConfigs: ResolverConfigStore
): OverrideConfig[] {
    const overrides = new Map<string, OverrideConfig>();

    function recurse(node: PermissionOverrideTree, path: string) {
        for (const [branch, value] of node) {
            const fullPath = path ? `${path}.${branch}` : branch;

            if (isEndNode(value)) {
                for (const id of value.allow) {
                    if (!overrides.has(id)) {
                        const config = resolverConfigs.get(id);
                        overrides.set(id, {
                            id,
                            weight: config?.weight,
                            allow: [],
                            deny: [],
                            meta: config?.meta,
                        });
                    }
                    overrides.get(id)!.allow.push(fullPath);
                }

                for (const id of value.deny) {
                    if (!overrides.has(id)) {
                        const config = resolverConfigs.get(id);
                        overrides.set(id, {
                            id,
                            weight: config?.weight,
                            allow: [],
                            deny: [],
                            meta: config?.meta,
                        });
                    }
                    overrides.get(id)!.deny.push(fullPath);
                }
            } else {
                recurse(value, fullPath);
            }
        }
    }

    recurse(tree, "");

    for (const [id, config] of resolverConfigs) {
        if (!overrides.has(id)) {
            overrides.set(id, {
                id,
                weight: config.weight,
                allow: [],
                deny: [],
                meta: config.meta,
            });
        }
    }
    return [...overrides.values()];
}