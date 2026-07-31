import { PermissionResolvable, TextChannel} from "discord.js";
import User from "../classes/structs/User";

export async function permissionComputeProfile(node: string, user: User, channel: TextChannel, basePermission?: PermissionResolvable): Promise<boolean> {
    const res = await user.client.permissionHandler.resolve(node, user.guild.permissionOverrides, user.member, channel)
    if (res.status === "granted") return true
    if (res.status === "denied") return false
    return !!(basePermission && user.member.permissions.has(basePermission));

}
