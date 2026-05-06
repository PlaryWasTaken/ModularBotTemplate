import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    Collection,
    EmbedBuilder, Guild,
} from "discord.js";
import {InteractionView} from "../../utils/InteractionView";
import {Setting} from "../Setting";
import {ExtendedClient} from "../../types";

function mapSchema(schema: ComplexSettingStructure["schema"]): Collection<string, Setting<any>> {
    const mappedSchema = new Collection<string, Setting<any>>()
    for (const key in schema) {
        const element = schema[key]
        mappedSchema.set(key, element)
    }
    return mappedSchema
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

function checkFilledSchema(currentConfig: ComplexSettingClass): boolean {
    for (const [key] of currentConfig.schema) {
        if (!((currentConfig.value as any)?.[key] !== undefined && (currentConfig.value as any)?.[key] !== null) && !currentConfig.optionals?.includes(key) && (currentConfig.value as any)?.[key] !== 0) return false
    }
    return true
}
type ComplexSchema = {
    [key: string]: Setting<any>
}
type ComplexSettingStructure = {
    name: string
    description: string
    permission?: bigint

    schema: ComplexSchema,
    optionals?: string[]
    id: string
    updateFn: (value: Partial<ComplexSettingReturn>) => EmbedBuilder
}

type ComplexSettingReturn = {
    [key: string]: any
}

export default class ComplexSettingClass implements Setting<ComplexSettingReturn> {
    public type = "complex"
    public name: string
    public description: string
    public permission?: bigint
    public structure: ComplexSettingStructure
    public value?: ComplexSettingReturn
    public schema: Collection<string, ComplexSchema[string]>
    public id: string
    public optionals?: string[]
    public updateFn: (value: Partial<ComplexSettingReturn>) => EmbedBuilder
    constructor(setting: ComplexSettingStructure, value?: ComplexSettingReturn) {
        this.name = setting.name
        this.description = setting.description
        this.permission = setting.permission
        this.structure = setting
        this.id = setting.id
        this.updateFn = setting.updateFn
        this.schema = mapSchema(setting.schema)
        this.optionals = setting.optionals

        this.value = value

    }

    public run(view: InteractionView): Promise<ComplexSettingReturn> {
        return new Promise(async (resolve, reject) => {
            const buttons = this.schema.map((value, key) => {
                return new ButtonBuilder()
                    .setCustomId(key)
                    .setLabel(value.name)
                    .setStyle(this.optionals?.includes(key) ? ButtonStyle.Secondary : ButtonStyle.Primary)
            })
            const splitButtons = chunkArr(buttons, 5)
            const rows = splitButtons.map((value) => {
                return new ActionRowBuilder<ButtonBuilder>().setComponents(value)
            })
            if (rows.length > 4) return reject('Max 4 rows')
            rows.push(new ActionRowBuilder<ButtonBuilder>().setComponents([
                new ButtonBuilder()
                    .setCustomId('confirm')
                    .setLabel('Confirmar alterações')
                    .setStyle(ButtonStyle.Success)
            ]))
            const embed = this.updateFn(this.value ?? {})
            await view.update({
                embeds: [embed],
                components: rows
            })
            view.on('confirm', async (i: ButtonInteraction) => {
                if (!checkFilledSchema(this)) {
                    const newEmbed = new EmbedBuilder(embed.toJSON())
                        .setFooter({text: 'Você não preencheu todos os campos! 💔'})
                        .setColor('#ff6767')
                    return view.update({
                        embeds: [newEmbed],
                        components: rows
                    })
                }
                const embedSuccess = new EmbedBuilder()
                    .setTitle(`Configuração de ${this.name} concluída`)
                    .setColor('#ffffff')
                    .setDescription('A configuração foi alterada com sucesso!')

                await view.update({
                    embeds: [embedSuccess],
                    components: []
                })
                view.destroy()
                resolve(this.value ?? {})
            })
            view.on('any', async (i: ButtonInteraction) => {
                if (i.customId === 'confirm') return

                await i.deferUpdate()
                const key = i.customId.split('-')[0]
                const setting = this.schema.get(key)
                if (!setting) return
                let current = this.value ?? {}
                if (current[key]) setting.value = current[key] // Keep default value
                setting.run(view.clone()).then(async (value: any) => {

                    current[key] = value
                    this.value = current

                    await view.update({
                        embeds: [this.updateFn(current)],
                        components: rows
                    })
                }).catch(() => {
                })

            })
        })
    }
    public parseToDatabase(valuee: ComplexSettingReturn): string {
        const parsed: any = {}
        for (const [key, value] of this.schema) {
            const setting = value
            if (setting.parseToDatabase) {
                parsed[key] = setting.parseToDatabase(valuee?.[key])
            } else {
                parsed[key] = valuee?.[key]
            }
        }
        return parsed
    }
    public parse(config: any, client: ExtendedClient, guildData: any, DGuild: Guild): Promise<ComplexSettingReturn> {
        return new Promise(async (resolve) => {
            const parsed = config
            const parsedObject: any = {}
            for (const [key, value] of this.schema) {
                const setting = value
                if (setting.parse) {
                    parsedObject[key] = await setting.parse(parsed[key], client, guildData, DGuild)
                } else {
                    parsedObject[key] = parsed[key]
                }
            }
            return resolve(parsedObject)
        })
    }
    public clone(): Setting<ComplexSettingReturn> {
        return new ComplexSettingClass(this.structure, this.value)
    }
}