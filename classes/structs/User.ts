import * as discord from "discord.js";
import Guild from "./Guild"
import {Collection} from "discord.js";
import {Setting} from "../../settings/Setting";
import {ExtendedClient} from "../../types";
import {ObjectFlags} from "./ObjectFlags";
import {HydratedDocument} from "mongoose";
import {concatMap, debounceTime, from, retry, Subject, tap} from "rxjs";


export default class User {
    public readonly id: string;
    public readonly member: discord.GuildMember;
    public readonly guild: Guild
    public readonly user: discord.User
    public client: ExtendedClient;
    public data: HydratedDocument<any>;
    public settings: Collection<string,Setting<unknown>>;
    public flags: ObjectFlags;
    private saveQueue$: Subject<void>
    constructor(client: ExtendedClient, member: discord.GuildMember, guild: Guild, settings: Collection<string, Setting<unknown>>,data: any) {
        this.id = member.id
        this.member = member
        this.user = member?.user || member
        this.client = client
        this.data = data
        this.guild = guild
        this.settings = settings
        this.flags = new ObjectFlags(client, this)
        this.saveQueue$ = new Subject()
        this.saveQueue$.pipe(
            debounceTime(300),
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
                        delay: 1000 + (Math.random() * 600),
                        resetOnSuccess: true
                    })
                )
            )
        ).subscribe({
            error: (err) => console.log(err)
        })

    }
    public save(): void {
        this.saveQueue$.next()
        return;
    }

}