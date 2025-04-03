import {ExtendedClient} from "../../types";
import Guild from "../structs/Guild";
import {Collection} from "discord.js";
import {Logger} from "winston";


export class FlagsManager {
    public client: ExtendedClient;
    public flags: Collection<string, string | boolean | string[] | number>;
    private logger: Logger;

    constructor(client: ExtendedClient, logger: Logger) {
        this.client = client
        this.flags = new Collection()
        this.logger = logger
    }

    public registerFlag(flag: string, defaultValue: string | boolean | string[] | number) {
        if (this.flags.has(flag)) {
            this.logger.warning(`Flag ${flag} already exists, overwriting`)
        }
        this.flags.set(flag, defaultValue)
        return this
    }

    public deleteFlag(flag: string) {
        this.flags.delete(flag)
        return this
    }

    public getFlag(guild: Guild, flag: string) {
        return guild.flags.get(flag) ?? this.flags.get(flag)
    }
    public hasFlag(guild: Guild, flag: string) {
        return guild.flags.has(flag)
    }
}