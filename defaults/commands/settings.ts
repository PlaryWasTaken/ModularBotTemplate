import SlashCommand from "../../classes/structs/SlashCommand";
import {
    ActionRowBuilder,
    ButtonBuilder, ButtonInteraction,
    Channel,
    ChannelSelectMenuBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    Role,
    RoleSelectMenuBuilder,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    ComponentType, StringSelectMenuInteraction
} from "discord.js";
import fuse from "fuse.js";
import {
    ButtonOption,
    ExtendedClient,
    GenericOption,
    GenericPrimitiveOption,
    ObjectOption,
    SelectOption
} from "../../types";
import Guild from "../../classes/structs/Guild";

function getOptionDisplay(option: GenericOption): { name: string, button: ButtonBuilder } {
    if (!option.value && option.value !== false) throw new Error('Option value is null or undefined')
    const result: {
        name?: string,
        button?: ButtonBuilder
    } = {}
    switch (option.type) {
        case 'boolean':
        case 'button':
            result.name = option.value ? 'Ativado' : 'Desativado'
            result.button = new ButtonBuilder()
                .setCustomId('activate-' + option.type)
                .setLabel(option.value ? 'Desativar' : 'Ativar')
                .setStyle(1)
            break
        case 'text':
        case 'number':
        case "list":
            result.name = option.value?.toString() || 'Nenhum'
            result.button = new ButtonBuilder()
                .setCustomId('edit-' + option.type)
                .setLabel('Editar')
                .setStyle(1)
            break
        case "user":
            result.name = option.value ? `<@${option.value}>` : 'Nenhum'
            result.button = new ButtonBuilder()
                .setCustomId('edit-user')
                .setLabel('Editar')
                .setStyle(1)
            break
        case 'channel':
            result.name = option.value ? `<#${option.value}>` : 'Nenhum'
            result.button = new ButtonBuilder()
                .setCustomId('edit-user')
                .setLabel('Editar')
                .setStyle(1)
            break
        case 'role':
            result.name = option.value ? `<@&${option.value}>` : 'Nenhum'
            result.button = new ButtonBuilder()
                .setCustomId('edit-role')
                .setLabel('Editar')
                .setStyle(1)
            break
        case "object":
            result.name = option.value.map((v) => {
                const Setting = option.structure.find((s) => s.id === v.id)
                if (!Setting) return
                return `${Setting.name} (${Setting.type}): ${v.value}`
            }).join(', ')
            result.button = new ButtonBuilder()
                .setCustomId('edit-object')
                .setLabel('Editar')
                .setStyle(1)
            break
        case "select":
            const values = option.options.filter((o) => (option.value ? option.value?.includes(o.id) : (option.default ? option.default?.includes(o.id) : false)))
            result.name = values.length > 0 ? option.value.map((v) => v).join(', ') : 'Nenhum'
            result.button = new ButtonBuilder()
                .setCustomId('edit-select')
                .setLabel('Editar')
                .setStyle(1)
            break
    }
    return result as { name: string, button: ButtonBuilder }
}

function handleBoolean(embed: EmbedBuilder, setting: GenericPrimitiveOption<"boolean">, interaction: ButtonInteraction | StringSelectMenuInteraction, client: ExtendedClient, guild: Guild) {
    return new Promise<{ interaction: any, value: boolean, embed: EmbedBuilder }>(async (resolve, reject) => {
        const newValue = !setting.value
        await interaction.reply({
            content: `Atualizando configuração...`,
            ephemeral: true
        })
        return resolve({
            interaction: interaction,
            value: newValue,
            embed: embed
        })
    })
}

function handleString(embed: EmbedBuilder, setting: GenericPrimitiveOption<"text">, interaction: ButtonInteraction | StringSelectMenuInteraction, client: ExtendedClient, guild: Guild) {
    return new Promise<{ interaction: any, value: string, embed: EmbedBuilder }>(async (resolve, reject) => {
        if (!interaction.channel) return
        embed.setFooter({text: 'Atualmente editando!'})
        await interaction.update({embeds: [embed], components: []})
        await interaction.followUp({content: 'Digite o novo valor:'})
        const msg = await interaction.channel.awaitMessages({
            filter: (m) => m.author.id === interaction.user.id,
            max: 1,
            time: 60000
        }).catch(async () => {
            return reject('Não respondeu a tempo!')
        })
        if (!msg) return
        const value = msg.first()
        if (!value) return
        resolve({interaction: interaction, value: value.content, embed})
    })
}
function handleRole(embed: EmbedBuilder, setting: GenericPrimitiveOption<"role">, interaction: ButtonInteraction | StringSelectMenuInteraction, client: ExtendedClient, guild: Guild) {
    return new Promise<{ interaction: any, value: string, embed: EmbedBuilder }>(async (resolve, reject) => {
        embed.setFooter({text: 'Atualmente editando!'})
        const row6 = new ActionRowBuilder<RoleSelectMenuBuilder>()
            .setComponents([
                new RoleSelectMenuBuilder()
                    .setCustomId('role')
                    .setPlaceholder('Selecione um cargo')
                    .setMaxValues(1)
            ])
        await interaction.update({embeds: [embed], components: [row6]})
        const msg = await interaction.channel?.awaitMessageComponent({
            filter: (m) => m.user.id === interaction.user.id,
            time: 60000
        })
        if (!msg || !msg.isRoleSelectMenu()) return
        const role = msg.roles.first()
        if (!role) return
        // @ts-ignore
        resolve({interaction: interaction, value: role.id, embed})
    })
}

function handleChannel(embed: EmbedBuilder, setting: GenericPrimitiveOption<"channel">, interaction: ButtonInteraction | StringSelectMenuInteraction, client: ExtendedClient, guild: Guild) {
    return new Promise<{ interaction: any, value: string, embed: EmbedBuilder }>(async (resolve, reject) => {
        embed.setFooter({text: 'Atualmente editando!'})
        const row6 = new ActionRowBuilder<ChannelSelectMenuBuilder>()
            .setComponents([
                new ChannelSelectMenuBuilder()
                    .setCustomId('channel')
                    .setPlaceholder('Selecione um chat')
                    .setMaxValues(1)
            ])
        await interaction.update({embeds: [embed], components: [row6]})
        const msg = await interaction.channel?.awaitMessageComponent({
            filter: (m) => m.user.id === interaction.user.id,
            time: 60000
        })
        if (!msg || !msg.isChannelSelectMenu()) return
        const channel = msg.channels.first()
        if (!channel) return
        // @ts-ignore
        resolve({interaction: interaction, value: channel.id, embed})
    })
}

function handleButton(embed: EmbedBuilder, setting: ButtonOption, interaction: ButtonInteraction | StringSelectMenuInteraction, client: ExtendedClient, guild: Guild) {
    return new Promise<{ interaction: any, value: string, embed: EmbedBuilder }>(async (resolve, reject) => {
        return resolve({interaction: interaction, value: "true", embed})
    })
}

function handleSelect(embed: EmbedBuilder, setting: SelectOption, interaction: ButtonInteraction | StringSelectMenuInteraction, client: ExtendedClient, guild: Guild) {
    return new Promise<{ interaction: any, value: string[], embed: EmbedBuilder }>(async (resolve, reject) => {
        embed.setFooter({text: 'Atualmente editando!'})
        const row6 = new ActionRowBuilder<StringSelectMenuBuilder>()
            .setComponents([
                new StringSelectMenuBuilder()
                    .setCustomId('select')
                    .setPlaceholder('Selecione uma opcão')
                    .setMaxValues(setting.max === 0 ? setting.options.length : setting.max)
                    .setMinValues(setting.min)
                    .setOptions(setting.options.map((o) => {
                        return {
                            label: o.name,
                            value: o.id
                        }
                    }))
            ])
        await interaction.update({embeds: [embed], components: [row6]})
        const msg = await interaction.channel?.awaitMessageComponent({
            filter: (m) => m.user.id === interaction.user.id,
            time: 60000
        })
        if (!msg || !msg.isStringSelectMenu()) return
        const values = msg.values
        if (!values) return
        return resolve({interaction, value: values, embed})
    })
}

function handleUser(embed: EmbedBuilder, setting: GenericPrimitiveOption<"user">, interaction: ButtonInteraction | StringSelectMenuInteraction, client: ExtendedClient, guild: Guild) {
    return new Promise<{ interaction: any, value: string, embed: EmbedBuilder }>(async (resolve, reject) => {
        embed.setFooter({text: 'Atualmente editando!'})
        await interaction.update({embeds: [embed], components: []})
        const msg = await interaction.channel?.awaitMessages({
            filter: (m) => m.author.id === interaction.user.id,
            max: 1,
            time: 60000
        }).catch(async () => {
            return reject('Não respondeu a tempo!')
        })
        if (!msg) return
        const value = msg.first()
        if (!value) return
        const user = value.mentions.members?.first() || await client.users.fetch(value.content).catch(() => null)
        if (!user) {
            return reject('Usuário não encontrado!')
        }
        resolve({interaction: interaction, value: user.id, embed})
    })
}

function handleObject(embed: EmbedBuilder, setting: ObjectOption, interaction: ButtonInteraction | StringSelectMenuInteraction, client: ExtendedClient, guild: Guild) {
    return new Promise(async (resolve, reject) => {
        const options = setting.structure.map((s) => {
            return {
                label: s.name,
                value: s.id
            }
        })
        const row6 = new ActionRowBuilder<StringSelectMenuBuilder>()
            .setComponents([
                new StringSelectMenuBuilder()
                    .setCustomId('select')
                    .setPlaceholder('Selecione uma opcão')
                    .setMaxValues(1)
                    .setMinValues(1)
                    .setOptions(options)
            ])
        await interaction.update({embeds: [embed], components: [row6]})
        const msg = await interaction.channel?.awaitMessageComponent({
            filter: (m) => m.user.id === interaction.user.id,
            time: 60000

        })
        if (!msg || !msg.isStringSelectMenu()) return
        const value = msg.values[0]
        if (!value) return
        const option = setting.structure.find((s) => s.id === value)
        if (!option) return
        const optionDisplayOptions = getOptionDisplay(option)
        const index = setting.structure.findIndex((s) => s.id === value)
        const embed2 = new EmbedBuilder()
            .setTitle(`Configuração: ${option.name}`)
            .setDescription(option.description)
            .setColor('#aaffff')
            .setFooter({text: 'Atualmente editando!'})
            .setFields([
                {
                    name: 'Valor atual',
                    value: setting.value ? [index] + '' : 'Nenhum'
                }
            ])
        await msg.reply({embeds: [embed2], components: []})
        switch (option.type) {
            case 'boolean':

        }

    })
}

export default new SlashCommand({
    data: new SlashCommandBuilder()
        .setDescription(`Mostra todas as configurações do servidor`)
        .addStringOption(option =>
            option
                .setName('configuração')
                .setDescription('Nome da configuração para pesquisar')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .setName('configurações'),
    func: async ({interaction, client, guild}) => {
        if (!interaction.inGuild()) return interaction.reply({
            content: 'Este comando só pode ser usado em servidores',
            ephemeral: true
        });
        const setting = guild.settings.find(setting => setting.id === interaction.options.getString('configuração'));
        if (!setting) return interaction.reply({content: 'Configuração não encontrada.. :(', ephemeral: true});
        const optionDisplayOptions = getOptionDisplay(setting)
        const embed = new EmbedBuilder()
            .setTitle(`Configuração: ${setting.name}`)
            .setDescription(setting.description)
            .setColor('#4040F0')
            .setFields([
                {
                    name: 'Valor atual',
                    value: optionDisplayOptions.name
                }
            ])
        const row3 = new ActionRowBuilder<ButtonBuilder>()
            .setComponents([
                optionDisplayOptions.button
                ])

        const msg = await interaction.reply({embeds: [embed], components: [row3], fetchReply: true})
        const collector = msg.createMessageComponentCollector({
            time: 60000,
            filter: (i) => interaction.user.id === i.user.id,
            componentType: ComponentType.Button
        })
        collector.on('collect', async (i) => {
            if (!i.channel) return
            switch (setting.type) {
                case 'boolean':
                    const result = await handleBoolean(embed, setting as GenericPrimitiveOption<"boolean">, i, client, guild)
                    await client.settingsHandler.setSetting(guild, setting.id, JSON.stringify(result.value))
                        .then(async () => {
                            embed.setFooter(null)
                            embed.setFields([
                                {
                                    name: 'Valor atual',
                                    value: result ? 'Ativado' : 'Desativado'
                                }
                            ])
                            await i.message.edit({embeds: [embed], components: []})
                        })
                        .catch(async (err) => {
                            embed.setFooter(null)
                            await i.message.edit({embeds: [embed], components: []})
                            i.editReply({content: 'Ocorreu um erro ao atualizar a configuração!\n' + err.reason})
                            return
                        })
                    break;
                case 'number':
                case 'text':
                    const result2 = await handleString(embed, setting as GenericPrimitiveOption<"text">, i, client, guild).catch((err) => err + '')
                    if (typeof result2 === 'string') {
                        i.editReply({content: result2})
                        return
                    }
                    await client.settingsHandler.setSetting(guild, setting.id, JSON.stringify(result2.value))
                        .then(async () => {
                            embed.setFooter(null)
                            embed.setFields([
                                {
                                    name: 'Valor atual',
                                    value: result2.value || 'Nenhum'
                                }
                            ])
                            await i.message.edit({embeds: [embed], components: []})
                        })
                        .catch(async (err) => {
                            embed.setFooter(null)
                            await i.message.edit({embeds: [embed], components: []})
                            i.editReply({content: 'Ocorreu um erro ao atualizar a configuração!\n' + err.reason})
                            return
                        })
                    break;
                    case 'role':
                    const result3 = await handleRole(embed, setting as GenericPrimitiveOption<"role">, i, client, guild).catch((err) => err + '')
                    if (typeof result3 === 'string') {
                        i.editReply({content: result3})
                        return
                    }
                    await client.settingsHandler.setSetting(guild, setting.id, JSON.stringify(result3.value))
                        .then(async () => {
                            embed.setFooter(null)
                            embed.setFields([
                                {
                                    name: 'Valor atual',
                                    value: result3.value ? `<@&${result3.value}>` : 'Nenhum'
                                }
                            ])
                            await i.message.edit({embeds: [embed], components: []})
                        })
                        .catch(async (err) => {
                            embed.setFooter(null)
                            await i.message.edit({embeds: [embed], components: []})
                            i.editReply({content: 'Ocorreu um erro ao atualizar a configuração!\n' + err.reason})
                            return
                        })
                    break;
                    case 'channel':
                    const result4 = await handleChannel(embed, setting as GenericPrimitiveOption<"channel">, i, client, guild).catch((err) => err + '')
                    if (typeof result4 === 'string') {
                        i.editReply({content: result4})
                        return
                    }
                    await client.settingsHandler.setSetting(guild, setting.id, JSON.stringify(result4.value))
                        .then(async () => {
                            embed.setFooter(null)
                            embed.setFields([
                                {
                                    name: 'Valor atual',
                                    value: result4.value ? `<#${result4.value}>` : 'Nenhum'
                                }
                            ])
                            await i.message.edit({embeds: [embed], components: []})
                        })
                        .catch(async (err) => {
                            embed.setFooter(null)
                            await i.message.edit({embeds: [embed], components: []})
                            i.editReply({content: 'Ocorreu um erro ao atualizar a configuração!\n' + err.reason})
                            return
                        })
                    break;
                    case 'user':
                    const result5 = await handleUser(embed, setting as GenericPrimitiveOption<"user">, i, client, guild).catch((err) => err + '')
                    if (typeof result5 === 'string') {
                        i.editReply({content: result5})
                        return
                    }
                    await client.settingsHandler.setSetting(guild, setting.id, JSON.stringify(result5.value))
                        .then(async () => {
                            embed.setFooter(null)
                            embed.setFields([
                                {
                                    name: 'Valor atual',
                                    value: result5.value ? `<@${result5.value}>` : 'Nenhum'
                                }
                            ])
                            await i.message.edit({embeds: [embed], components: []})
                        })
                        .catch(async (err) => {
                            embed.setFooter(null)
                            await i.message.edit({embeds: [embed], components: []})
                            i.editReply({content: 'Ocorreu um erro ao atualizar a configuração!\n' + err.reason})
                            return
                        })
                    break;
                case "select":
                    const result6 = await handleSelect(embed, setting as SelectOption, i, client, guild).catch((err) => err + '')
                    if (typeof result6 === 'string') {
                        i.editReply({content: result6})
                        return
                    }
                    await client.settingsHandler.setSetting(guild, setting.id, JSON.stringify(result6.value))
                        .then(async () => {
                            embed.setFooter(null)
                            embed.setFields([
                                {
                                    name: 'Valor atual',
                                    value: result6.value.join(',') || 'Nenhum'
                                }
                            ])
                            await i.message.edit({embeds: [embed], components: []})
                        })
                        .catch(async (err) => {
                            embed.setFooter(null)
                            await i.message.edit({embeds: [embed], components: []})
                            i.editReply({content: 'Ocorreu um erro ao atualizar a configuração!\n' + err.reason})
                            return
                        })
                    break;
                case "button":
                    const result7 = await handleButton(embed, setting as ButtonOption, i, client, guild).catch((err) => err + '')
                    if (typeof result7 === 'string') {
                        i.editReply({content: result7})
                        return
                    }
                    await client.settingsHandler.setSetting(guild, setting.id, JSON.stringify(result7.value))
                        .then(async () => {
                            embed.setFooter(null)
                            embed.setFields([
                                {
                                    name: 'Valor atual',
                                    value: result7.value || 'Nenhum'
                                }
                            ])
                            await i.message.edit({embeds: [embed], components: []})
                        })
                        .catch(async (err) => {
                            embed.setFooter(null)
                            await i.message.edit({embeds: [embed], components: []})
                            i.editReply({content: 'Ocorreu um erro ao atualizar a configuração!\n' + err.reason})
                            return
                        })
                    break;
                case "object":
                    const result8 = await handleObject(embed, setting as ObjectOption, i, client, guild).catch((err) => err + '')
                    break;

            }
        })
    },
    global: true,
    autoCompleteFunc: async ({interaction, client}) => {
        if (!interaction.inGuild()) return interaction.respond([{
            name: 'Este comando só pode ser usado em servidores',
            value: 'null'
        }]);
        const guildData = await client.guildHandler.fetchOrCreate(interaction.guildId);
        const result = new fuse(guildData.settings, {
            keys: ['name', 'id'],
            includeScore: true,
            threshold: 0.3
        })
        const settings = result.search(interaction.options.getString('configuração') || 'a').map(result => result.item);
        await interaction.respond(settings.map(setting => {
            return {
                name: `${setting.name} (${setting.type})`,
                value: setting.id
            }
        }))
    }
})
/*
switch (setting.type) {
            case 'boolean':
                const result8 = await handleBoolean(embed, setting as GenericPrimitiveOption<"boolean">, interaction, client, guild)
                await client.settingsHandler.setSetting(guild, setting.id, JSON.stringify(result8.value))
                    .then(async () => {
                        await result8.interaction.editReply({content: 'Configuração atualizada!'})
                        embed.setFooter(null)
                        embed.setFields([
                            {
                                name: 'Valor atual',
                                value: result8.value ? 'Ativado' : 'Desativado'
                            }
                        ])
                        await result8.interaction.message.edit({embeds: [embed], components: []})
                    })
                    .catch(async (err) => {
                        embed.setFooter(null)
                        await result8.interaction.message.edit({embeds: [embed], components: []})
                        return result8.interaction.editReply({content: 'Ocorreu um erro ao atualizar a configuração!\n' + err.reason})
                    })
                break;
            case 'text':
                const result7 = await handleString(embed, setting as GenericPrimitiveOption<"text">, interaction, client, guild)
                await client.settingsHandler.setSetting(guild, setting.id, result7.value)
                    .then(async () => {
                        await result7.interaction.editReply({content: 'Configuração atualizada!'})
                        embed.setFooter(null)
                        embed.setFields([
                            {
                                name: 'Valor atual',
                                value: result7.value
                            }
                        ])
                        await result7.interaction.message.edit({embeds: [embed], components: []})
                    })
                    .catch(async (err) => {
                        embed.setFooter(null)
                        await result7.interaction.message.edit({embeds: [embed], components: []})
                        return result7.interaction.editReply({content: 'Ocorreu um erro ao atualizar a configuração!\n' + err.reason})
                    })
                break;
            case 'number':
                const result6 = await handleNumber(embed, setting as GenericPrimitiveOption<"number">, interaction, client, guild)
                await client.settingsHandler.setSetting(guild, setting.id, JSON.stringify(result6.value))
                    .then(async () => {
                        await result6.interaction.editReply({content: 'Configuração atualizada!'})
                        embed.setFooter(null)
                        embed.setFields([
                            {
                                name: 'Valor atual',
                                value: result6.value
                            }
                        ])
                        await result6.interaction.message.edit({embeds: [embed], components: []})
                    })
                    .catch(async (err) => {
                        embed.setFooter(null)
                        await result6.interaction.message.edit({embeds: [embed], components: []})
                        return result6.interaction.editReply({content: 'Ocorreu um erro ao atualizar a configuração!\n' + err.reason})
                    })
                break;
            case 'role':
                const result5 = await handleRole(embed, setting as GenericPrimitiveOption<"role">, interaction, client, guild)
                await client.settingsHandler.setSetting(guild, setting.id, result5.value.id)
                    .then(async () => {
                        await result5.interaction.editReply({content: 'Configuração atualizada!'})
                        embed.setFooter(null)
                        embed.setFields([
                            {
                                name: 'Valor atual',
                                value: result5.value.toString()
                            }
                        ])
                        await result5.interaction.message.edit({embeds: [embed], components: []})
                    })
                    .catch(async (err) => {
                        embed.setFooter(null)
                        await result5.interaction.message.edit({embeds: [embed], components: []})
                        result5.interaction.editReply({content: 'Ocorreu um erro ao atualizar a configuração!\n' + err.reason})
                        return
                    })
                break;
            case "channel":
                const result4 = await handleChannel(embed, setting as GenericPrimitiveOption<"channel">, interaction, client, guild)
                await client.settingsHandler.setSetting(guild, setting.id, result4.value.id)
                    .then(async () => {
                        await result4.interaction.editReply({content: 'Configuração atualizada!'})
                        embed.setFooter(null)
                        embed.setFields([
                            {
                                name: 'Valor atual',
                                value: result4.value.toString()
                            }
                        ])
                        await result4.interaction.message.edit({embeds: [embed], components: []})
                    })
                    .catch(async (err) => {
                        embed.setFooter(null)
                        await result4.interaction.message.edit({embeds: [embed], components: []})
                        result4.interaction.editReply({content: 'Ocorreu um erro ao atualizar a configuração!\n' + err.reason})
                        return
                    })
                break;
            case "button":
                const result3 = await handleButton(embed, setting, interaction, client, guild)
                await client.settingsHandler.setSetting(guild, setting.id, 'true')
                    .then(async () => {
                        await result3.interaction.editReply({content: 'Efetuado!'})
                        await result3.interaction.message.edit({embeds: [embed]})
                    })
                    .catch(async (err) => {
                        result3.interaction.editReply({content: 'Ocorreu um erro ao atualizar a configuração!\n' + err.reason})
                        return
                    })
                break;
            case "select":
                const result2 = await handleSelect(embed, setting, interaction, client, guild)
                await client.settingsHandler.setSetting(guild, setting.id, JSON.stringify(result2.value))
                    .then(async () => {
                        const currentValues = setting.options.filter((o) => result2.value ? result2.value.includes(o.id): false)
                        await result2.interaction.editReply({content: 'Configuração atualizada!'})
                        result2.embed.setFooter(null)
                        result2.embed.setFields([
                            {
                                name: 'Valor atual',
                                value: currentValues.length > 0 ? currentValues.map((v) => v.name).join(', ') : 'Nenhum'
                            }
                        ])
                        await result2.interaction.message.edit({embeds: [result2.embed], components: []})
                    })
                    .catch(async (err) => {
                        result2.embed.setFooter(null)
                        await result2.interaction.message.edit({embeds: [result2.embed], components: []})
                        result2.interaction.editReply({content: 'Ocorreu um erro ao atualizar a configuração!\n' + err.reason})
                        return
                    })
                break;
            case "user":
                const result = await handleUser(embed, setting as GenericPrimitiveOption<"user">, interaction, client, guild)
                await client.settingsHandler.setSetting(guild, setting.id, result.value)
                    .then(async () => {
                        await result.interaction.editReply({content: 'Configuração atualizada!'})
                        embed.setFooter(null)
                        embed.setFields([
                            {
                                name: 'Valor atual',
                                value: `<@${result.value}>`
                            }
                        ])
                        await result.interaction.message.edit({embeds: [embed], components: []})
                    })
                    .catch(async (err) => {
                        embed.setFooter(null)
                        await result.interaction.message.edit({embeds: [embed], components: []})
                        return result.interaction.editReply({content: 'Ocorreu um erro ao atualizar a configuração!\n' + err.reason})
                    })
                break;
            case "object":
                await handleObject(embed, setting as ObjectOption, interaction, client, guild)
                break;
        }
 */