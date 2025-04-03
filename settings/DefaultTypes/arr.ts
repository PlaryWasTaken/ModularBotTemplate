import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder, Guild as DiscordGuild,
    StringSelectMenuBuilder
} from "discord.js";
import {ExtendedClient} from "../../types";
import {InteractionView} from "../../utils/InteractionView";
import {Setting} from "../Setting";

function parseSettingToArrayFields(current: Return[], parseFunction?: (value: Return) => string) {
    const inlined = (current?.length || 0) > 5
    return current.map((value, index) => {
        if (parseFunction) return {
            name: index + 1 + '',
            value: parseFunction(value),
            inline: inlined
        }
        if (typeof value === 'object') {

            const keys = Object.keys(value as object)
            const values = Object.values(value as object)
            return {
                name: index + 1 + '',
                value: values.map((value, index) => {
                    return `${keys[index]}: ${value}`
                }).join('\n'),
                inline: inlined
            }
        }
        return {
            name: index + 1 + '',
            value: value + '',
            inline: inlined
        }
    })
}

type ArraySettingStructure = {
    name: string;
    description: string;
    permission?: bigint;
    id: string;

    child: Setting<any>;
    overrides?: {
        parseToField?: (value: Return) => string;
        embed?: EmbedBuilder; // Overrides default embed, maintains fields
        updateFn?: (value: Return[]) => EmbedBuilder; //Overrides everything
    }
}

type Return = Setting<unknown>["value"]


export class ArraySetting implements Setting<Setting<unknown>["value"][]> {
    public type = 'arr';
    public complex = true;
    public name: string;
    public description: string;
    public permission?: bigint;
    public structure: any;
    public value?: Return[];
    public child: Setting<any>;
    public overrides?: {
        parseToField?: (value: Return) => string;
        embed?: EmbedBuilder; // Overrides default embed, maintains fields
        updateFn?: (value: Return[]) => EmbedBuilder; //Overrides everything
    }
    public id: string;
    constructor(setting: ArraySettingStructure, value?: unknown[]) {
        this.name = setting.name;
        this.description = setting.description;
        this.permission = setting.permission;
        this.structure = setting;
        this.id = setting.id;

        this.child = setting.child;
        this.overrides = setting.overrides

        this.value = value;
    }

    public run(view: InteractionView): Promise<Return[]> {
        return new Promise(async (resolve) => {
            const current = this.value ?? []

            let values = parseSettingToArrayFields(current, this.overrides?.parseToField ?? this.child.parseToField)
            let embed = this.overrides?.updateFn ? this.overrides.updateFn(current) :
                this.overrides?.embed ? this.overrides.embed.setFields(values) :
                    new EmbedBuilder()
                        .setTitle(`Configurar ${this.name}`)
                        .setDescription(this.description)
                        .setFields(values)
                        .setColor(`#ffffff`)
            const menuRow = new ActionRowBuilder<StringSelectMenuBuilder>()
                .setComponents([
                    new StringSelectMenuBuilder()
                        .setCustomId('select')
                        .setPlaceholder('Selecione uma opção')
                        .addOptions(current.map((value, index) => {
                            return {
                                label: index + 1 + '',
                                value: index + ''
                            }
                        }))
                ])
            const controlRow = new ActionRowBuilder<ButtonBuilder>()
                .setComponents([
                    new ButtonBuilder()
                        .setCustomId('add')
                        .setLabel('Adicionar')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('remove')
                        .setLabel('Remover')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('confirm')
                        .setLabel('Confirmar alterações')
                        .setStyle(ButtonStyle.Success)
                ])
            const rowArr: any[] = []
            if (values.length > 0) rowArr.push(menuRow)
            rowArr.push(controlRow)
            await view.update({
                embeds: [embed],
                components: rowArr
            })
            view.on('select', async (i) => {
                const index = parseInt(i.values[0])
                const value = current[index]
                if (!value) return
                await i.deferUpdate()

                const cloned = view.clone()
                const clone = this.child.clone()
                clone.value = value
                const result = await clone.run(cloned).catch(() => undefined)
                cloned.destroy()
                if (!result) return
                current[index] = result
                // Updating embed

                if (this.overrides?.updateFn) {
                    embed = this.overrides.updateFn(current)
                } else {
                    const values = parseSettingToArrayFields(current, this.overrides?.parseToField ?? this.child.parseToField)
                    embed.setFields(values)
                }
                await view.update({
                    embeds: [embed],
                    components: rowArr
                })
            })
            view.on('confirm', async (i) => {
                await view.update({
                    content: 'Alterações confirmadas!',
                    embeds: [],
                    components: []
                })
                await i.deferUpdate()
                view.destroy()
                view = undefined as any // Destroying view to prevent memory leaks
                resolve(current)
            })
            view.on('add', async (i) => {
                const clonedView = view.clone()
                await i.deferUpdate()
                const clone = this.child.clone()
                clone.name = 'Novo valor'
                const result = await clone.run(clonedView).catch(() => { })
                clonedView.destroy()
                if (!result) return
                current.push(result)
                const a = current.map((value, index) => {
                    return {
                        label: index + 1 + '',
                        value: index + ''
                    }
                })
                menuRow.setComponents([
                    new StringSelectMenuBuilder()
                        .setCustomId('select')
                        .setPlaceholder('Selecione uma opção')
                        .addOptions(a)
                ])
                if (current.length === 1) rowArr.splice(0,0, menuRow) // Add a menu if not exists
                this.value = current
                if (this.overrides?.updateFn) {
                    embed = this.overrides.updateFn(current)
                } else {
                    const values = parseSettingToArrayFields(current, this.overrides?.parseToField ?? this.child.parseToField)
                    embed.setFields(values)
                }
                await view.update({
                    embeds: [embed],
                    components: rowArr
                })
            })

            /*
                Remove events
             */
            view.on('remove', async (_) => {
                if (current.length === 1) {
                    embed.setFields([])
                    embed.setFooter({
                        text: 'Removido o valor unico'
                    })
                    await view.update({
                        embeds: [embed],
                        components: []
                    })
                    rowArr.splice(0,1)
                    current.splice(0,1)
                    if (this.overrides?.updateFn) {
                        embed = this.overrides.updateFn(current)
                    }
                    await view.update({
                        embeds: [embed],
                        components: rowArr
                    })
                } else {
                    const removeEmbed = new EmbedBuilder()
                        .setTitle('Remover valor')
                        .setDescription('Selecione o valor que deseja remover')
                        .setColor('#ffffff')
                    const components = new ActionRowBuilder<StringSelectMenuBuilder>()
                        .setComponents([
                            new StringSelectMenuBuilder()
                                .setCustomId('removeSelect')
                                .setPlaceholder('Selecione uma opção')
                                .addOptions(values.map((value, index) => {
                                        return {
                                            label: value.name,
                                            value: index + ''
                                        }
                                    })
                                )
                                .setMaxValues(1)
                        ])
                    await view.update({
                        embeds: [removeEmbed],
                        components: [components]
                    })
                }
            })
            view.on('removeSelect', async (i) => {
                const index = parseInt(i.values[0])
                if (index === -1) return
                await i.deferUpdate()
                current.splice(index, 1)
                values = parseSettingToArrayFields(current, this.overrides?.parseToField ?? this.child.parseToField)
                embed.setFields(values)
                if (current.length === 0) rowArr.splice(0,1) // Remove menu if not exists
                if (this.overrides?.updateFn) {
                    embed = this.overrides.updateFn(current)
                }
                await view.update({
                    embeds: [embed],
                    components: rowArr
                })
            })
        })
    }
    parseToDatabase(value: Return[]) {
        if (this.child.parseToDatabase) {
            return Array.isArray(value) ? value.map((value) => {
                // @ts-ignore
                return this.child.parseToDatabase(value)
            }) : [];
        } else {
            return value
        }
    }
    parse(config: any, client: ExtendedClient, guildData: any, guild: DiscordGuild): Promise<Return[]> {
        return new Promise(async (resolve) => {
            const untreatedArray = config
            if (this.child.parse) {
                const parsedArray: Return[] = []
                for (const value of untreatedArray) {
                    const parsed = await this.child.parse(value, client, guildData, guild).catch(() => undefined)
                    if (!parsed) {
                        continue
                    }
                    parsedArray.push(parsed)
                }
                resolve(parsedArray)
            } else {
                resolve(untreatedArray)
            }
        })

    }
    clone(): Setting<Return[]> {
        return new ArraySetting(this.structure, this.value)
    }
}