import User from '../structs/User'
import {DbSetting, ExtendedClient} from "../../types";
import Guild from "../structs/Guild";
import {Collection, Guild as discordGuild, GuildMember} from "discord.js";
import {Logger} from "winston";
import {Setting} from "../../settings/Setting";
import { StopWatch } from '@slime/stopwatch';
import {HydratedDocument} from "mongoose";
async function getGuilds(client: ExtendedClient, guilds: Array<string>): Promise<Array<Guild>> {
    const guildArray: Guild[] = []
    for (const guild of guilds) {
        if (guildArray.find((guildObj) => guildObj.guild.id === guild)) continue
        guildArray.push(await client.guildHandler.fetchOrCreate(guild))
    }
    return guildArray
}
async function getAllSettings (client: ExtendedClient, userData: any, guild: discordGuild, logger: Logger, user: GuildMember) {
    const settings = client.modules.map((module) => module.userSettings).flat()
    const settingsMap = new Collection<string, Setting<unknown>>()
    const stopWatch = new StopWatch()
    for (const originalSetting of settings) {
        const setting = originalSetting.clone();

        setting.save = originalSetting.save
        setting.load = originalSetting.load
        setting.parse = originalSetting.parse
        setting.parseToDatabase = originalSetting.parseToDatabase
        setting.condition = originalSetting.condition


        const settingData = userData.settings.get(setting.id) as DbSetting
        // Loading bypasses default loading and parsing steps,
        // Should only be used with settings that have a customized save flow that saves to elsewhere than the normal settings table
        stopWatch.startTimer()
        if (setting.load) {
            setting.value = await setting.load(guild, userData, user)
            settingsMap.set(setting.id, setting)
            continue
        }
        if (settingData) {
            if (setting.parse) {
                setting.value = await setting.parse(settingData, client, userData, guild, user)
            } else {
                setting.value = settingData
            }
        }
        stopWatch.stopTimer()
        logger.debug(`Loaded setting ${setting.id} in ${stopWatch.getTimeElapsedInMs}ms for ${user.id}. Load present: ${!!setting.load}, Parse present: ${!!setting.parse}, Has data ${!!settingData}`)
        settingsMap.set(setting.id, setting)
        stopWatch.reset()
    }
    return settingsMap
}

export default class userHandler {
    private readonly client: ExtendedClient;
    private readonly logger: Logger;
    constructor(client: ExtendedClient, logger: Logger) {
        this.client = client
        this.logger = logger
    }
    fetch(id: string, guild: string): Promise<User> {
        return new Promise(async (resolve, err) => {
            if (this.client.globalLock.isBusy('fullyReady')) await this.client.globalLock.acquire('fullyReady', () => {})

            const userProfile = await this.client.defaultModels.user.findOne({id: id, guildId: guild})
            if (!userProfile) return err('No user profile!')
            const guildObj = await this.client.guildHandler.fetchOrCreate(guild).catch(() => {})
            if (!guildObj) return err('No guild found with the id!')
            const member = await guildObj.guild.members.fetch(id).catch(() => {
            })
            if (!member) return err('No member!')
            resolve(new User(this.client, member, guildObj, await getAllSettings(this.client, userProfile, guildObj.guild, this.logger, member),userProfile))
        })
    }

    fetchOrCreate(id: string, guild: string): Promise<User> {
        return new Promise(async (resolve, err) => {
            if (this.client.globalLock.isBusy('fullyReady')) await this.client.globalLock.acquire('fullyReady', () => {})

            this.logger.debug(`Fetching user ${id} from guild ${guild}`)
            let userProfile = await this.client.defaultModels.user.findOne({id: id, guildId: guild})
            const guildObj = await this.client.guildHandler.fetchOrCreate(guild).catch(() => {})
            if (!guildObj) return err('No guild!')
            if (!userProfile) {
                const profile = await this.client.defaultModels.user.create({
                    id: id,
                    guildId: guild
                })
                await profile.save()
                userProfile = await this.client.defaultModels.user.findOne({id: id, guildId: guild})
            }
            // this.logger.debug(`Created user profile if it didn't exist` )
            const member = await guildObj.guild.members.fetch(id).catch(() => {
            })
            if (!member) {
                await userProfile.delete()
                return err('No member!')
            }
            this.logger.debug(`Fetched user ${id} from guild ${guild}`)
            resolve(new User(this.client, member,guildObj, await getAllSettings(this.client, userProfile, guildObj.guild, this.logger, member), userProfile))
        })
    }

    delete(id: string, guild: string) {
        return new Promise(async (resolve, err) => {
            if (this.client.globalLock.isBusy('fullyReady')) await this.client.globalLock.acquire('fullyReady', () => {})

            const userProfile = await this.client.defaultModels.user.findOneAndDelete({id: id, guildId: guild})
            if (!userProfile) err('No user profile!')
            resolve(userProfile)
        })
    }

    create(id: string, guild: string): Promise<User> {
        return new Promise(async (resolve, err) => {
            if (this.client.globalLock.isBusy('fullyReady')) await this.client.globalLock.acquire('fullyReady', () => {})

            const userTest = await this.client.defaultModels.user.findOne({id: id, guildId: guild})
            if (userTest) return err('User already exists!')
            const userProfile = await this.client.defaultModels.user.create({
                id: id,
                guildId: guild
            })
            await userProfile.save()
            const guildObj = await this.client.guildHandler.fetchOrCreate(guild).catch(() => {})
            if (!guildObj) return err('No guild!')
            const member = await guildObj.guild.members.fetch(id).catch(() => {
            })
            if (!member) return err('No member!')
            resolve(new User(this.client, member, guildObj, await getAllSettings(this.client, userProfile, guildObj.guild, this.logger, member), userProfile ))
        })
    }

    findOrCreateProfile(id: string, guild: string): Promise<HydratedDocument<any>> {
        return new Promise(async (resolve) => {
            if (this.client.globalLock.isBusy('fullyReady')) await this.client.globalLock.acquire('fullyReady', () => {})

            let userProfile = await this.client.defaultModels.user.findOne({id: id, guildId: guild})
            if (!userProfile) {
                const profile = await this.client.defaultModels.user.create({
                    id: id,
                    guildId: guild
                })
                await profile.save()
                userProfile = await this.client.defaultModels.user.findOne({id: id, guildId: guild})
            }
            resolve(userProfile)
        })
    }
    fetchDocumentsFromDB(filter: any): Promise<Array<HydratedDocument<any>>> {
        return new Promise(async (resolve, reject) => {
            if (this.client.globalLock.isBusy('fullyReady')) await this.client.globalLock.acquire('fullyReady', () => {})

            const userProfiles = await this.client.defaultModels.user.find(filter)
            if (!userProfiles || userProfiles.length === 0) return reject('No user profiles!')

            return resolve(userProfiles)
        })
    }

    findByKV(filter: any): Promise<Array<User>> {
        return new Promise(async (resolve, err) => {
            if (this.client.globalLock.isBusy('fullyReady')) await this.client.globalLock.acquire('fullyReady', () => {})

            const userProfiles = await this.client.defaultModels.user.find(filter)
            if (!userProfiles || userProfiles.length === 0) return err('No user profiles!')
            const guilds = userProfiles.map((profile: any) => profile.guildId)
            const guildArray = await getGuilds(this.client, guilds)
            const userIdsByGuild = new Map<string, string[]>()
            userProfiles.forEach((profile: any) => {
                userIdsByGuild.set(profile.guildId, [...(userIdsByGuild.get(profile.guildId) || []), profile.id])
            })
            const usersByGuild = new Map<string, Collection<string, GuildMember> | GuildMember>()
            for (const guild of guildArray) {
                const ids = userIdsByGuild.get(guild.guild.id)
                const members = await guild.guild.members.fetch({ user: ids }).catch(() => {})
                if (!members) continue
                usersByGuild.set(guild.guild.id, members)
            }
            const userArray: User[] = []
            for (const guild of guildArray) {
                const members = usersByGuild.get(guild.guild.id) as Collection<string, GuildMember> | GuildMember | undefined
                if (members instanceof Collection) {
                    for (const member of members.values()) {
                        const data = userProfiles.find((profile: User) => profile.id === member.id)
                        userArray.push(new User(this.client, member, guild, await getAllSettings(this.client, data, guild.guild, this.logger, member),data))
                    }
                } else if (members instanceof GuildMember) {
                    const data = userProfiles.find((profile: User) => profile.id === members.id)
                    userArray.push(new User(this.client, members, guild, await getAllSettings(this.client, data, guild.guild, this.logger, members),data ))
                }
            }
            resolve(userArray)
        })
    }
}