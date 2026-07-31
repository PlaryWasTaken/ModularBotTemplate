import {
    ButtonStyle,
} from "discord.js";
import {InteractionView} from "../../util/InteractionView";
import {BaseSettingStructure, Setting} from "../Setting";

type OptionSettingStructure<T> = BaseSettingStructure & {
    options: Setting<T>[]
}


export class OptionSettingFile<T extends any = any> implements Setting<T> {
    public type = 'boolean';
    public complex = false;
    public name: string;
    public description: string;
    public permission?: bigint;
    public structure: OptionSettingStructure<T>;
    public value?: T;
    public id: string;
    public options: Setting<T>[];
    constructor(setting: OptionSettingStructure<T>, value?: T) {
        this.name = setting.name;
        this.description = setting.description;
        this.permission = setting.permission;
        this.structure = setting;
        this.value = value;
        this.id = setting.id;
        this.options = setting.options;
    }

    public run(view: InteractionView): Promise<T> {
        return new Promise(async (resolve) => {

        })
    }
    clone(): OptionSettingFile<T> {
        return new OptionSettingFile<T>(this.structure, this.value)
    }
}