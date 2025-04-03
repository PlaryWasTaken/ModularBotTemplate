// noinspection JSUnusedGlobalSymbols

import {ExtendedClient} from "../../types";
import {HydratedDocument} from "mongoose";
import {Logger} from "winston";

type HasData = Record<string, any> & {
    data: any
    id: string
}

export class ObjectFlags {
    public client: ExtendedClient;
    public object: HasData;
    private logger: Logger;
    constructor(client: ExtendedClient, object: HasData) {
        this.client = client
        this.object = object
        this.logger = client.logger.child({service: `${object.id} Flags`, hexColor: '#aa00ff'})
    }
    public set(flag: string, value: string | boolean | string[] | number) {
        if (!this.client.flags.flags.has(flag)) {
            this.logger.warning(`Flag ${flag} is not registered, ignoring`)
            return undefined
        }
        this.object.data.flags.set(flag, value);
        (this.object.data as HydratedDocument<any>).markModified('flags')
        this.object.data.save()
        return this
    }
    public awaitableSet(flag: string, value: string | boolean | string[] | number) {
        return new Promise((resolve, reject) => {
            if (!this.client.flags.flags.has(flag)) {
                this.logger.warning(`Flag ${flag} is not registered, ignoring`)
                return reject(undefined)
            }
            this.object.data.flags.set(flag, value)
            this.object.data.save().then(() => {
                resolve(this)
            })
        })
    }

    public delete(flag: string) {
        this.object.data.flags.delete(flag)
        return this
    }

    public get(flag: string) {
        return this.object.data.flags.get(flag) ?? this.client.flags.flags.get(flag)
    }

    public has(flag: string) {
        return this.object.data.flags.has(flag)
    }

    public isTruthy(flag: string) {
        return !!this.get(flag)
    }

    public get all() {
        return this.object.data.flags
    }

}