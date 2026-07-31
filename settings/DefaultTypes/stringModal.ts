import {
    ActionRowBuilder,
    ButtonBuilder,
    EmbedBuilder,
    ButtonStyle,
    ButtonInteraction,
    ModalBuilder,
    LabelBuilder,
    TextInputBuilder,
    TextInputStyle,
    ModalSubmitInteraction,
    MessageFlags
} from "discord.js";
import {InteractionView} from "../../util/InteractionView";
import {BaseSettingStructure, Setting} from "../Setting";
import {FuckDiscordJSReallyFuckThem} from "../../types";




type StringSettingStructure = BaseSettingStructure & {
    filter?: {
        fn: (value: string) => boolean;
        error: string;
        footer?: string;
    }
}

export class StringModalSettingFile implements Setting<string> {
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
            view.on('abc', async(i: ModalSubmitInteraction) => {
                const value = i.fields.getTextInputValue("configText")
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
                const newValueText = (value?.length ?? 0) > 1000 ? `Texto não possível de visualizar` : value ?? 'Não definido'
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
                await i.reply({
                    content: "Atualizado",
                    flags: MessageFlags.Ephemeral
                })
                await view.update({
                    embeds: [embed2],
                    components: []
                })
                view.destroy()
                view = undefined as any // Destroying view to prevent memory leaks
                resolve(value)
            })
            view.on('set', async (i: FuckDiscordJSReallyFuckThem<ButtonInteraction>) => {
                //await i.deferUpdate()
                const modal = new ModalBuilder()
                    .setCustomId("abc")
                    .setTitle(`Editando ${this.name}`)
                    .setLabelComponents(new LabelBuilder()
                        .setLabel(this.name)
                        .setDescription(this.description.slice(0,90))
                        .setTextInputComponent(
                            new TextInputBuilder()
                                .setCustomId("configText")
                                .setStyle(TextInputStyle.Paragraph)
                                .setRequired(true)
                                .setMinLength(1)
                        )
                    )
                await view.showModal(i, modal)
            })
        })
    }
    clone(): Setting<string> {
        return new StringModalSettingFile(this.structure, this.value)
    }
}