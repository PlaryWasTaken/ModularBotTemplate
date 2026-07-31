import Guild from "../classes/structs/Guild";
import User from "../classes/structs/User";
import {GuildTextBasedChannel} from "discord.js";


export function botCreatorCondition(guild: Guild, user: User) {
    return user.member.id === '177840117057191937';
}

export const VoidChannel = {
    id: '0',
    name: 'null-channel',
    send: async () => {
        console.warn('Attempted to send to a null channel');
        return null;
    },
    permissionOverwrites: {
        edit: async () => null,
    },
    isTextBased: () => true,
} as unknown as GuildTextBasedChannel;