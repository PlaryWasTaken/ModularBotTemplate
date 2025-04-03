import {
    ActionRowBuilder,
    ChannelSelectMenuBuilder,
    ChannelSelectMenuInteraction,
    ChannelType,
    DMChannel,
    EmbedBuilder, Guild as DiscordGuild, GuildBasedChannel,
    PartialDMChannel, User as DiscordUser
} from "discord.js";
import {ExtendedClient} from "../../types";
import {InteractionView} from "../../utils/InteractionView";
import {Setting} from "../Setting";

type ChannelSettingStructure = {
    name: string;
    description: string;
    permission?: bigint;
    max?: number;
    min?: number;
    placeholder?: string;
    embedDescription?: string;
    channelTypes?: ChannelType[];
    id: string;
    color?: string;
}

export class ChannelSettingFile implements Setting<GuildBasedChannel> {
    public type = 'channel';
    public complex = true;
    public name: string;
    public description: string;
    public permission?: bigint;
    public structure: ChannelSettingStructure;
    public value?: GuildBasedChannel;
    public readonly max?: number;
    public readonly min?: number;
    public readonly placeholder?: string;
    public readonly descriptionMetadata?: string;
    public readonly channelTypes?: ChannelType[];
    public readonly id: string;
    constructor(setting: ChannelSettingStructure, value?: GuildBasedChannel) {
        this.name = setting.name;
        this.description = setting.description;
        this.permission = setting.permission;
        this.structure = setting;
        this.max = setting.max;
        this.min = setting.min;
        this.placeholder = setting.placeholder;
        this.descriptionMetadata = setting.embedDescription;
        this.channelTypes = setting.channelTypes;
        this.id = setting.id;


        this.value = value;
    }
    public run(view: InteractionView): Promise<GuildBasedChannel> {
        return new Promise(async (resolve) => {
            const channelSelectMenu = new ChannelSelectMenuBuilder()
                .setMaxValues(this.max || 1)
                .setMinValues(this.min || 1)
                .setPlaceholder(this.placeholder || 'Selecione um canal')
                .setCustomId('select')
                .setChannelTypes(this.channelTypes ? this.channelTypes : [ChannelType.GuildText])
            const row = new ActionRowBuilder<ChannelSelectMenuBuilder>()
                .setComponents([channelSelectMenu])
            const embed = new EmbedBuilder()
                .setTitle(`Configurar ${this.name}`)
                .setDescription(this.descriptionMetadata || 'Selecione um canal' + (this.value ? `\nChat atual: ${this.value.toString()}` : '') )
                .setColor(this.structure.color as `#${string}` ?? `#ffffff`)
            await view.update({
                embeds: [embed],
                components: [row],
            })
            view.on('select', async (interaction: ChannelSelectMenuInteraction) => {
                await interaction.deferUpdate()
                embed.setDescription(`Canal selecionado: <#${interaction.values[0]}>`)
                await view.update({
                    embeds: [embed],
                    components: []
                })
                view.destroy()
                resolve(interaction.channels.first() as GuildBasedChannel)
            })
            view.once('end', (reason) => {
                if (reason !== 'time') return
                view.update({
                    embeds: [],
                    components: [],
                    content: 'Tempo esgotado'
                })
                // @ts-ignore
                resolve(undefined)
            })
        })
    }
    public parseToDatabase(value: GuildBasedChannel) {
        return value.id
    }
    public parse(config: string, client: ExtendedClient, guildData: any, discordGuildOrUser: DiscordGuild | DiscordUser): Promise<GuildBasedChannel> {
        return new Promise(async (resolve, reject) => {
            if (discordGuildOrUser instanceof DiscordUser) return reject('Host is not a guild')
            await discordGuildOrUser.channels.fetch(config).then(channel => {
                resolve(channel as GuildBasedChannel)
            }).catch(() => {
                //@ts-ignore
                resolve(undefined)
            })
        })
    }
    public parseToField(value: Exclude<GuildBasedChannel, DMChannel | PartialDMChannel>) {
        return `Nome: ${value.name}\nID: ${value.id}`
    }
    clone(): Setting<GuildBasedChannel> {
        return new ChannelSettingFile(this.structure, this.value)
    }
}