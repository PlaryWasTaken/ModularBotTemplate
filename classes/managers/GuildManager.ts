import Guild from "../structs/Guild";
import {DbSetting, ExtendedClient} from "../../types";
import {Collection, Guild as discordGuild} from "discord.js";
import {Logger} from "winston";
import {Setting} from "../../settings/Setting";
import {StopWatch} from "@slime/stopwatch";

async function getAllSettings(client: ExtendedClient, guildData: any, guild: discordGuild, logger: Logger) {
    const settings = client.modules.map((module) => module.settings).flat()
    console.log(settings.map(sett => sett.id))
    const settingsMap = new Collection<string, Setting<unknown>>()
    const stopWatch = new StopWatch()
    const perfStats = new Collection<string, number>()
    let perfTimeTotal = 0
    for (const originalSetting of settings) {
        const setting = originalSetting.clone()

        setting.save = originalSetting.save
        setting.load = originalSetting.load
        setting.parse = originalSetting.parse
        setting.parseToDatabase = originalSetting.parseToDatabase
        setting.condition = originalSetting.condition

        const settingData = guildData.settings.get(setting.id) as DbSetting
        // Loading bypasses default loading and parsing steps,
        // Should only be used with settings that have a customized save flow that saves to elsewhere than the normal settings table
        stopWatch.startTimer()
        if (setting.load) {
            setting.value = await setting.load(guild, guildData)
            settingsMap.set(setting.id, setting)
            continue
        }
        if (settingData) {
            if (setting.parse) {
                try {
                    setting.value = await setting.parse(settingData, client, guildData, guild)
                } catch (e) {
                    logger.error(`Failed to parse setting ${setting.id} for guild ${guild.id}`, {
                        error: e,
                        setting: setting,
                        guild: {
                            id: guild.id,
                            name: guild.name
                        }
                    })
                }
            } else {
                setting.value = settingData
            }
        }
        stopWatch.stopTimer()
        logger.info(`Loaded setting ${setting.id} in ${stopWatch.getTimeElapsedInMs}ms`, {
            setting: setting.id,
            time: stopWatch.getTimeElapsedInMs
        })
        perfStats.set(setting.id, stopWatch.getTimeElapsedInMs)
        perfTimeTotal += stopWatch.getTimeElapsedInMs
        settingsMap.set(setting.id, setting)
        stopWatch.reset()
    }
    const statsObj: Record<string, number> = {}
    perfStats.forEach((value, key) => {
        statsObj[key] = value
    })
    logger.notice(`Loaded ${settingsMap.size} settings for guild ${guild.id} in ${perfTimeTotal}ms`, {
        total: perfTimeTotal
    })
    return settingsMap
}

export default class GuildManager {
    private readonly client: ExtendedClient;
    private settingCache: Collection<string, Collection<string, Setting<any>>> = new Collection<string, Collection<string, Setting<any>>>()
    private readonly logger: Logger;

    constructor(client: ExtendedClient, logger: Logger) {
        this.client = client
        this.logger = logger
        if (!client) {
            throw new Error('Client is not defined')
        }
    }

    fetchOrCreate(id: string, force?: boolean): Promise<Guild> {
        return new Promise(async (resolve, err) => {
            if (this.client.globalLock.isBusy('fullyReady')) await this.client.globalLock.acquire('fullyReady', () => {
            })

            const guild =
                force ?
                    this.client.guilds.cache.get(id) || await this.client.guilds.fetch(id).catch(() => {}) :
                    await this.client.guilds.fetch(id).catch(() => {})

            if (!guild) return err('No guild!')
            let guildData = await this.client.defaultModels.guild.findOne({id: id})
            if (!guildData) {
                const profile = await this.client.defaultModels.guild.create({
                    id: id
                })
                await profile.save()
                guildData = profile
            }
            const settings = this.settingCache.get(id) ?? await getAllSettings(this.client, guildData, guild, this.logger)
            this.settingCache.set(id, settings)
            return resolve(new Guild(this.client, guild, guildData, settings))
        })
    }

    findByKV(filter: any): Promise<Array<Guild>> {
        return new Promise(async (resolve, err) => {
            if (this.client.globalLock.isBusy('fullyReady')) await this.client.globalLock.acquire('fullyReady', () => {
            })

            const guildProfiles = await this.client.defaultModels.guild.find(filter)
            if (!guildProfiles || guildProfiles.length === 0) return err('No guild profiles!')
            const guilds: Guild[] = []
            for (const guildProfile of guildProfiles) {
                const guild = this.client.guilds.cache.get(guildProfile.id) || await this.client.guilds.fetch(guildProfile.id).catch(() => {})
                if (!guild) continue
                const settings = this.settingCache.get(guild.id) ?? await getAllSettings(this.client, guildProfile, guild, this.logger)
                this.settingCache.set(guild.id, settings)
                guilds.push(new Guild(this.client, guild, guildProfile, settings))
            }
            this.logger.debug(`Found ${guilds.length} guilds with filter "${JSON.stringify(filter)}" while searching by KV`)
            resolve(guilds)
        })
    }

    invalidateCache(id: string) {
        this.settingCache.delete(id)
    }
}
/*
    settings = [{ id: string, value: any }]
 */