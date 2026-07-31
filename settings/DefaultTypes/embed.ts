import {APIEmbed, EmbedBuilder} from "discord.js";
import {InteractionView} from "../../util/InteractionView";
import {EmbedCreator} from "../../util/components/EmbedCreatorComponent";
import {BaseSettingStructure, Setting} from "../Setting";


export class EmbedSettingFile implements Setting<EmbedBuilder> {
    public type = 'embed';
    public complex = true;
    public name: string;
    public description: string;
    public permission?: bigint;
    public structure: BaseSettingStructure;
    public value?: EmbedBuilder;
    public id: string;
    constructor(setting: BaseSettingStructure, value?: EmbedBuilder) {
        this.name = setting.name;
        this.description = setting.description;
        this.permission = setting.permission;
        this.structure = setting;
        this.value = value;
        this.id = setting.id;
    }

    public run(view: InteractionView): Promise<EmbedBuilder> {
        return new Promise(async (resolve, reject) => {
            const embed = await EmbedCreator(view, (m) => view.Interaction.user.id === m.author.id, {
                shouldComplete: true,
                data: this.value?.data || undefined
            }).catch(() => {})
            if (!embed) return reject()
            else resolve(embed)
        })
    }
    public parseToDatabase(value: EmbedBuilder) {
        return value.toJSON()
    }
    public async parse(config: any) {
        return new EmbedBuilder(config)
    }
    public parseToField(value: EmbedBuilder) {
        return `Título: ${value.data.title}\nDescrição: ${value.data.description?.length as any > 55 ? value.data.description?.slice(0, 55) + "...":value.data.description || "Sem descricão"}`
    }
    public clone() {
        return new EmbedSettingFile(this.structure, this.value)
    }
}