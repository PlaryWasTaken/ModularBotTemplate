import {
    ActionRowBuilder,
    EmbedBuilder,
    Guild,
    Role,
    RoleSelectMenuBuilder,
    RoleSelectMenuInteraction
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

export class RoleSettingFile implements Setting<Role> {
    public type = 'role';
    public complex = true;
    public name: string;
    public description: string;
    public permission?: bigint;
    public structure: RoleSettingStructure;
    public value?: Role;
    public readonly max?: number;
    public readonly min?: number;
    public readonly placeholder?: string;
    public readonly descriptionMetadata?: string;
    public readonly id: string;

    constructor(setting: RoleSettingStructure, value?: Role) {
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

    run(view: InteractionView): Promise<Role> {
        return new Promise(async (resolve, reject) => {
            const roleSelectMenu = new RoleSelectMenuBuilder()
                .setMaxValues(this.max || 1)
                .setMinValues(this.min || 1)
                .setPlaceholder(this.placeholder || 'Selecione um canal')
                .setCustomId('select')
            const row = new ActionRowBuilder<RoleSelectMenuBuilder>()
                .setComponents([roleSelectMenu])
            const embed = new EmbedBuilder()
                .setTitle(`Configurar ${this.name}`)
                .setDescription(this.description || 'Selecione um cargo')
                .setColor(this.structure.color as `#${string}` ?? `#ffffff`)
            await view.update({
                embeds: [embed],
                components: [row],
            })
            view.on('select', async (interaction: RoleSelectMenuInteraction) => {
                await interaction.deferUpdate()
                embed.setDescription(`Cargo selecionado: <@&${interaction.values[0]}>`)
                await view.update({
                    embeds: [embed],
                    components: []
                })
                resolve(interaction.roles.first() as Role)
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
        return new Promise<Role>(async (resolve) => {
            const id = config
            resolve((guild.roles.cache.get(id) ?? await guild.roles.fetch(id).catch(() => {
                return undefined
            })) as Role )
        })
    }
    parseToField(value: Role) {
        return `Nome: ${value.name}\nMenção: <@&${value.id}>`
    }
    parseToDatabase(value: Role) {
        return value.id
    }
    clone() {
        return new RoleSettingFile(this.structure, this.value)
    }
}