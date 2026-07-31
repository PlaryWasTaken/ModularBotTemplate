import {
    ActionRowBuilder,
    ButtonBuilder,
    EmbedBuilder,
    ButtonStyle,
    ButtonInteraction
} from "discord.js";
import {InteractionView} from "../../util/InteractionView";
import {BaseSettingStructure, Setting} from "../Setting";
import {FuckDiscordJSReallyFuckThem} from "../../types";

export class NumberSettingFile implements Setting<number> {
    public type = 'number';
    public complex = false;
    public name: string;
    public description: string;
    public permission?: bigint;
    public structure: BaseSettingStructure;
    public value?: number;
    public id: string;
    constructor(setting: BaseSettingStructure, value?: number) {
        this.name = setting.name;
        this.description = setting.description;
        this.permission = setting.permission;
        this.structure = setting;
        this.value = value;
        this.id = setting.id;
    }

    public run(view: InteractionView): Promise<number> {
        return new Promise(async (resolve, reject) => {
            const embed = new EmbedBuilder()
                .setTitle(`Configurar ${this.name}`)
                .setFields([
                    {
                        name: 'Descrição',
                        value: `${this.description}`,
                    },
                    {
                        name: 'Valor numérico atual',
                        value: `${this.value ?? 'Não definido'}`,
                    }
                ])
                .setColor(`#ffffff`)
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
            view.once('set', async (i: FuckDiscordJSReallyFuckThem<ButtonInteraction>) => {
                await i.deferUpdate()
                const embed = new EmbedBuilder()
                    .setTitle(`Configurar ${this.name}`)
                    .setFields([
                        {
                            name: 'Descrição',
                            value: `${this.description}`,
                        },
                        {
                            name: 'Valor numérico atual',
                            value: `${this.value ?? 'Não definido'}`,
                        }
                    ])
                    .setColor(this.structure.color as `#${string}` ?? `#ffffff`)
                    .setFooter({text: 'Você tem 30 segundos para mandar o novo valor numérico'})
                await view.update({
                    embeds: [embed],
                    components: []
                })
                const value = await i.channel?.awaitMessages({
                    filter: m => m.author.id === view.interaction.user.id,
                    max: 1,
                    time: 30000
                }).then(collected => collected.first()?.content).catch(() => undefined)
                if (!value) {
                    const embed = new EmbedBuilder()
                        .setTitle(`Configurar ${this.name}`)
                        .setFields([
                            {
                                name: 'Descrição',
                                value: `${this.description}`,
                            },
                            {
                                name: 'Valor numérico atual',
                                value: `${this.value ?? 'Não definido'}`,
                            }
                        ])
                        .setColor(`#ffffff`)
                        .setFooter({text: 'Você não enviou um valor a tempo'})
                    await view.update({
                        embeds: [embed],
                        components: []
                    })
                    return reject('Não enviou um valor a tempo')
                }
                const number = parseInt(value ?? '')
                if (isNaN(number)) {
                    const embed = new EmbedBuilder()
                        .setTitle(`Configurar ${this.name}`)
                        .setFields([
                            {
                                name: 'Descrição',
                                value: `${this.description}`,
                            },
                            {
                                name: 'Valor numérico atual',
                                value: `${this.value ?? 'Não definido'}`,
                            }
                        ])
                        .setColor(`#ffffff`)
                        .setFooter({text: 'Você não enviou um valor numérico'})
                    await view.update({
                        embeds: [embed],
                        components: [buttons]
                    })
                    return
                }
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
                            value: `${this.value ?? 'Não definido'}`,
                            inline: true
                        },
                        {
                            name: 'Novo valor',
                            value: `${value ?? 'Não definido'}`,
                            inline: true
                        }
                    ])
                    .setColor(`#ffffff`)
                await view.update({
                    embeds: [embed2],
                    components: []
                })
                view.destroy()
                resolve(number)
            })
        })
    }
    clone(): Setting<number> {
        return new NumberSettingFile(this.structure, this.value)
    }

}