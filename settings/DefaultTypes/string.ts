import {
    ActionRowBuilder,
    ButtonBuilder,
    EmbedBuilder,
    ButtonStyle,
    ButtonInteraction
} from "discord.js";
import {InteractionView} from "../../utils/InteractionView";
import {BaseSettingStructure, Setting} from "../Setting";
import {FuckDiscordJSReallyFuckThem} from "../../types";




type StringSettingStructure = BaseSettingStructure & {
    filter?: {
        fn: (value: string) => boolean;
        error: string;
        footer?: string;
    }
}

export class StringSettingFile implements Setting<string> {
    public type = 'string';
    public complex = false;
    public name: string;
    public description: string;
    public permission?: bigint;
    public structure: StringSettingStructure;
    public value?: string;
    public id: string;
    public filter?: {
        fn: (value: string) => boolean;
        error: string;
        footer?: string;
    }
    constructor(setting: StringSettingStructure, value?: string) {
        this.name = setting.name;
        this.description = setting.description;
        this.permission = setting.permission;
        this.structure = setting;
        this.value = value;
        this.id = setting.id;

        this.filter = setting.filter
    }

    public run(view: InteractionView): Promise<string> {
        return new Promise(async (resolve) => {
            const valueText = (this.value?.length ?? 0) > 1000 ? `Texto não possivel de visualizar` : this.value ?? 'Não definido'
            const embed = new EmbedBuilder()
                .setTitle(`Configurar ${this.name}`)
                .setFields([
                    {
                        name: 'Descrição',
                        value: `${this.description}`,
                    },
                    {
                        name: 'Valor atual',
                        value: valueText,
                    }
                ])
                .setColor(this.structure.color as `#${string}` ?? `#ffffff`)
                .setFooter(this.filter?.footer ? {text: this.filter.footer ?? ''} : null)
            const buttons = new ActionRowBuilder<ButtonBuilder>()
                .setComponents([
                    new ButtonBuilder()
                        .setCustomId('set')
                        .setLabel('Definir')
                        .setStyle(ButtonStyle.Primary)
                ])
            await view.update({
                embeds: [embed],
                components: [buttons]
            })
            view.on('set', async (i: FuckDiscordJSReallyFuckThem<ButtonInteraction>) => {
                await i.deferUpdate()
                const embed = new EmbedBuilder()
                    .setTitle(`Configurar ${this.name}`)
                    .setFields([
                        {
                            name: 'Descrição',
                            value: `${this.description}`,
                        },
                        {
                            name: 'Valor atual',
                            value: valueText,
                        }
                    ])
                    .setColor(`#ffffff`)
                    .setFooter({text: 'Você tem 30 segundos para mandar o novo valor'})
                await view.update({
                    embeds: [embed],
                    components: []
                })
                const value = await i.channel?.awaitMessages({
                    filter: m => m.author.id === view.interaction.user.id,
                    max: 1,
                    time: 30000
                }).then(async collected => {
                    const msg = collected.first()
                    if (!msg) return undefined
                    await msg.delete()
                    return msg.content
                }).catch(() => undefined)
                if (!value) {
                    const embed = new EmbedBuilder()
                        .setTitle(`Configurar ${this.name}`)
                        .setFields([
                            {
                                name: 'Descrição',
                                value: `${this.description}`,
                            },
                            {
                                name: 'Valor atual',
                                value: valueText,
                            }
                        ])
                        .setColor(`#ffffff`)
                        .setFooter({text: 'Você não enviou um valor a tempo'})
                    await view.update({
                        embeds: [embed],
                        components: []
                    })
                    return
                }
                if (this.filter && !this.filter.fn(value)) {
                    const embed = new EmbedBuilder()
                        .setTitle(`Configurar ${this.name}`)
                        .setFields([
                            {
                                name: 'Descrição',
                                value: `${this.description}`,
                            },
                            {
                                name: 'Valor atual',
                                value: valueText,
                            }
                        ])
                        .setColor(`#ffffff`)
                        .setFooter({text: this.filter.error})
                    await view.update({
                        embeds: [embed],
                        components: [buttons]
                    })
                    return
                }
                const newValueText = (value?.length ?? 0) > 1000 ? `Texto não possivel de visualizar` : value ?? 'Não definido'
                const embed2 = new EmbedBuilder()
                    .setTitle(`Configurar ${this.name}`)
                    .setFields([
                        {
                            name: 'Descrição',
                            value: `${this.description}`,
                            inline: false
                        },
                        {
                            name: 'Valor anterior',
                            value: valueText,
                            inline: true
                        },
                        {
                            name: 'Novo valor',
                            value: newValueText,
                            inline: true
                        }
                    ])
                    .setColor(`#ffffff`)
                await view.update({
                    embeds: [embed2],
                    components: []
                })
                view.destroy()
                view = undefined as any // Destroying view to prevent memory leaks
                resolve(value)
            })
        })
    }
    clone(): Setting<string> {
        return new StringSettingFile(this.structure, this.value)
    }
}