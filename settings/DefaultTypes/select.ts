import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuInteraction
} from "discord.js";
import {InteractionView} from "../../util/InteractionView";
import {BaseSettingStructure, Setting} from "../Setting";

type SelectSettingStructure = BaseSettingStructure & {
    options: string[]
    max?: number
    min?: number
    style?: "StringSelectMenu" | "Button"
    id: string
}
function createLogger(view: InteractionView) {
    return view.client.logger.child({
        service: `SelectSetting`,
        hexColor: '#ddffda'
    })
}

function chunkArr<T>(arr: T[], size: number): T[][] {
    const chunkedArr: T[][] = [];
    let index = 0;
    while (index < arr.length) {
        chunkedArr.push(arr.slice(index, size + index));
        index += size;
    }
    return chunkedArr;
}

export class SelectSetting implements Setting<string[]> {
    public type = 'select';
    public complex = false;
    public name: string;
    public description: string;
    public permission?: bigint;
    public structure: SelectSettingStructure;
    public value?: string[];
    public options: string[]
    public max: number
    public min: number
    public style: "StringSelectMenu" | "Button" = "StringSelectMenu"
    public id: string;

    constructor(setting: SelectSettingStructure, value?: string[]) {
        this.name = setting.name;
        this.description = setting.description;
        this.permission = setting.permission;
        this.structure = setting;
        this.value = value;

        this.options = setting.options
        this.max = setting.max ?? 1
        this.min = setting.min ?? 1
        this.style = setting.style ?? "StringSelectMenu"
        this.id = setting.id
    }

    public run(view: InteractionView): Promise<string[]> {
        return new Promise(async (resolve) => {
            if (this.style === "StringSelectMenu") {
                const embed = new EmbedBuilder()
                    .setTitle(`Configurar ${this.name}`)
                    .setFields([
                        {
                            name: 'Descrição',
                            value: `${this.description}`,
                        },
                        {
                            name: 'Valor atual',
                            value: `${this.value?.join(', ') ?? 'Não definido'}`,
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
                view.on('set', async (i: ButtonInteraction) => {
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
                                value: `${this.value?.join(', ') ?? 'Não definido'}`,
                            }
                        ])
                        .setColor(`#ffffff`)
                    if (this.options.length > 25) {
                        createLogger(view).warning(`SelectSetting ${this.name} has more than 25 options, this is not supported by discord.js`)
                        this.options = this.options.slice(0, 24)
                    }
                    const selectMenu = new StringSelectMenuBuilder()
                        .setMaxValues(this.max)
                        .setMinValues(this.min)
                        .setPlaceholder('Selecione um valor')
                        .setCustomId('select')
                        .addOptions(this.options.map(option => {
                            return {
                                label: option,
                                value: option
                            }
                        }))
                    const row = new ActionRowBuilder<StringSelectMenuBuilder>()
                        .setComponents([selectMenu])
                    await view.update({
                        embeds: [embed],
                        components: [row]
                    })
                    view.on('select', async (i: StringSelectMenuInteraction) => {
                        await i.deferUpdate()
                        const value = i.values
                        this.value = value
                        const embed = new EmbedBuilder()
                            .setTitle(`Configurar ${this.name}`)
                            .setFields([
                                {
                                    name: 'Descrição',
                                    value: `${this.description}`,
                                },
                                {
                                    name: 'Valor atual',
                                    value: `${this.value?.join(', ') ?? 'Não definido'}`,
                                }
                            ])
                            .setColor(`#ffffff`)
                        await view.update({
                            embeds: [embed],
                            components: []
                        })
                        view.destroy()
                        resolve(this.value)
                    })

                })
            } else if (this.style === "Button") {
                if (this.options.length > 20) {
                    createLogger(view).warning(`SelectSetting ${this.name} has more than 20 options and is in Button mode, this is not supported by discord.js`)
                    this.options = this.options.slice(0, 19)
                }
                if (this.max > 1) {
                    createLogger(view).warning(`SelectSetting ${this.name} has more than 1 max and is in Button mode, this is not supported and will be set to 1`)
                    this.max = 1
                }
                if (this.min > 1) {
                    createLogger(view).warning(`SelectSetting ${this.name} has more than 1 min and is in Button mode, this is not supported and will be set to 1`)
                    this.min = 1
                }
                const embed = new EmbedBuilder()
                    .setTitle(`Configurar ${this.name}`)
                    .setFields([
                        {
                            name: 'Descrição',
                            value: `${this.description}`,
                        },
                        {
                            name: 'Valor atual',
                            value: `${this.value?.join(', ') ?? 'Não definido'}`,
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
                view.on('set', async (i: ButtonInteraction) => {
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
                                value: `${this.value?.join(', ') ?? 'Não definido'}`,
                            }
                        ])
                        .setColor(`#ffffff`)
                    const chunkedOptions = chunkArr(this.options, 5)
                    const rows = chunkedOptions.map((value) => {
                        return new ActionRowBuilder<ButtonBuilder>().setComponents(value.map(option => {
                            return new ButtonBuilder()
                                .setCustomId(option)
                                .setLabel(option)
                                .setStyle(ButtonStyle.Primary)
                        }))
                    })
                    await view.update({
                        embeds: [embed],
                        components: rows
                    })
                    view.once('any', async (i: ButtonInteraction) => {
                        await i.deferUpdate()
                        const value = i.customId.split('-')[0]
                        this.value = [value]
                        const embed = new EmbedBuilder()
                            .setTitle(`Configurar ${this.name}`)
                            .setFields([
                                {
                                    name: 'Descrição',
                                    value: `${this.description}`,
                                },
                                {
                                    name: 'Valor atual',
                                    value: `${this.value?.join(', ') ?? 'Não definido'}`,
                                }
                            ])
                            .setColor(this.structure.color as `#${string}` ?? `#ffffff`)
                        await view.update({
                            embeds: [embed],
                            components: []
                        })
                        view.destroy()
                        resolve(this.value)
                    })
                })
            }
        })
    }
    clone(): Setting<string[]> {
        return new SelectSetting(this.structure, this.value)
    }
}