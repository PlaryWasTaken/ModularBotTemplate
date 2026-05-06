import * as discord from 'discord.js'
import {ExtendedClient} from "../../types";
import {Collection} from "discord.js";
import {Setting} from "../../settings/Setting";
import {ObjectFlags} from "./ObjectFlags";
import {HydratedDocument} from "mongoose";
import {Permissions} from "./Permissions";
import {parseFromDatabase} from "../../util/parsingRelated";
import {concatMap, from, retry, Subject, tap} from "rxjs";

export default class Guild {
    public client: ExtendedClient;
    public readonly guild: discord.Guild;
    public data: HydratedDocument<any>;
    public settings: Collection<string,Setting<unknown>>;
    public permissionOverrides: Permissions;
    public readonly id: string;
    public flags: ObjectFlags;
    private saveQueue$: Subject<void>;
    constructor(client: ExtendedClient, guild: discord.Guild, guildData: any, settings: Collection<string,Setting<unknown>>) {
        this.client = client
        this.guild = guild
        this.data = guildData
        this.settings = settings
        this.permissionOverrides = new Permissions(client.logger, parseFromDatabase(guildData.permissionsOverrides || []))
        this.id = guild.id
        this.flags = new ObjectFlags(client, this)
        this.saveQueue$ = new Subject()
        this.saveQueue$.pipe(
            concatMap(() =>
                from(this.data.save()).pipe(
                    tap({
                        next: () => {
                            this.client.logger.debug(
                                `Profile save succeeded`,
                                { userId: this.id }
                            );
                        },
                        error: err => {
                            this.client.logger.error(
                                `Profile save for ${this.id} failed, retrying`,
                                {
                                    userId: this.id,
                                    error: err,
                                }
                            );
                        },
                    }),
                    retry({
                        count: 5,
                        delay: 200
                    })
                )
            )
        ).subscribe()
    }
    public save(): void {
        this.saveQueue$.next()
        return;
    }
}

