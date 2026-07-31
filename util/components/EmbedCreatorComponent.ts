import {AnyView, MessageViewUpdate} from "../../types";
import {
    ActionRowBuilder, APIEmbed,
    ButtonBuilder,
    ButtonStyle,
    ColorResolvable,
    EmbedBuilder,
    Message,
    resolveColor, StringSelectMenuBuilder
} from "discord.js";

type EmbedCreatorOptions = {
    // Whether there is a button to confirm the current embed and pass the values or to just finish the view and return undefined
    shouldComplete?: boolean,
    data?: APIEmbed
}
const Second = 1000
type Milliseconds = number

function waitForUserInput(view: AnyView, newView: MessageViewUpdate, expiry: Milliseconds, filter: (m: Message) => boolean, options: {
    deleteCollected?: boolean
}): Promise<string> {
    return new Promise<string>(async (resolve, reject) => {
        view = view.clone()
        await view.update(newView)
        const channel = view.Channel
        const collector = channel.createMessageCollector({
            filter: filter,
            time: expiry
        })
        collector.on('collect', async (m) => {
            if (m.content) {
                if (options.deleteCollected) await m.delete()
                collector.stop()
                resolve(m.content)
            } else { // Is an image
                // Deleting images in any situation is a bad idea since discord will delete the image from the server, so even if the delete option is true, it will not delete the image
                collector.stop()
                const attachment = m.attachments.first()
                view.destroy()
                if (!attachment) return reject('No attachment/message content')
                resolve(attachment.url)
            }
        })
        collector.on('end', async (_, reason) => {
            if (reason === 'user') return
            view.destroy()
            reject(reason)
        })

    })
}

// Rejects if the user doenst responds in time
export function EmbedCreator(view: AnyView, filter: (m: Message) => boolean, options?: EmbedCreatorOptions): Promise<EmbedBuilder> {
    return new Promise(async (resolve, reject) => {
        // This separates the EventEmitter from the original view since I will be using it to update the view
        // And doing it like this helps prevent id collisions
        const newView = view.clone()
        const defaultEmbed = new EmbedBuilder()
            .setTitle(`Placeholder`)
            .setFields([
                {
                    name: 'Placeholder',
                    value: `Placeholder`,
                }
            ])
            .setColor(`#ffffff`)
            .setFooter({text: `Feito com ❤️`})
            .setAuthor({name: `Criador de Embeds`})
        let embed = options?.data ? new EmbedBuilder(options.data) : defaultEmbed

        const rows: ActionRowBuilder<ButtonBuilder>[] = []
        const controlRow1 = new ActionRowBuilder<ButtonBuilder>()
            .setComponents([
                new ButtonBuilder()
                    .setCustomId('title')
                    .setLabel('Título')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('description')
                    .setLabel('Descrição')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('color')
                    .setLabel('Cor')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('image')
                    .setLabel('Imagem')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('thumbnail')
                    .setLabel('Thumbnail')
                    .setStyle(ButtonStyle.Primary)
            ])
        const controlRow2 = new ActionRowBuilder<ButtonBuilder>()
            .setComponents([
                new ButtonBuilder()
                    .setCustomId('field')
                    .setLabel('Campos')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('footer')
                    .setLabel('Rodapé')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('author')
                    .setLabel('Autor')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('import')
                    .setLabel('Importar')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('export')
                    .setLabel('Exportar')
                    .setStyle(ButtonStyle.Secondary)
            ])
        const controlRow3 = new ActionRowBuilder<ButtonBuilder>()
            .setComponents([
                new ButtonBuilder()
                    .setCustomId('finish')
                    .setLabel('Finalizar')
                    .setStyle(ButtonStyle.Success),
            ])
        rows.push(controlRow1, controlRow2)
        if (options?.shouldComplete) rows.push(controlRow3)
        await newView.update({
            embeds: [embed],
            components: rows,
            content: ``
        })
        const questionEmbed = new EmbedBuilder()
            .setTitle(`Editando`)
            .setColor(`#ffffff`)
        const defaultTime = 30 * Second
        const defaultOptions = {
            deleteCollected: true
        }
        const errEmbed = new EmbedBuilder()
            .setTitle(`Erro`)
            .setColor(`#ff0000`)
        newView.on('finish', async (i) => {
            await i.deferUpdate()
            newView.destroy()
            resolve(embed)
        })

        newView.on('title', async (i) => {
            questionEmbed
                .setDescription(`Qual será o novo título?`)
            await i.deferUpdate()
            const title = await waitForUserInput(newView, {
                embeds: [questionEmbed],
                components: []
            }, defaultTime, filter, defaultOptions).catch(() => undefined)
            if (!title) {
                errEmbed
                    .setDescription(`Você não respondeu a tempo`)
                return reject(await i.editReply({embeds: [errEmbed]}))
            }
            embed
                .setTitle(title)
            await newView.update({embeds: [embed], components: rows})
        })
        newView.on('description', async (i) => {
            questionEmbed
                .setDescription(`Qual será a nova descrição?`)
            await i.deferUpdate()
            const description = await waitForUserInput(newView, {
                embeds: [questionEmbed],
                components: []
            }, defaultTime, filter, defaultOptions).catch(() => undefined)
            if (!description) {
                errEmbed
                    .setDescription(`Você não respondeu a tempo`)
                return reject(await newView.update({embeds: [errEmbed]}))
            }
            embed
                .setDescription(description)
            await newView.update({embeds: [embed], components: rows})
        })
        newView.on('color', async (i) => {
            questionEmbed
                .setDescription(`Qual será a nova cor?`)
            await i.deferUpdate()
            const color = await waitForUserInput(newView, {
                embeds: [questionEmbed],
                components: []
            }, defaultTime, filter, defaultOptions).catch(() => undefined)
            if (!color) {
                errEmbed
                    .setDescription(`Você não respondeu a tempo`)
                return reject(await newView.update({embeds: [errEmbed]}))
            }
            if (!color.startsWith('#')) {
                errEmbed
                    .setDescription(`A cor deve ser um hexadecimal\nExemplo: \`#ffffff\`\nTente novamente`)
                await newView.update({embeds: [errEmbed], components: rows})
                return
            }
            try {
                resolveColor(color as `#${string}`)
            } catch (e) {
                errEmbed
                    .setDescription(`A cor deve ser um hexadecimal\nExemplo: \`#ffffff\`\nTente novamente`)
                await newView.update({embeds: [errEmbed], components: rows})
                return
            }
            embed
                .setColor(color as ColorResolvable)
            await newView.update({embeds: [embed], components: rows})
        })
        newView.on('image', async (i) => {
            questionEmbed
                .setDescription(`Qual será a nova imagem?`)
            await i.deferUpdate()
            const image = await waitForUserInput(newView, {
                embeds: [questionEmbed],
                components: []
            }, defaultTime, filter, defaultOptions).catch(() => undefined)
            if (!image) {
                errEmbed
                    .setDescription(`Você não respondeu a tempo`)
                return reject(await newView.update({embeds: [errEmbed]}))
            }
            try {
                embed
                    .setImage(image)
            } catch (e) {
                errEmbed
                    .setDescription(`A imagem deve ser um link válido ou um anexo\nTente novamente`)
                await newView.update({embeds: [errEmbed], components: rows})
                return
            }
            await newView.update({embeds: [embed], components: rows})
        })
        newView.on('thumbnail', async (i) => {
            questionEmbed
                .setDescription(`Qual será a nova thumbnail?`)
            await i.deferUpdate()
            const thumbnail = await waitForUserInput(newView, {
                embeds: [questionEmbed],
                components: []
            }, defaultTime, filter, defaultOptions).catch(() => undefined)
            if (!thumbnail) {
                errEmbed
                    .setDescription(`Você não respondeu a tempo`)
                return reject(await newView.update({embeds: [errEmbed]}))
            }
            try {
                embed
                    .setThumbnail(thumbnail)
            } catch (e) {
                errEmbed
                    .setDescription(`A thumbnail deve ser um link válido ou um anexo\nTente novamente`)
                await newView.update({embeds: [errEmbed], components: rows})
                return
            }
            await newView.update({embeds: [embed], components: rows})
        })
        /*
          Start of footer buttons
          A
         */
        newView.on('footer', async (i) => {
            const footerEmbed = new EmbedBuilder()
                .setTitle(`Editar rodapé`)
                .setDescription(`Deseja editar o texto ou o ícone?`)
                .setColor(`#ffffff`)
            const footerRow = new ActionRowBuilder<ButtonBuilder>()
                .setComponents([
                    new ButtonBuilder()
                        .setCustomId('footerText')
                        .setLabel('Texto')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('footerIcon')
                        .setLabel('Ícone')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('footerRemove')
                        .setLabel('Remover')
                        .setStyle(ButtonStyle.Danger)
                ])
            await i.deferUpdate()
            await newView.update({embeds: [footerEmbed], components: [footerRow]})
        })
        newView.on('footerText', async (i) => {
            questionEmbed
                .setDescription(`Qual será o novo texto?`)
            await i.deferUpdate()
            const footerText = await waitForUserInput(newView, {
                embeds: [questionEmbed],
                components: []
            }, defaultTime, filter, defaultOptions).catch(() => undefined)
            if (!footerText) {
                errEmbed
                    .setDescription(`Você não respondeu a tempo`)
                return reject(await newView.update({embeds: [errEmbed]}))
            }
            embed
                .setFooter({text: footerText})
            await newView.update({embeds: [embed], components: rows})
        })
        newView.on('footerIcon', async (i) => {
            questionEmbed
                .setDescription(`Qual será o novo ícone?`)
            await i.deferUpdate()
            const footerIcon = await waitForUserInput(newView, {
                embeds: [questionEmbed],
                components: []
            }, defaultTime, filter, defaultOptions).catch(() => undefined)
            if (!footerIcon) {
                errEmbed
                    .setDescription(`Você não respondeu a tempo`)
                return reject(await newView.update({embeds: [errEmbed]}))
            }
            try {
                embed
                    .setFooter({iconURL: footerIcon, text: embed.data.footer?.text as string})
            } catch (e) {
                errEmbed
                    .setDescription(`O icone deve ser um link válido ou um anexo\nTente novamente`)
                await newView.update({embeds: [errEmbed], components: rows})
                return
            }
            await newView.update({embeds: [embed], components: rows})
        })
        newView.on('footerRemove', async (i) => {
            await i.deferUpdate()
            embed
                .setFooter(null)
            await newView.update({embeds: [embed], components: rows})
        })
        /*
            End of footer buttons
         */
        /*
            Start of author buttons
         */
        newView.on('author', async (i) => {
            const authorEmbed = new EmbedBuilder()
                .setTitle(`Editar autor`)
                .setDescription(`Deseja editar o nome ou o ícone?`)
                .setColor(`#ffffff`)
            const authorRow = new ActionRowBuilder<ButtonBuilder>()
                .setComponents([
                    new ButtonBuilder()
                        .setCustomId('authorName')
                        .setLabel('Nome')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('authorIcon')
                        .setLabel('Ícone')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('authorRemove')
                        .setLabel('Remover')
                        .setStyle(ButtonStyle.Danger)
                ])
            await i.deferUpdate()
            await newView.update({embeds: [authorEmbed], components: [authorRow]})
        })
        newView.on('authorName', async (i) => {
            questionEmbed
                .setDescription(`Qual será o novo nome?`)
            await i.deferUpdate()
            const authorName = await waitForUserInput(newView, {
                embeds: [questionEmbed],
                components: []
            }, defaultTime, filter, defaultOptions).catch(() => undefined)
            if (!authorName) {
                errEmbed
                    .setDescription(`Você não respondeu a tempo`)
                return reject(await newView.update({embeds: [errEmbed]}))
            }
            embed
                .setAuthor({name: authorName})
            await newView.update({embeds: [embed], components: rows})
        })
        newView.on('authorIcon', async (i) => {
            questionEmbed
                .setDescription(`Qual será o novo ícone?`)
            await i.deferUpdate()
            const authorIcon = await waitForUserInput(newView, {
                embeds: [questionEmbed],
                components: []
            }, defaultTime, filter, defaultOptions).catch(() => undefined)
            if (!authorIcon) {
                errEmbed
                    .setDescription(`Você não respondeu a tempo`)
                return reject(await newView.update({embeds: [errEmbed]}))
            }
            try {
                embed
                    .setAuthor({iconURL: authorIcon, name: embed.data.author?.name as string})
            } catch (e) {
                errEmbed
                    .setDescription(`O icone deve ser um link válido ou um anexo\nTente novamente`)
                await newView.update({embeds: [errEmbed], components: rows})
                return
            }
            await newView.update({embeds: [embed], components: rows})
        })
        newView.on('authorRemove', async (i) => {
            await i.deferUpdate()
            embed
                .setAuthor(null)
            await newView.update({embeds: [embed], components: rows})
        })
        /*
            End of author buttons
         */
        /*
            Start of field buttons
         */
        newView.on('field', async (i) => {
            const fieldEmbed = new EmbedBuilder()
                .setTitle(`Editar campos`)
                .setDescription(`Deseja adicionar, remover ou editar um campo?`)
                .setColor(`#ffffff`)
            const buttonArr = [
                new ButtonBuilder()
                    .setCustomId('addField')
                    .setLabel('Adicionar')
                    .setStyle(ButtonStyle.Success)
            ]
            if ((embed.data.fields?.length as number) > 0) {
                buttonArr.push(
                    new ButtonBuilder()
                        .setCustomId('editField')
                        .setLabel('Editar')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('removeField')
                        .setLabel('Remover')
                        .setStyle(ButtonStyle.Danger)
                )
            }
            const fieldRow = new ActionRowBuilder<ButtonBuilder>()
                .setComponents(buttonArr)
            await i.deferUpdate()
            await newView.update({embeds: [fieldEmbed], components: [fieldRow]})
        })
        newView.on('addField', async (i) => {
            questionEmbed
                .setDescription(`Qual será o nome do campo?`)
            await i.deferUpdate()
            const fieldName = await waitForUserInput(newView, {
                embeds: [questionEmbed],
                components: []
            }, defaultTime, filter, defaultOptions).catch(() => undefined)
            if (!fieldName) {
                errEmbed
                    .setDescription(`Você não respondeu a tempo`)
                return reject(await newView.update({embeds: [errEmbed]}))
            }
            questionEmbed
                .setDescription(`Qual será o valor do campo?`)
            const fieldValue = await waitForUserInput(newView, {
                embeds: [questionEmbed],
                components: []
            }, defaultTime, filter, defaultOptions).catch(() => undefined)
            if (!fieldValue) {
                errEmbed
                    .setDescription(`Você não respondeu a tempo`)
                return reject(await newView.update({embeds: [errEmbed]}))
            }
            try {
                embed
                    .addFields([
                        {name: fieldName, value: fieldValue}
                    ])
            } catch (e) {
                errEmbed
                    .setDescription(`O nome e o valor devem ser textos não muito grandes\nTente novamente`)
                await newView.update({embeds: [errEmbed], components: rows})
                return
            }
            await newView.update({embeds: [embed], components: rows})
        })
        newView.on('removeField', async (i) => {
            const fieldEmbed = new EmbedBuilder()
                .setTitle(`Remover campos`)
                .setDescription(`Qual campo você deseja remover?`)
                .setColor(`#ffffff`)
            const fieldRow = new ActionRowBuilder<StringSelectMenuBuilder>()
                .setComponents([
                    new StringSelectMenuBuilder()
                        .setCustomId('deleteFieldSelect')
                        .setPlaceholder('Selecione um campo')
                        .addOptions(embed.data.fields?.map((field, index) => {
                                return {
                                    label: field.name,
                                    value: index.toString()
                                }
                            }) as any
                        )
                ])
            await i.deferUpdate()
            await newView.update({embeds: [fieldEmbed], components: [fieldRow]})
        })
        newView.on('deleteFieldSelect', async (i) => {
            await i.deferUpdate()
            embed
                .spliceFields(parseInt(i.values[0]), 1)
            await newView.update({embeds: [embed], components: rows})
        })
        newView.on('editField', async (i) => {
            const fieldEmbed = new EmbedBuilder()
                .setTitle(`Editar campos`)
                .setDescription(`Qual campo você deseja editar?`)
                .setColor(`#ffffff`)
            const fieldRow = new ActionRowBuilder<StringSelectMenuBuilder>()
                .setComponents([
                    new StringSelectMenuBuilder()
                        .setCustomId('editFieldSelect')
                        .setPlaceholder('Selecione um campo')
                        .addOptions(embed.data.fields?.map((field, index) => {
                                return {
                                    label: field.name,
                                    value: index.toString()
                                }
                            }) as any
                        )
                ])
            await i.deferUpdate()
            await newView.update({embeds: [fieldEmbed], components: [fieldRow]})
        })
        newView.on('editFieldSelect', async (i) => {
            const fieldEmbed = new EmbedBuilder()
                .setTitle(`Editar campos`)
                .setDescription(`O que você deseja editar no campo ${embed.data.fields?.[parseInt(i.values[0])].name}?`)
                .setColor(`#ffffff`)
            const fieldRow = new ActionRowBuilder<ButtonBuilder>()
                .setComponents([
                    new ButtonBuilder()
                        .setCustomId('editFieldName-' + i.values[0])
                        .setLabel('Nome')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('editFieldValue-' + i.values[0])
                        .setLabel('Valor')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('editFieldInline-' + i.values[0])
                        .setLabel('Inline')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('editFieldPosition-' + i.values[0])
                        .setLabel('Posição')
                        .setStyle(ButtonStyle.Primary)
                ])
            await i.deferUpdate()
            await newView.update({embeds: [fieldEmbed], components: [fieldRow]})
        })
        newView.on('editFieldName', async (i, args) => {
            questionEmbed
                .setDescription(`Qual será o novo nome do campo ${embed.data.fields?.[parseInt(args[0])].name}?`)
            await i.deferUpdate()
            const fieldName = await waitForUserInput(newView, {
                embeds: [questionEmbed],
                components: []
            }, defaultTime, filter, defaultOptions).catch(() => undefined)
            if (!fieldName) {
                errEmbed
                    .setDescription(`Você não respondeu a tempo`)
                return reject(await newView.update({embeds: [errEmbed]}))
            }
            try {
                embed
                    .spliceFields(parseInt(args[0]), 1, {
                        name: fieldName,
                        value: embed.data.fields?.[parseInt(args[0])].value as string
                    })
            } catch (e) {
                errEmbed
                    .setDescription(`O nome deve ser um texto não muito grande\nTente novamente`)
                await newView.update({embeds: [errEmbed], components: rows})
                return
            }
            await newView.update({embeds: [embed], components: rows})
        })
        newView.on('editFieldValue', async (i, args) => {
            questionEmbed
                .setDescription(`Qual será o novo valor do campo ${embed.data.fields?.[parseInt(args[0])].name}?`)
            await i.deferUpdate()
            const fieldValue = await waitForUserInput(newView, {
                embeds: [questionEmbed],
                components: []
            }, defaultTime, filter, defaultOptions).catch(() => undefined)
            if (!fieldValue) {
                errEmbed
                    .setDescription(`Você não respondeu a tempo`)
                return reject(await newView.update({embeds: [errEmbed]}))
            }
            const index = parseInt(args[0])
            try {
                embed
                    .spliceFields(index, 1, {
                        name: embed.data.fields?.[index].name as string,
                        value: fieldValue,
                        inline: embed.data.fields?.[index].inline as boolean
                    })
            } catch (e) {
                errEmbed
                    .setDescription(`O valor deve ser um texto não muito grande\nTente novamente`)
                await newView.update({embeds: [errEmbed], components: rows})
                return
            }
            await newView.update({embeds: [embed], components: rows})
        })
        newView.on('editFieldInline', async (i, args) => {
            await i.deferUpdate()
            const index = parseInt(args[0])
            const field = embed.data.fields?.[index]
            embed
                .spliceFields(index, 1, {
                    name: field?.name as string,
                    value: field?.value as string,
                    inline: !field?.inline
                })
            await newView.update({embeds: [embed], components: rows})
        })
        newView.on('editFieldPosition', async (i, args) => {
            questionEmbed
                .setDescription(`Qual será a nova posição do campo ${embed.data.fields?.[parseInt(args[0])].name}?`)
            await i.deferUpdate()
            const fieldPosition = await waitForUserInput(newView, {
                embeds: [questionEmbed],
                components: []
            }, defaultTime, filter, defaultOptions).catch(() => undefined)
            if (!fieldPosition) {
                errEmbed
                    .setDescription(`Você não respondeu a tempo`)
                return reject(await newView.update({embeds: [errEmbed]}))
            }
            const position = parseInt(fieldPosition)
            if (isNaN(position)) {
                errEmbed
                    .setDescription(`A posição deve ser um número entre 1 e ${embed.data.fields?.length}\nTente novamente`)
                await newView.update({embeds: [errEmbed], components: rows})
                return
            }
            if (position < 1 || position > (embed.data.fields?.length as number)) {
                errEmbed
                    .setDescription(`A posição deve ser um número entre 1 e ${embed.data.fields?.length}\nTente novamente`)
                await newView.update({embeds: [errEmbed], components: rows})
                return
            }
            embed
                .spliceFields(position - 1, 0, {
                    name: embed.data.fields?.[parseInt(args[0])].name as string,
                    value: embed.data.fields?.[parseInt(args[0])].value as string,
                    inline: embed.data.fields?.[parseInt(args[0])].inline as boolean
                })
                .spliceFields(parseInt(i.message.interaction?.values[0]), 1)
            return await newView.update({embeds: [embed], components: rows})
        })

        newView.on('export', async (i) => {
            await i.reply({
                content: `Aqui está o código do seu embed:\n\`\`\`json\n${JSON.stringify(embed.toJSON(), null, 2)}\n\`\`\``,
                ephemeral: true
            })
        })
        newView.on('import', async (i) => {
            questionEmbed
                .setDescription(`Cole o código do seu embed aqui`)
            await i.deferUpdate()
            const embedCode = await waitForUserInput(newView, {
                embeds: [questionEmbed],
                components: []
            }, defaultTime, filter, defaultOptions).catch(() => undefined)
            if (!embedCode) {
                errEmbed
                    .setDescription(`Você não respondeu a tempo`)
                return reject(await newView.update({embeds: [errEmbed]}))
            }
            try {
                const jsonVar = JSON.parse(embedCode)
                try {
                    embed = new EmbedBuilder(jsonVar)
                } catch (e) {
                    errEmbed
                        .setDescription(`O código deve ser um JSON válido\nTente novamente`)
                    await newView.update({embeds: [errEmbed], components: rows})
                    return
                }
            } catch (e) {
                errEmbed
                    .setDescription(`O código deve ser um JSON válido\nTente novamente`)
                await newView.update({embeds: [errEmbed], components: rows})
                return
            }

            await newView.update({embeds: [embed], components: rows})
        })




        if (!options?.shouldComplete) return resolve(embed)
    })

}