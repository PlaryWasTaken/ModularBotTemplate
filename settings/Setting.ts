import {InteractionView} from "../util/InteractionView";
import {Awaitable} from "@discordjs/util";
import Guild from "../classes/structs/Guild";
import {Guild as DiscordGuild, GuildMember} from "discord.js";
import {ExtendedClient} from "../types";
import User from "../classes/structs/User";
import {BooleanSettingFile} from "./DefaultTypes/boolean";



export function defaultSaveMethod(client: ExtendedClient, entity: Guild | User, setting: Setting<unknown>) {
    const result = setting.value
    return client.settingsHandler.setSetting(entity, setting.id, setting.parseToDatabase ? setting.parseToDatabase(result) : result);
}
/** Modifies the condition for a setting to be modifiable to depend on a boolean setting being set to true */
export function createDependencies<T>(dependency: BooleanSettingFile, settings: Setting<T>[]) {
    for (const setting of settings) {
        if (!setting.condition) setting.condition = async (guild: Guild) => !!guild.settings.get(dependency.id)?.value;
        else {
            const oldCondition = setting.condition;
            setting.condition = async (guild: Guild, user: User) => {
                return (await oldCondition(guild, user)) && !!guild.settings.get(dependency.id)?.value;
            }
        }
        // TODO: Implement further hooks to nullify currently set value if the dependency is set to false
    }
}

export type SettingValue = string | number | boolean | object | undefined;

export type BaseSettingStructure = {
    name: string;
    description: string;
    permission?: bigint;
    id: string;
    color?: string;
}

export interface Setting<T> {
    /*
     * User Defined Settings
     */

    /*
     * The name of the setting
     */
    name: string;
    /*
     * The description of the setting
     */
    description: string;
    /*
     * Permission needed to modify the setting
     */
    permission?: bigint;

    value?: T;

    id: string;


    /*
     * Type Defined Settings
     */

    /*
     * The type of the setting
     */
    type: string;
    /*
     * Whether the setting needs to be parsed in a specific way, using the parse function, or if it can be parsed normally
     */
    complex?: boolean;
    /*
     * Run the type and return setting value
     * Shouldn't be overridden
     */
    run: (view: InteractionView) => Awaitable<T>;
    /*
     * Parse a value to a string to be used in an array type field
     * Can be overridden
     */
    parseToField?: (value: T) => string;
    /*
     * Parse a value to a string to be saved in the database
     * Can be overridden
     */
    save?: (guild: Guild, value: T, user?: User) => Awaitable<boolean>;
    /*
     * Load a value from the database to be used in instantiating the setting
     * Can be overridden
     */
    load?: (guild: DiscordGuild, guildData: any, user?: GuildMember) => Awaitable<T>;
    /*
     * Parse a value from the database to be used in instantiating the setting
     * Can be overridden
     */
    parse?: (config: any, client: ExtendedClient, guildData: any, guild: DiscordGuild, user?: GuildMember) => Awaitable<T>;

    parseToDatabase?: (value: T) => unknown;

    clone: () => Setting<T>;

    condition?: (guild: Guild, user: User) => Awaitable<boolean>;
}