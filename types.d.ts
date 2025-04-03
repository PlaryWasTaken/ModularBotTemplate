import mongoose, { HydratedDocument, Schema} from "mongoose";
import winston, {Logger} from "winston";
import {
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    Client,
    ClientEvents,
    Collection,
    GuildMember,
    Message,
    Role,
    SlashCommandBuilder,
    VoiceState,
    APIEmbed,
    BaseMessageOptions,
    TextChannel,
    OmitPartialGroupDMChannel, SlashCommandSubcommandsOnlyBuilder, SlashCommandOptionsOnlyBuilder
} from "discord.js";
import ProfileManager from "./classes/managers/UserManager";
import GuildManager from "./classes/managers/GuildManager"
import User from "./classes/structs/User";
import {Awaitable} from "@discordjs/util";
import Guild from "./classes/structs/Guild";
import Command from "./classes/structs/Command";
import SlashCommand from "./classes/structs/SlashCommand";
import SlashManager from "./classes/managers/SlashManager";
import SettingsManager from "./classes/managers/SettingsManager";
import {InteractionView} from "./utils/InteractionView";
import {MessageView} from "./utils/MessageView";
import {Setting} from "./settings/Setting";
import AsyncLock from "async-lock";
import {settingData} from "./index";
import {FlagsManager} from "./classes/managers/FlagsManager";
import {PermissionsManager} from "./classes/managers/PermissionsManager";
import SharedClientsManager from "./classes/managers/SharedClientsManager";

type configFunc = (args: {
    client: ExtendedClient,
    logger: Logger,
    oldConfig: GenericOption,
    newConfig: GenericOption
}) => Promise<true | { err: boolean, reason: string }>;

type EncodableJSON = string | {
    toString(): string;
}

type ConfigOption = SettingStructure

/*
{
    name: string,
    description?: string,
    eventName: string,
    permission?: PermissionResolvable,
    value?: string,
    default?: string,
} | {
    name: string,
    description?: string,
    eventName: string,
    permission?: PermissionResolvable,
    value: EncodableJSON<any>,
    default?: string,
}
 */
class BaseModuleInterfacer {
    [key: string]: any;
}

interface BaseCommandConstructor {
    disabled?: boolean,
    appearsInHelp?: boolean,
}

interface CommandConstructor extends BaseCommandConstructor {
    name: string,
    aliases: Array<string>,
    description: string,
    howToUse: string,
    func: (args: CommandArgs) => void,
    permissions?: bigint[],
}

interface SlashCommandConstructor extends BaseCommandConstructor {
    data: SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder |  SlashCommandBuilder | Omit<SlashCommandBuilder, "addBooleanOption" | "addUserOption" | "addChannelOption" | "addRoleOption" | "addAttachmentOption" | "addMentionableOption" | "addStringOption" | "addIntegerOption" | "addNumberOption"> | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">,
    func: (args: SlashCommandArgs) => void,
    global?: boolean,
    autoCompleteFunc?: (args: SlashCommandAutoCompleteArgs) => void
}

interface SlashCommandArgs {
    client: ExtendedClient,
    logger: Logger,
    interaction: IDoNotCareAboutPartialGroupDMs<ChatInputCommandInteraction>,
    profile: User,
    guild: Guild,
    interfacer: BaseModuleInterfacer
}

interface SlashCommandAutoCompleteArgs {
    client: ExtendedClient,
    logger: Logger,
    interaction: AutocompleteInteraction,
    profile: User,
    guild: Guild,
    interfacer: BaseModuleInterfacer
}
type MiddlewareArgs = {
    client: ExtendedClient,
    logger: Logger,
    profile: User,
    guild: Guild,
    interfacer: BaseModuleInterfacer,
    command: Command | SlashCommand,
}

interface ExtendedClient extends Client {
    logger: Logger;

    globalLock: AsyncLock;

    commands: CommandsMap;

    flags: FlagsManager;

    typesCollection: Collection<string, typeFile>;

    profileHandler: ProfileManager;

    guildHandler: GuildManager;

    slashHandler: SlashManager;

    permissionHandler: PermissionsManager;

    commandMiddleware: ((args: MiddlewareArgs) => Promise<boolean>)[];

    modules: Collection<string, Module>;
    defaultModels: {
        user: mongoose.Model<any>,
        guild: mongoose.Model<any>,
        setting: settingData
    };
    settingsHandler: SettingsManager;
    cachedEvents: Collection<string, Event<any>[]>;

    sharedClients: SharedClientsManager;

    on<K extends keyof ExtendedClientEvents>(event: K, listener: (...args: ExtendedClientEvents[K]) => Awaitable<void>): this;

    on<S extends string | symbol>(
        event: Exclude<S, keyof ExtendedClientEvents>,
        listener: (...args: any[]) => Awaitable<void>,
    ): this;

    once<K extends keyof ExtendedClientEvents>(event: K, listener: (...args: ExtendedClientEvents[K]) => Awaitable<void>): this;

    once<S extends string | symbol>(
        event: Exclude<S, keyof ExtendedClientEvents>,
        listener: (...args: any[]) => Awaitable<void>,
    ): this;

    emit<K extends keyof ExtendedClientEvents>(event: K, ...args: ExtendedClientEvents[K]): boolean;

    emit<S extends string | symbol>(event: Exclude<S, keyof ExtendedClientEvents>, ...args: unknown[]): boolean;

    off<K extends keyof ExtendedClientEvents>(event: K, listener: (...args: ExtendedClientEvents[K]) => Awaitable<void>): this;

    off<S extends string | symbol>(
        event: Exclude<S, keyof ExtendedClientEvents>,
        listener: (...args: any[]) => Awaitable<void>,
    ): this;

    removeAllListeners<K extends keyof ExtendedClientEvents>(event?: K): this;

    removeAllListeners<S extends string | symbol>(event?: Exclude<S, keyof ExtendedClientEvents>): this;

    addMiddleware(func: (args: MiddlewareArgs) => Promise<boolean>): void;
}

interface mongoseSchemaData {
    [key: string]: mongoose.SchemaDefinitionProperty
}

interface Manifest extends RawManifest {
    data: {
        user?: Schema,
        guild?: Schema
    }
}

interface RawManifest {
    name: string,
    description: string,
    version: string,
    color: string,
    schemaDataFile?: string,
    initFile: string,
    eventsFolder: string,
    commandsFolder: string,
    disabled?: boolean,
}

type CommandsMap = {
    slash: Collection<string, SlashCommand>,
    text: Collection<string, Command>
}
export type settingDoc = HydratedDocument<{
    module: string,
    settings: Map<string, any>,
    data: Object<any>
}>
interface Module {
    name: string,
    path: string,
    description: string,
    version: string,
    color: string,
    logger: winston.Logger,
    initFunc: (
        client: ExtendedClient,
        moduleData: settingDoc,
        moduleLogger: Logger) => Promise<BaseModuleInterfacer>,
    data: Manifest,
    commands?: CommandsMap,
    interfacer: BaseModuleInterfacer,
    settings: Setting<unknown>[]
    userSettings: Setting<unknown>[]
}

export interface ExtendedClientEvents extends ClientEvents {
    roleAdded: [
        member: GuildMember,
        role: Role
    ];
    roleRemoved: [
        member: GuildMember,
        role: Role
    ];
    joinedVoiceChannel: [
        state: VoiceState
    ];
    leftVoiceChannel: [
        state: VoiceState
    ];
    movedVoiceChannel: [
        oldState: VoiceState,
        newState: VoiceState
    ];
    newBoosterMember: [
        member: GuildMember
    ];
    tick: [],
    fullyReady: [],
    dbReady: []
}


interface Event<K extends keyof ExtendedClientEvents> {
    readonly event: K,
    readonly func: (client: ExtendedClient, logger: Logger, ...args: ExtendedClientEvents[K]) => void
}

interface DynamicEvent {
    readonly event: string,
    readonly func: (client: ExtendedClient, logger: Logger, ...args: any[]) => void
}


interface CommandArgs {
    client: ExtendedClient,
    logger: Logger,
    message: Message<true>,
    profile: User,
    args: Array<string>,
    guild: Guild,
    interfacer: BaseModuleInterfacer,
    usedName: string
}

type DbSetting = unknown

type MessageViewUpdate = BaseMessageOptions

type AnyView = MessageView | InteractionView

type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U;

type RecursiveMap<T> = Map<string, RecursiveMap<T> | T>
// type PermissionsOverride = Map<string, BaseOverride>
type OverrideNode = {
    allow: string[],
    deny: string[]
}
type PermissionOverrideTree = RecursiveMap<OverrideNode>

type PermissionNode = (client: ExtendedClient, path: string, member: GuildMember, channel: TextChannel) => Awaitable<boolean>

type PartialGroupDMIsANightmare = OmitPartialGroupDMChannel<Message<boolean>>

type IDoNotCareAboutPartialGroupDMs<T> = OmitPartialGroupDMChannel<T>