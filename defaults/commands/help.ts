import SlashCommand from "../../classes/structs/SlashCommand";
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    EmbedBuilder,
    GuildMember,
    PermissionsBitField,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    TextBasedChannel,
    TextChannel,
} from "discord.js";
import fuse from "fuse.js";
import { InteractionView } from "../../util/InteractionView";
import { arrayChunk } from "../../util/arrayRelated";
import Command from "../../classes/structs/Command";
import { ExtendedClient, Module } from "../../types";
import Guild from "../../classes/structs/Guild";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT   = '#5865F2' as const  // Discord blurple — consistent brand color
const SUCCESS  = '#57F287' as const
const DANGER   = '#ED4245' as const
const NEUTRAL  = '#4F545C' as const
const UNKNOWN  = '#99AAB5' as const

const BULLET   = '›'
const DIVIDER  = '⎯'.repeat(30)

// ─── Locale ───────────────────────────────────────────────────────────────────

const locales = ['pt-BR', 'en-US']
const i18n = new Map([
    ['pt-BR', new Map([
        ['command',     'Comando'],
        ['howToUse',    'Como usar'],
        ['aliases',     'Formas alternativas'],
        ['options',     'Opções'],
        ['required',    'Obrigatório'],
        ['none',        'Nenhuma'],
        ['type.text',   'Texto'],
        ['type.slash',  'Slash'],
        ['back',        '← Voltar'],
        ['permissions', '🔒 Permissões'],
        ['modules',     'Módulos'],
        ['noDesc',      'Sem descrição'],
        ['noModules',   'Nenhum módulo disponível'],
    ])],
    ['en-US', new Map([
        ['command',     'Command'],
        ['howToUse',    'How to use'],
        ['aliases',     'Aliases'],
        ['options',     'Options'],
        ['required',    'Required'],
        ['none',        'None'],
        ['type.text',   'Text'],
        ['type.slash',  'Slash'],
        ['back',        '← Back'],
        ['permissions', '🔒 Permissions'],
        ['modules',     'Modules'],
        ['noDesc',      'No description'],
        ['noModules',   'No modules available'],
    ])],
])

function t(locale: string, key: string): string {
    const resolved = locales.includes(locale) ? locale : 'pt-BR'
    return i18n.get(resolved)?.get(key) ?? i18n.get('pt-BR')!.get(key) ?? key
}

// ─── Permission helpers ───────────────────────────────────────────────────────

/**
 * Checks whether a member can see a given Help path.
 * Falls back to true when no rule is configured (unknown/abstained).
 */
async function canSee(
    path: string,
    client: ExtendedClient,
    guild: Guild,
    member: GuildMember,
    channel: TextChannel,
    cache: Map<string, string[]>
): Promise<boolean> {
    const result = await client.permissionHandler.resolve(
        path,
        guild.permissionOverrides,
        member,
        channel,
        cache
    )
    if (result.status === 'denied')  return false
    if (result.status === 'granted') return true
    return true // unknown/abstained → visible by default
}

/**
 * Builds a rich permission debug embed for a specific command path.
 */
async function buildPermissionEmbed(
    commandName: string,
    client: ExtendedClient,
    guild: Guild,
    member: GuildMember,
    channel: TextChannel,
    locale: string
): Promise<EmbedBuilder> {
    const permPath = `Commands.${commandName}`
    const cache    = new Map<string, string[]>()

    const result   = await client.permissionHandler.resolve(permPath, guild.permissionOverrides, member, channel, cache)
    const subjects = await client.permissionHandler.resolveSubjects(guild.permissionOverrides, member, channel, cache)
    const entry    = guild.permissionOverrides.getEndNode(permPath)
    const subjectSet = new Set(subjects)

    const relevantAllow = entry?.allow.filter(id => subjectSet.has(id)) ?? []
    const relevantDeny  = entry?.deny.filter(id => subjectSet.has(id)) ?? []

    const statusConfig = {
        granted:   { color: SUCCESS,  emoji: '✅', label: 'Permitido' },
        denied:    { color: DANGER,   emoji: '❌', label: 'Negado' },
        unknown:   { color: UNKNOWN,  emoji: '❓', label: 'Caminho não configurado' },
        abstained: { color: NEUTRAL,  emoji: '⬜', label: 'Sem regra correspondente' },
    }
    const s = statusConfig[result.status]

    const embed = new EmbedBuilder()
        .setColor(s.color)
        .setTitle(`${s.emoji}  Permissões — \`${commandName}\``)
        .setDescription([
            `**Status:** ${s.label}`,
            `**Caminho:** \`${permPath}\``,
            DIVIDER,
        ].join('\n'))

    // Active subjects
    embed.addFields({
        name: `Seus resolvers ativos (${subjects.length})`,
        value: subjects.length > 0
            ? subjects.map(s => `\`${s}\``).join('\n')
            : '_Nenhum resolver ativo_',
        inline: false,
    })

    // Relevant allow/deny
    if (relevantAllow.length > 0) {
        embed.addFields({
            name: '✅ Permitido por',
            value: relevantAllow.map(id => `${BULLET} \`${id}\``).join('\n'),
            inline: true,
        })
    }
    if (relevantDeny.length > 0) {
        embed.addFields({
            name: '❌ Negado por',
            value: relevantDeny.map(id => `${BULLET} \`${id}\``).join('\n'),
            inline: true,
        })
    }

    // Meta
    if (Object.keys(result.meta).length > 0) {
        embed.addFields({
            name: '📦 Meta ativa',
            value: Object.entries(result.meta)
                .map(([k, v]) => `\`${k}\` → \`${v}\``)
                .join('\n'),
            inline: false,
        })
    }

    // All overrides for this path (not just member-relevant ones) for admin context
    if (entry && (entry.allow.length > 0 || entry.deny.length > 0)) {
        const allRules: string[] = []
        if (entry.allow.length > 0) allRules.push(`**Allow:** ${entry.allow.map(id => `\`${id}\``).join(', ')}`)
        if (entry.deny.length > 0)  allRules.push(`**Deny:** ${entry.deny.map(id => `\`${id}\``).join(', ')}`)
        embed.addFields({
            name: '📋 Todas as regras configuradas',
            value: allRules.join('\n'),
            inline: false,
        })
    }

    embed.setFooter({ text: `Canal: #${channel.name}` })
    return embed
}

// ─── Command embed builders ───────────────────────────────────────────────────

function buildTextCommandEmbed(command: Command, locale: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(ACCENT)
        .setTitle(`${t(locale, 'command')}: ${command.name}`)
        .setDescription(command.description || t(locale, 'noDesc'))
        .addFields(
            {
                name: t(locale, 'howToUse'),
                value: command.howToUse ? `\`${command.howToUse}\`` : t(locale, 'none'),
            },
            {
                name: t(locale, 'aliases'),
                value: command.aliases.length > 0
                    ? command.aliases.map(a => `\`${a}\``).join(', ')
                    : t(locale, 'none'),
            },
            {
                name: '🔤 Tipo',
                value: t(locale, 'type.text'),
                inline: true,
            }
        )
}

function buildSlashCommandEmbed(command: SlashCommand, locale: string): EmbedBuilder {
    const data    = command.data.toJSON()
    const name    = (data.name_localizations as any)?.[locale] as string | undefined || data.name
    const desc    = (data.description_localizations as any)?.[locale] as string || data.description

    const options = data.options?.map(opt => {
        const optName = (opt.name_localizations as any)?.[locale] as string || opt.name
        const optDesc = (opt.description_localizations as any)?.[locale] as string || opt.description
        const req     = opt.required ? ` *${t(locale, 'required')}*` : ''
        return `${BULLET} **${optName}**${req} — ${optDesc}`
    }).join('\n') || t(locale, 'none')

    return new EmbedBuilder()
        .setColor(ACCENT)
        .setTitle(`${t(locale, 'command')}: /${name}`)
        .setDescription(desc || t(locale, 'noDesc'))
        .addFields(
            {
                name: t(locale, 'options'),
                value: options,
            },
            {
                name: '⚡ Tipo',
                value: t(locale, 'type.slash'),
                inline: true,
            }
        )
}

// ─── UI builders ─────────────────────────────────────────────────────────────

function backButton(locale: string, disabled = false): ButtonBuilder {
    return new ButtonBuilder()
        .setCustomId('main')
        .setLabel(t(locale, 'back'))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled)
}

function permissionsButton(locale: string, commandType: string, commandName: string): ButtonBuilder {
    return new ButtonBuilder()
        .setCustomId(`viewPerms-${commandType}-${commandName}`)
        .setLabel(t(locale, 'permissions'))
        .setStyle(ButtonStyle.Secondary)
}

function paginationRow(currentIndex: number, totalPages: number): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().setComponents([
        new ButtonBuilder()
            .setCustomId('main')
            .setLabel('← Módulos')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`backPageSelect-${currentIndex - 1}`)
            .setLabel('‹')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentIndex <= 0),
        new ButtonBuilder()
            .setCustomId(`nextPageSelect-${currentIndex + 1}`)
            .setLabel('›')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentIndex >= totalPages - 1),
    ])
}

// ─── Command ──────────────────────────────────────────────────────────────────

export default new SlashCommand({
    data: new SlashCommandBuilder()
        .setName('ajuda')
        .setNameLocalizations({ 'pt-BR': 'ajuda', 'en-US': 'help' })
        .setDescription('Mostra todos os comandos do bot ou informações sobre um comando específico')
        .setDescriptionLocalizations({
            'pt-BR': 'Mostra todos os comandos do bot ou informações sobre um comando específico',
            'en-US': 'Shows all commands or information about a specific command',
        })
        .addStringOption(option =>
            option
                .setName('comando')
                .setNameLocalizations({ 'pt-BR': 'comando', 'en-US': 'command' })
                .setDescription('Nome do comando para pesquisar')
                .setDescriptionLocalizations({
                    'pt-BR': 'Nome do comando para pesquisar',
                    'en-US': 'Command name to search for',
                })
                .setRequired(false)
                .setAutocomplete(true)
        ),

    func: async ({ interaction, client, guild }) => {
        const locale  = interaction.locale
        const member  = interaction.member as GuildMember
        const channel = interaction.channel as TextChannel
        const cache   = new Map<string, string[]>() // shared subject cache for this interaction

        const option = interaction.options.getString('comando')

        // ── Direct command lookup ─────────────────────────────────────────────
        if (option) {
            const [commandType, commandName] = option.split('-')

            // Permission check for direct lookup
            const visible = await canSee(`Help.Commands.${commandName}`, client, guild, member, channel, cache)
            if (!visible) {
                return interaction.reply({
                    content: '❌ Você não tem acesso a informações sobre este comando.',
                    ephemeral: true,
                })
            }

            if (commandType === 'text') {
                const command = client.commands.text.get(commandName)
                if (!command) return interaction.reply({ content: 'Comando não encontrado.', ephemeral: true })
                return interaction.reply({ embeds: [buildTextCommandEmbed(command, locale)], ephemeral: true })
            } else {
                const command = client.commands.slash.get(commandName)
                if (!command) return interaction.reply({ content: 'Comando não encontrado.', ephemeral: true })
                return interaction.reply({ embeds: [buildSlashCommandEmbed(command, locale)], ephemeral: true })
            }
        }

        // ── Browse mode ───────────────────────────────────────────────────────

        // Filter modules: hidden flag + Help.Module.<name> permission
        const visibleModules = await Promise.all(
            client.modules
                .filter(m => !m.interfacer.hidden && (m.commands?.text.size || m.commands?.slash.size))
                .map(async m => {
                    const allowed = await canSee(`Help.Module.${m.name}`, client, guild, member, channel, cache)
                    return allowed ? m : null
                })
        ).then(results => results.filter((m): m is Module => m !== null))

        if (visibleModules.length === 0) {
            return interaction.reply({
                content: t(locale, 'noModules'),
                ephemeral: true,
            })
        }

        // ── Main embed ────────────────────────────────────────────────────────
        const mainEmbed = new EmbedBuilder()
            .setColor(ACCENT)
            .setTitle(`📚  ${t(locale, 'modules')}`)
            .setDescription(
                visibleModules.map(m => {
                    const name = m.interfacer.publicName || m.name
                    const desc = m.interfacer.publicDescription || m.description
                    const textCount  = m.commands?.text.filter((cmd, key) => !cmd.aliases.includes(key) && cmd.shouldAppearInHelp).size ?? 0
                    const slashCount = m.commands?.slash.filter(cmd => cmd.shouldAppearInHelp).size ?? 0
                    const cmdCount   = textCount + slashCount
                    return `**${name}** — ${desc}\n${BULLET} ${cmdCount} comando${cmdCount !== 1 ? 's' : ''}`
                }).join('\n\n') || t(locale, 'noModules')
            )
            .setFooter({ text: `${visibleModules.length} módulo${visibleModules.length !== 1 ? 's' : ''} disponíve${visibleModules.length !== 1 ? 'is' : 'l'}` })

        const moduleSelectRow = new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
            new StringSelectMenuBuilder()
                .setCustomId('moduleSelect')
                .setPlaceholder('Selecione um módulo...')
                .setOptions(visibleModules.map(m => ({
                    label: m.interfacer.publicName || m.name,
                    description: (m.interfacer.publicDescription || m.description).slice(0, 100),
                    value: m.name,
                })))
        )

        const view = new InteractionView(interaction, interaction.channel as TextBasedChannel, client, {
            filter: i => i.user.id === interaction.user.id,
        })

        await view.update({ embeds: [mainEmbed], components: [moduleSelectRow] })

        // Pagination state — cleared on each module selection
        type PageData = {
            embed: EmbedBuilder
            commands: { label: string; value: string; name: string; command: Command | SlashCommand }[]
        }
        let pages: PageData[] = []
        let currentCommandType = ''
        let currentCommandName = ''

        // ── Module selected ───────────────────────────────────────────────────
        view.on('moduleSelect', async i => {
            const module = visibleModules.find(m => m.name === i.values[0])
            if (!module) return
            await i.deferUpdate()

            // Filter commands by Help.Commands.<name> permission, in parallel
            const textCandidates = module.commands?.text
                .filter((_, key) => {
                    const cmd = module.commands!.text.get(key)!
                    return !cmd.aliases.includes(key) && cmd.shouldAppearInHelp
                })
                .map(cmd => ({ label: cmd.name, value: `text-${cmd.name}`, name: cmd.name, command: cmd as Command | SlashCommand }))
                .values() ?? []

            const slashCandidates = module.commands?.slash
                .filter(cmd => cmd.shouldAppearInHelp)
                .map(cmd => ({ label: `/${cmd.data.name}`, value: `slash-${cmd.data.name}`, name: cmd.data.name, command: cmd as Command | SlashCommand }))
                .values() ?? []

            const allCandidates = [...textCandidates, ...slashCandidates]

            const filtered = (await Promise.all(
                allCandidates.map(async entry => {
                    const ok = await canSee(`Help.Commands.${entry.name}`, client, guild, member, channel, cache)
                    return ok ? entry : null
                })
            )).filter((e): e is typeof allCandidates[number] => e !== null)

            // Rebuild pages
            pages = arrayChunk(filtered, 24).map((chunk, idx, arr) => ({
                embed: new EmbedBuilder()
                    .setColor(ACCENT)
                    .setTitle(`${module.interfacer.publicName || module.name}`)
                    .setDescription(
                        chunk.map(c => `${BULLET} **${c.label}**`).join('\n') || '_Nenhum comando disponível_'
                    )
                    .setFooter({ text: `Página ${idx + 1} de ${arr.length} ${BULLET} ${filtered.length} comando${filtered.length !== 1 ? 's' : ''}` }),
                commands: chunk,
            }))

            if (pages.length === 0) {
                await view.update({
                    embeds: [new EmbedBuilder()
                        .setColor(NEUTRAL)
                        .setTitle(module.interfacer.publicName || module.name)
                        .setDescription('_Nenhum comando disponível para você neste módulo._')
                    ],
                    components: [new ActionRowBuilder<ButtonBuilder>().setComponents(backButton(locale))],
                })
                return
            }

            const commandSelect = new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('commandSelect')
                    .setPlaceholder('Selecione um comando...')
                    .setOptions(pages[0].commands.map(c => ({ label: c.label, value: c.value })))
            )

            await view.update({
                embeds: [pages[0].embed],
                components: [paginationRow(0, pages.length), commandSelect],
            })
        })

        // ── Pagination ────────────────────────────────────────────────────────
        const goToPage = async (i: ButtonInteraction, index: number) => {
            const page = pages[index]
            if (!page) return
            await i.deferUpdate()

            const commandSelect = new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('commandSelect')
                    .setPlaceholder('Selecione um comando...')
                    .setOptions(page.commands.map(c => ({ label: c.label, value: c.value })))
            )

            await view.update({
                embeds: [page.embed],
                components: [paginationRow(index, pages.length), commandSelect],
            })
        }

        view.on('nextPageSelect', (i: ButtonInteraction, args: string[]) => goToPage(i, parseInt(args[0])))
        view.on('backPageSelect', (i: ButtonInteraction, args: string[]) => goToPage(i, parseInt(args[0])))

        // ── Back to main ──────────────────────────────────────────────────────
        view.on('main', async i => {
            await i.deferUpdate()
            pages = []
            await view.update({ embeds: [mainEmbed], components: [moduleSelectRow] })
        })

        // ── Command selected ──────────────────────────────────────────────────
        view.on('commandSelect', async i => {
            const [type, name] = i.values[0].split('-')
            currentCommandType = type
            currentCommandName = name

            await i.deferUpdate()

            let embed: EmbedBuilder
            if (type === 'text') {
                const command = client.commands.text.get(name)
                if (!command) return
                embed = buildTextCommandEmbed(command, locale)
            } else {
                const command = client.commands.slash.get(name)
                if (!command) return
                embed = buildSlashCommandEmbed(command, locale)
            }

            const detailRow = new ActionRowBuilder<ButtonBuilder>().setComponents(
                backButton(locale),
                permissionsButton(locale, type, name)
            )

            await view.update({ embeds: [embed], components: [detailRow] })
        })

        // ── Permissions view ──────────────────────────────────────────────────
        view.on('viewPerms', async (i: ButtonInteraction, args: string[]) => {
            const [type, name] = args
            await i.deferUpdate()

            const embed = await buildPermissionEmbed(name, client, guild, member, channel, locale)

            const backRow = new ActionRowBuilder<ButtonBuilder>().setComponents(
                new ButtonBuilder()
                    .setCustomId(`backToCommand-${type}-${name}`)
                    .setLabel('← Voltar ao comando')
                    .setStyle(ButtonStyle.Secondary)
            )

            await view.update({ embeds: [embed], components: [backRow] })
        })

        // ── Back to command detail from permissions ────────────────────────────
        view.on('backToCommand', async (i: ButtonInteraction, args: string[]) => {
            const [type, name] = args
            await i.deferUpdate()

            let embed: EmbedBuilder
            if (type === 'text') {
                const command = client.commands.text.get(name)
                if (!command) return
                embed = buildTextCommandEmbed(command, locale)
            } else {
                const command = client.commands.slash.get(name)
                if (!command) return
                embed = buildSlashCommandEmbed(command, locale)
            }

            const detailRow = new ActionRowBuilder<ButtonBuilder>().setComponents(
                backButton(locale),
                permissionsButton(locale, type, name)
            )

            await view.update({ embeds: [embed], components: [detailRow] })
        })
    },

    // ── Autocomplete ──────────────────────────────────────────────────────────
    autoCompleteFunc: async ({ interaction, client, guild, logger }) => {
        logger.debug('Help autocomplete called')
        const text   = interaction.options.getString('comando') || ''
        const member = interaction.member as GuildMember
        const channel = interaction.channel as TextChannel
        const cache  = new Map<string, string[]>()

        // Try module name match first
        const moduleFuse = new fuse(
            client.modules.filter(m => !m.interfacer.hidden).map(m => m.name),
            { includeScore: true, threshold: 0.85 }
        )
        const matchedModule = moduleFuse.search(text)[0]?.item

        let candidates: { name: string; value: string }[] = []

        if (matchedModule) {
            const mod = client.modules.get(matchedModule)
            if (mod) {
                const textCmds = mod.commands?.text.map((cmd, key) => {
                    if (cmd.aliases.includes(key) || !cmd.shouldAppearInHelp) return null
                    return { name: `[${mod.name} · Texto] ${cmd.name}`, value: `text-${cmd.name}` }
                }).filter(Boolean) as { name: string; value: string }[] ?? []

                const slashCmds = mod.commands?.slash.map(cmd => {
                    if (!cmd.shouldAppearInHelp) return null
                    return { name: `[${mod.name} · Slash] /${cmd.data.name}`, value: `slash-${cmd.data.name}` }
                }).filter(Boolean) as { name: string; value: string }[] ?? []

                candidates = [...textCmds, ...slashCmds]
            }
        } else {
            const seen = new Set<string>()
            const textCmds = client.commands.text.map((cmd, key) => {
                if (seen.has(cmd.name) || !cmd.shouldAppearInHelp) return null
                seen.add(cmd.name)
                return { name: `[${cmd.module} · Texto] ${cmd.name}`, value: `text-${cmd.name}` }
            }).filter(Boolean) as { name: string; value: string }[]

            const slashCmds = client.commands.slash
                .filter(cmd => cmd.shouldAppearInHelp && interaction.memberPermissions?.has(
                    BigInt(cmd.data.default_member_permissions || PermissionsBitField.Flags.SendMessages)
                ))
                .map(cmd => ({ name: `[${cmd.module} · Slash] /${cmd.data.name}`, value: `slash-${cmd.data.name}` }))

            candidates = [...textCmds, ...slashCmds]
        }

        // Filter by Help.Commands.* permission
        const allowed = (await Promise.all(
            candidates.map(async c => {
                const cmdName = c.value.split('-')[1]
                const ok = await canSee(`Help.Commands.${cmdName}`, client, guild as any, member, channel, cache)
                return ok ? c : null
            })
        )).filter((c): c is { name: string; value: string } => c !== null)

        // Fuzzy search on remaining
        const result = text
            ? new fuse(allowed, { keys: ['name'], includeScore: true, threshold: 0.6 }).search(text).map(r => r.item)
            : allowed

        await interaction.respond(result.slice(0, 25)).catch(() => {})
    },

    global: true,
})