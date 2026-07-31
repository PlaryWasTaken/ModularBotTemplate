import {Collection} from "discord.js";
import {ExtendedClient} from "../../types";
import {Awaitable} from "@discordjs/util";
type Client = NonNullable<any>
export default class SharedClientsManager extends Collection<string, any> {
    private client: ExtendedClient;
    constructor(client: ExtendedClient) {
        super()
        this.client = client
    }
    ensureClient(name: string, ensureFn: () => Client): Client {
        let client = super.get(name)
        if (!client) {
            client = ensureFn()
            if (client === null) {
                throw new Error(`Houve um erro ao iniciar o client ${name}`)
            }
            super.set(name, client)
        }
        return client
    }
    async ensureClientAsync(name: string, ensureFn: () => Awaitable<Client>): Promise<Client> {
        let client = super.get(name)
        if (!client) {
            client = await ensureFn().catch((err: Error) => {
                this.client.logger.error(err.message)
                this.client.logger.error(JSON.stringify(err, undefined, 2))
                return null
            })
            if (client === null) {
                throw new Error(`Houve um erro ao iniciar o client ${name}`)
            }
            super.set(name, client)
        }
        return client
    }


}