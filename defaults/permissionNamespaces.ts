import {ExtendedClient} from "../types";
import {GuildMember, PermissionsBitField, TextChannel} from "discord.js";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

dayjs.extend(duration);

/**
 * Parses a duration string like "30d", "24h", "60m" into milliseconds.
 * Returns null if the format is unrecognized.
 */
function parseDuration(value: string): number | null {
    const match = value.match(/^(\d+)(d|h|m|s)$/)
    if (!match) return null
    const amount = parseInt(match[1])
    const unit = match[2] as 'd' | 'h' | 'm' | 's'
    const unitMap = { d: 'day', h: 'hour', m: 'minute', s: 'second' } as const
    return dayjs.duration(amount, unitMap[unit]).asMilliseconds()
}

/**
 * Evaluates a numeric comparison: gte, lte, gt, lt, eq
 */
function compareNumeric(op: string, actual: number, threshold: number): boolean {
    switch (op) {
        case 'gte': return actual >= threshold
        case 'lte': return actual <= threshold
        case 'gt':  return actual > threshold
        case 'lt':  return actual < threshold
        case 'eq':  return actual === threshold
        default:    return false
    }
}

export async function RolesNamespace(args: string[], member: GuildMember, channel: TextChannel, client: ExtendedClient) {
    const roleId = args.pop()
    if (!roleId) return false
    return member.roles.cache.has(roleId)
}

export async function ChannelsNamespace(args: string[], member: GuildMember, channel: TextChannel, client: ExtendedClient) {
    const channelId = args.pop()
    if (!channelId) return false
    return channel.id === channelId
}

export async function UsersNamespace(args: string[], member: GuildMember, channel: TextChannel, client: ExtendedClient) {
    const userId = args.pop()
    if (!userId) return false
    return member.id === userId
}
export async function PermissionNamespace(args: string[], member: GuildMember, channel: TextChannel, client: ExtendedClient) {
    const flagName = args[0] as keyof typeof PermissionsBitField.Flags
    if (!flagName || !(flagName in PermissionsBitField.Flags)) return false
    return member.permissions.has(PermissionsBitField.Flags[flagName])
}

export async function BoostNamespace(args: string[], member: GuildMember, channel: TextChannel, client: ExtendedClient) {
    if (args[0] === "active") {
        return !!member.premiumSince
    } else if (args[0] === "inactive") {
        return !member.premiumSince
    } else return false
}

// Checks how long the member has been in the server relative to now.
//
// Usage:
//   JoinDate.gte.30d    — member for at least 30 days
//   JoinDate.lte.7d     — member for 7 days or less
//   JoinDate.gt.1h      — joined more than 1 hour ago
//
// Supported operators: gte, lte, gt, lt, eq
// Supported units:     d (days), h (hours), m (minutes), s (seconds)

export async function JoinDateNamespace(args: string[], member: GuildMember, channel: TextChannel, client: ExtendedClient) {
    const [op, durationStr] = args
    if (!op || !durationStr) return false

    if (!member.joinedAt) return false
    const thresholdMs = parseDuration(durationStr)
    if (thresholdMs === null) return false

    const memberAgeMs = Date.now() - member.joinedAt.getTime()
    return compareNumeric(op, memberAgeMs, thresholdMs)
}

// Checks the age of the member's Discord account, derived from their snowflake.
// No API call needed — the creation timestamp is encoded in the user ID.
//
// Usage:
//   AccountAge.gte.30d   — account at least 30 days old
//   AccountAge.lte.7d    — account 7 days old or newer (new account gate)
//
// Supported operators: gte, lte, gt, lt, eq
// Supported units:     d (days), h (hours), m (minutes), s (seconds)

const DISCORD_EPOCH = 1420070400000n
function snowflakeToTimestamp(snowflake: string): number {
    return Number((BigInt(snowflake) >> 22n) + DISCORD_EPOCH)
}

export async function AccountAgeNamespace(args: string[], member: GuildMember, channel: TextChannel, client: ExtendedClient) {
    const [op, durationStr] = args
    if (!op || !durationStr) return false

    const thresholdMs = parseDuration(durationStr)
    if (thresholdMs === null) return false

    const accountCreatedAt = snowflakeToTimestamp(member.user.id)
    const accountAgeMs = Date.now() - accountCreatedAt
    return compareNumeric(op, accountAgeMs, thresholdMs)
}

// Checks the current time against a range (UTC).
//
// Usage:
//   Time.hour.22-06     — between 22:00 and 06:00 UTC (wraps midnight)
//   Time.hour.09-17     — between 09:00 and 17:00 UTC
//   Time.day.1-5        — Monday through Friday (1=Mon, 7=Sun, ISO weekday)
//
// Supported sub-resolvers: hour, day

export async function TimeNamespace(args: string[], member: GuildMember, channel: TextChannel, client: ExtendedClient) {
    const [subtype, range] = args
    if (!subtype || !range) return false

    const [startStr, endStr] = range.split('-')
    if (!startStr || !endStr) return false

    const start = parseInt(startStr)
    const end   = parseInt(endStr)
    const now   = dayjs()

    switch (subtype) {
        case 'hour': {
            const current = now.hour()
            // Handle ranges that wrap midnight (e.g. 22-06)
            if (start > end) return current >= start || current < end
            return current >= start && current < end
        }
        case 'day': {
            // ISO weekday: 1=Monday, 7=Sunday
            const current = new Date().getDay() + 1
            if (start > end) return current >= start || current <= end
            return current >= start && current <= end
        }
        default:
            return false
    }
}