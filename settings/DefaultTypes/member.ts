import {
    ActionRowBuilder,
    EmbedBuilder, Guild, GuildMember,
    UserSelectMenuBuilder, UserSelectMenuInteraction
} from "discord.js";
import {InteractionView} from "../../util/InteractionView";
import {Setting} from "../Setting";
import {ExtendedClient} from "../../types";

type RoleSettingStructure = {
    name: string;
    description: string;
    complex?: boolean;
    permission?: bigint;
    max?: number;
    min?: number;
    placeholder?: string;
    embedDescription?: string;
    id: string;
    color?: string;
}

export class MemberSettingFile implements Setting<GuildMember> {
    public type = 'member';
    public complex = true;
    public name: string;
    public description: string;
    public permission?: bigint;
    public structure: RoleSettingStructure;
    public value?: GuildMember;
    public readonly max?: number;
    public readonly min?: number;
    public readonly placeholder?: string;
    public readonly descriptionMetadata?: string;
    public readonly id: string;

    constructor(setting: RoleSettingStructure, value?: GuildMember) {
        this.name = setting.name;
        this.description = setting.description;
        this.permission = setting.permission;
        this.structure = setting;
        this.max = setting.max;
        this.min = setting.min;
        this.placeholder = setting.placeholder;
        this.descriptionMetadata = setting.embedDescription;
        this.id = setting.id;


        this.value = value;
    }

    run(view: InteractionView): Promise<GuildMember> {
        return new Promise(async (resolve, reject) => {
            const roleSelectMenu = new UserSelectMenuBuilder()
                .setMaxValues(this.max || 1)
                .setMinValues(this.min || 1)
                .setPlaceholder(this.placeholder || 'Selecione uma pessoa')
                .setCustomId('select')
            const row = new ActionRowBuilder<UserSelectMenuBuilder>()
                .setComponents([roleSelectMenu])
            const embed = new EmbedBuilder()
                .setTitle(`Configurar ${this.name}`)
                .setDescription(this.description || 'Selecione uma pessoa')
                .setColor(this.structure.color as `#${string}` ?? `#ffffff`)
            await view.update({
                embeds: [embed],
                components: [row],
            })
            view.on('select', async (interaction: UserSelectMenuInteraction) => {
                await interaction.deferUpdate()
                if (interaction.values.length > 1) embed.setDescription(`Pessoas selecionadas: ${interaction.users.map(user => user.username).join(', ')}`)
                else embed.setDescription(`Pessoa selecionada: ${interaction.users.first()?.username}`)
                await view.update({
                    embeds: [embed],
                    components: []
                })
                resolve(interaction.members.first() as GuildMember)
            })
            view.once('end', (reason) => {
                if (reason !== 'time') return
                view.update({
                    embeds: [],
                    components: [],
                    content: 'Tempo esgotado'
                })
                reject()
            })
        })
    }

    parse(config: string, client: ExtendedClient, data: any, guild: Guild) {
        return new Promise<GuildMember>(async (resolve, reject) => {
            const id = config
            const member = guild.members.cache.get(id) ?? await guild.members.fetch(id).catch(() => {
            })
            if (!member) return reject('Membro não encontrado')
            resolve(member)
        })
    }
    parseToField(value: GuildMember) {
        return `Nome: ${value.user.username}\nMenção: ${value}\nID: ${value.id}`
    }
    parseToDatabase(value: GuildMember) {
        return value.id
    }
    clone() {
        return new MemberSettingFile(this.structure, this.value)
    }
}