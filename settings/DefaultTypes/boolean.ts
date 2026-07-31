import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    EmbedBuilder
} from "discord.js";
import {InteractionView} from "../../util/InteractionView";
import {BaseSettingStructure, Setting} from "../Setting";



export class BooleanSettingFile implements Setting<boolean> {
    public type = 'boolean';
    public complex = false;
    public name: string;
    public description: string;
    public permission?: bigint;
    public structure: BaseSettingStructure;
    public value?: boolean;
    public id: string;
    constructor(setting: BaseSettingStructure, value?: boolean) {
        this.name = setting.name;
        this.description = setting.description;
        this.permission = setting.permission;
        this.structure = setting;
        this.value = value;
        this.id = setting.id;
    }

    public run(view: InteractionView): Promise<boolean> {
        return new Promise(async (resolve) => {
            const value = !!(this.value)
            const embed = new EmbedBuilder()
                .setTitle(`Configurar ${this.name}`)
                .setFields([
                    {
                        name: 'Descrição',
                        value: `${this.description}`,
                    },
                    {
                        name: 'Valor atual',
                        value: `${value ? 'Ativado' : 'Desativado'}`,
                    }
                ])
                .setColor(this.structure.color as `#${string}` ?? `#ffffff`)
            const buttons = new ActionRowBuilder<ButtonBuilder>()
                .setComponents([
                    new ButtonBuilder()
                        .setCustomId('activate')
                        .setLabel('Ativar')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(value),
                    new ButtonBuilder()
                        .setCustomId('deactivate')
                        .setLabel('Desativar')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(!value)
                ])
            await view.update({
                embeds: [embed],
                components: [buttons]
            })
            view.on('any', async (i: ButtonInteraction) => {
                await i.deferUpdate()
                const newValue = !value
                const embed = new EmbedBuilder()
                    .setTitle(`Configurar ${this.name}`)
                    .setFields([
                        {
                            name: 'Descrição',
                            value: `${this.description}`,
                        },
                        {
                            name: 'Valor atual',
                            value: `${newValue ? 'Ativado' : 'Desativado'}`,
                        }
                    ])
                    .setColor(`#ffffff`)
                await view.update({
                    embeds: [embed],
                    components: []
                })
                view.destroy()
                resolve(newValue)
            })
            view.on('end', async (reason: string) => {
                if (reason !== 'time') return
                const embed = new EmbedBuilder()
                    .setTitle(`Configurar ${this.name}`)
                    .setDescription('Tempo esgotado')
                    .setColor(`#ffffff`)
                await view.update({
                    embeds: [embed],
                    components: []
                })
                resolve(value)
            })
        })
    }
    clone(): Setting<boolean> {
        return new BooleanSettingFile(this.structure, this.value)
    }
}