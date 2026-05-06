import {
    ActionRowBuilder, Collection,
    EmbedBuilder, GuildTextBasedChannel,
    Message
} from "discord.js";
import {EmbedMenu} from "./classes/EmbedMenu";


export function waitForOneMessage<T extends boolean = false>(
    {
        channel,
        time = 60000,
        filter,
        errorOnNotCollected = false as T
    }: {
        channel: GuildTextBasedChannel,
        time?: number,
        filter?: (msg: Message) => boolean,
        errorOnNotCollected?: T
    }
): Promise<T extends true ? Message : (Message | undefined)> {
    return new Promise((resolve, reject) => {
        const collector = channel.createMessageCollector({
            filter,
            time: time,
        });
        collector.on('collect', (message) => {
            collector.stop()
            resolve(message)
        })
        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                if (!errorOnNotCollected) {
                    reject('noMessages')
                } else {
                    resolve(undefined as T extends true ? never : (Message | undefined))
                }
            }
        })
    })
}

export function embedMenuAskForString({menu, embed, handleErrors = false}: {
    menu: EmbedMenu,
    embed: EmbedBuilder,
    handleErrors: boolean | undefined
}): Promise<string> {
    return new Promise(async (resolve, reject) => {
        await menu.updatePage(embed, new ActionRowBuilder())
        const msg = await waitForOneMessage({
            channel: menu.channelObj,
            filter: (msg) => msg.author.id === menu.authorId
        })
        if (!msg || msg.content === '') {
            if (!handleErrors) {
                return reject('noMessages')
            } else {
                const embed = new EmbedBuilder()
                    .setTitle(`Erro`)
                    .setDescription(`Você não enviou uma mensagem a tempo, tente usar o comando novamente.`)
                    .setColor(`#ff4444`)
                await menu.updatePage(embed, new ActionRowBuilder())
                menu.stop()
                return
            }
        }
        if (msg.content === 'cancel') {
            reject('Cancelled')
        }
        await msg.delete()
        resolve(msg.content)
    })
}


export function getAllChannelMessages(channel: GuildTextBasedChannel) {
    return new Promise<Collection<string, Message>>(async (resolve, reject) => {
        const messages = new Collection<string, Message>()
        let lastCount = 100
        while (lastCount === 100) {
            await channel.messages.fetch({
                limit: 100,
                before: messages.last()?.id
            }).then((fetched) => {
                if (fetched.size === 0) {
                    resolve(messages)
                }
                fetched.forEach((msg) => {
                    messages.set(msg.id, msg)
                })
                lastCount = fetched.size
            }).catch((err) => {
                reject(err)
            })
        }
        resolve(messages)
    })
}
export function getChannelMessages(channel: GuildTextBasedChannel, number: number) {
    return new Promise<Collection<string, Message<true>>>(async (res, reject) => {
        const messages = new Collection<string, Message>()
        let total = number
        while (total > 0) {
            await channel.messages.fetch({
                limit: 100,
                before: messages.last()?.id
            }).then((fetched) => {
                if (fetched.size === 0) {
                    res(messages as Collection<string, Message<true>>)
                }
                fetched.forEach((msg) => {
                    messages.set(msg.id, msg)
                })
                total -= 100
            }).catch((err) => {
                reject(err)
            })
        }
        res(messages as Collection<string, Message<true>>)
    })
}