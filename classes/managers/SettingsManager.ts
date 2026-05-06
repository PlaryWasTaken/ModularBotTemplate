import { DbSetting, ExtendedClient} from "../../types";
import {Logger} from "winston";
import Guild from "../structs/Guild";
import User from "../structs/User";
import {Setting} from "../../settings/Setting";
export default class GuildManager {
    private readonly client: ExtendedClient;
    private readonly logger: Logger;


    constructor(client: ExtendedClient, logger: Logger) {
        this.client = client
        this.logger = logger
        if (!client) {
            throw new Error('Client is not defined')
        }
    }
    /*
    Old code, here just so i can reuse later on
    setSetting(guild: Guild, setting: string, value: string): Promise<boolean> {
        return new Promise(async (resolve, reject) => {
                const settingData = guild.settings.get(setting)
                if (!settingData) return reject('Setting not found')
                const newData: ConfigOption = {
                    eventName: settingData.eventName,
                    name: settingData.name,
                    description: settingData.description,
                    value: value,
                    default: settingData.default
                }
                guild.data.settings.set(setting, newData)
                await guild.data.save()
                const newParsedData: ConfigOption = {
                    eventName: settingData.eventName,
                    name: settingData.name,
                    description: settingData.description,
                    value: JSON.parse(value),
                    default: settingData.default
                }
                guild.settings.set(setting, newParsedData)
                return resolve(true)
            }
        )
    }
     */

    /*
     * Save to database, also updates the object
     */
    setSetting(entity: Guild | User, setting: string, value: unknown): Promise<boolean> {
        return new Promise(async (resolve) => {
            const newData: DbSetting = value
            const settingObj = entity.settings.get(setting) as Setting<unknown>
            settingObj.value = value
            entity.settings.set(setting, settingObj)
            entity.data.settings.set(setting, newData)
            entity.data.markModified('settings')
            await entity.data.save()
            if (entity instanceof User) this.client.profileHandler.clearUserFromCache(entity.id, entity.guild.id)
            this.client.guildHandler.invalidateCache(entity.id)
            return resolve(true)
        })
    }


}