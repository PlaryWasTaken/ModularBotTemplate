import {
    ActionRowBuilder,
    ButtonInteraction,
    EmbedBuilder, GuildTextBasedChannel,
    InteractionCollector,
    Message
} from "discord.js";
import {EventEmitter} from "events";
import {FuckDiscordJS} from "../../types";


export class EmbedMenu extends EventEmitter {
    private embed: EmbedBuilder;
    private row: ActionRowBuilder<any>[];
    private channel: GuildTextBasedChannel;
    private msg: FuckDiscordJS;
    private collector: InteractionCollector<ButtonInteraction>;
    private last: {
        embed: EmbedBuilder,
        row: ActionRowBuilder<any>[]
    };
    private authorUserId: string;

    constructor(embed: EmbedBuilder, row: ActionRowBuilder<any> | ActionRowBuilder<any>[], msg: Message, authorId: string) {
        super()
        const rowArray = Array.isArray(row) ? row : [row]
        this.embed = embed
        this.last = {
            embed: embed,
            row: rowArray
        }
        this.msg = msg as FuckDiscordJS
        this.row = rowArray
        this.channel = msg.channel as GuildTextBasedChannel
        this.authorUserId = authorId
        const collector = this.channel.createMessageComponentCollector({
            time: 60000,
            filter: (interaction) => interaction.user.id === authorId
        })
        this.collector = collector as InteractionCollector<ButtonInteraction>

        collector.on('collect', async (interaction) => {
            collector.resetTimer()
            if (interaction.customId === 'return') {
                await interaction.deferUpdate()
                await this.updatePage(this.last.embed, this.last.row)
            } else {
                const eventName = interaction.customId.split('-')[0]
                this.emit(eventName, interaction)
            }
        })
        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                this.emit('end', reason)
            }
        })
    }

    get currentEmbed() {
        return this.embed
    }

    get channelObj() {
        return this.channel
    }

    get authorId() {
        return this.authorUserId
    }

    updatePage(embed: EmbedBuilder, row: ActionRowBuilder<any> | ActionRowBuilder<any>[]) {
        return new Promise<void>(async (resolve, reject) => {
            this.last.embed = this.embed
            this.last.row = this.row
            this.embed = embed
            this.row = Array.isArray(row) ? row : [row]
            if (this.row[0].components.length === 0) {
                this.collector.resetTimer() // if there are no buttons, reset the timer
            }
            await this.msg.edit({
                embeds: [this.embed],
                components: this.row[0].components.length === 0 ? [] : this.row
            }).then(() => {
                resolve()
            }).catch((err) => {
                reject(err)
            })
        })
    }

    stop() {
        this.collector.stop()
    }

    setDisabled(customId: string, disabled: boolean) {
        return new Promise<void>(async (resolve) => {
            const button = this.row.filter((row) => row.components.find((button) => button.customId === customId))[0].components.find((button) => button.customId === customId)
            if (button) {
                button.setDisabled(disabled)
            }
            await this.updatePage(this.embed, this.row)
            resolve()
        })
    }
}