import {ExtendedClient, MessageViewUpdate} from "../types";
import {
    ActionRowBuilder,
    CacheType,
    GuildTextBasedChannel,
    Interaction,
    Message,
    RepliableInteraction,
    TextBasedChannel
} from "discord.js";
import {EventEmitter} from "events";
import {Awaitable} from "@discordjs/util";
import {genRandomHexId} from "../util/stringRelated";

type ExtraOptions = {
    filter: (interaction: RepliableInteraction) => boolean,
}

export function CreateView(channel: GuildTextBasedChannel, client: ExtendedClient, view: MessageViewUpdate, options?: ExtraOptions): Promise<MessageView> {
    return new Promise(async (resolve, reject) => {
        await channel.send(view).then((msg) => {
            const viewClass = new MessageView(msg, channel, client, options?.filter)
            resolve(viewClass)
        }).catch((err) => {
            return reject(err)
        })

    })
}

// Not recommended since there exists the interaction view, but you do you
export function CreateViewFromInteraction(interaction: Interaction, client: ExtendedClient, view: MessageViewUpdate, options?: ExtraOptions): Promise<MessageView> {
    return new Promise(async (resolve, reject) => {
        if (!interaction.channel) return reject('Interaction channel not found')
        if (interaction.isRepliable()) {
            await interaction.reply({
                ...view,
                fetchReply: true
            }).then((msg) => {
                const viewClass = new MessageView(msg, interaction.channel as TextBasedChannel, client, options?.filter)
                resolve(viewClass)
            }).catch((err) => {
                return reject(err)
            })
        }
    })
}

export function CreateViewFromMessage(message: Message, client: ExtendedClient, options?: ExtraOptions): Promise<MessageView> {
    return new Promise(async (resolve) => {
        const viewClass = new MessageView(message, message.channel, client, options?.filter)
        resolve(viewClass)
    })
}

function addRandomIdToButtons(rows: ActionRowBuilder[], id: string): any {
    return rows.map((row) => {
        row.setComponents(row.components.map((component) => {
            const customId = (component.toJSON() as any).custom_id
            const split = customId.split("-")
            const viewId = split.pop()
            if (viewId === id) return component
            component.setCustomId( customId + '-' + id)
            return component
        }))
        return row
    })
}

/*
* No support for ephemeral messages since they have a completely different way of updating with discord.js
* Do not use the class directly, use the CreateView function instead
* This class is used to create a view for a message, views don't need to be sent, the class handles that
* Every time there is an update the view is called and if changes are detected the message is updated
* Events: delete, any interaction component customId (Ex: Button with customId "button" will emit "button")
 */
export class MessageView extends EventEmitter {
    public readonly message: Message;
    public readonly channel: GuildTextBasedChannel;
    public readonly client: ExtendedClient;
    public latestUpdate: MessageViewUpdate = {};
    private msgId: string = "0";
    private timeout: NodeJS.Timeout | null = null
    private timeoutMs: number | null = null
    private readonly interactionListener: (interaction: RepliableInteraction<CacheType>) => Awaitable<void>
    private readonly messageDeleteListener: (message: Message) => Awaitable<void>
    private viewId: string = genRandomHexId()
    private extraFilter: (interaction: RepliableInteraction) => boolean = () => true;
    constructor(message: Message, channel: TextBasedChannel, client: ExtendedClient, filter?: (interaction: RepliableInteraction) => boolean, timeout?: number ) {
        super()
        this.channel = channel as GuildTextBasedChannel
        this.client = client
        this.message = message
        this.msgId = message.id
        this.latestUpdate = {
            embeds: message.embeds,
            components: message.components,
            content: message.content,
            files: Array.from(message.attachments.values())
        }
        if (filter) this.extraFilter = filter
        if (timeout !== 0) {
            this.setTimeout(timeout || 60000)
            this.timeoutMs = timeout ?? null
        }
        this.interactionListener = (interaction) => {
            if ((interaction as any).message && (interaction as any).message.id === this.msgId) {
                const split = (interaction as any).customId.split("-")
                const id = split.shift()
                if (this.extraFilter((interaction as RepliableInteraction))) {
                    if (this.timeout) this.timeout.refresh()
                    const viewId = split.pop()
                    if (viewId && viewId !== this.viewId) return // This ensures that clones views don't emit events in the original view
                    super.emit(id, interaction, split)
                    super.emit("any", interaction)
                }
            }
        }
        this.messageDeleteListener = (deleted) => {
            if (deleted.id === this.msgId) {
                this.destroy("deleted")
                super.emit("delete", deleted)
            }
        }
        this.client.on("interactionCreate", this.interactionListener as any)
        this.client.on("messageDelete", this.messageDeleteListener as any)
    }
    public get Channel() {
        return this.channel
    }
    public get Message() {
        return this.message
    }
    public get Id() {
        return this.msgId
    }
    public refreshTimeout() {
        if (this.timeout) this.timeout.refresh()
    }
    public setTimeout(ms: number) {
        if (this.timeout) clearTimeout(this.timeout)
        this.timeout = setTimeout(() => { this.destroy('time')}, ms)
        return this.timeout
    }
    protected setMsgId(id: string) {
        this.msgId = id
        return true
    }
    public setId(id: string) {
        this.viewId = id
        return true
    }
    public setExtraFilter(filter: (interaction: RepliableInteraction) => boolean) {
        this.extraFilter = filter
        return true
    }
    public async update(view: MessageViewUpdate): Promise<boolean> {
        return new Promise(async (resolve) => {
            if (view.components) view.components = addRandomIdToButtons(view.components as ActionRowBuilder[], this.viewId)
                this.latestUpdate = view
                await this.message.edit({
                    ...view,
                }).then(() => {
                    return resolve(true)
                }).catch(() => {
                    return resolve(false)
                })

        })
    }
    public clone() {
        const cloned = new MessageView(this.message, this.channel, this.client, this.extraFilter,  this.timeoutMs ?? undefined)
        cloned.setMsgId(this.msgId)
        return cloned
    }
    public destroy(reason?: string) {
        if (this.timeout) clearTimeout(this.timeout)
        super.emit("end", reason || "destroy")
        // console.log("destroyed-" + this.viewId + "-" + reason)
        this.removeAllListeners()
        this.client.removeListener("interactionCreate", this.interactionListener as any)
        this.client.removeListener("messageDelete", this.messageDeleteListener as any)
    }
}