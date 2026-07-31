import SlashCommand from "../../classes/structs/SlashCommand";
import {
    SlashCommandBuilder,
    PermissionsBitField,
    EmbedBuilder,
    TextChannel, MessageFlags,
} from "discord.js";
import yaml from "yaml";
import {  Permissions } from "../../classes/structs/Permissions";
import { compileOverrides, decompilePermissions, OverrideConfig } from "../../util/PermissionCompilation";
import axios from "axios";
import { parseToDatabase } from "../../util/parsingRelated";

export function tryParseYAML(value: string): any {
    try {
        return yaml.parse(value);
    } catch (e) {
        return null;
    }
}

export default new SlashCommand({
    data: new SlashCommandBuilder()
        .setName('permissões')
        .setDescription(`Grupo de permissões`)
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('setar')
                .setDescription("Seta os overrides de permissão")
                .addAttachmentOption(option =>
                    option
                        .setName('permissão')
                        .setDescription('Permissão a ser setada em YAML')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('listar')
                .setDescription("Lista os overrides de permissão")
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('avaliar')
                .setDescription("Avalia e depura permissões para um membro")
                .addUserOption(option =>
                    option
                        .setName('membro')
                        .setDescription('Membro a ser avaliado')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('caminho')
                        .setDescription('Caminho de permissão a verificar (ex: Commands.ban). Omita para ver todos os resolvers ativos.')
                        .setRequired(false)
                )
                .addChannelOption(option =>
                    option
                        .setName('canal')
                        .setDescription('Canal de contexto (padrão: canal atual)')
                        .setRequired(false)
                )
        ),

    func: async ({ interaction, logger, guild, client, profile }) => {
        switch (interaction.options.getSubcommand()) {

            // ─── SETAR ────────────────────────────────────────────────────────
            case 'setar': {
                const attachment = interaction.options.getAttachment('permissão');
                if (!attachment) return interaction.reply({ content: 'Anexo inválido', ephemeral: true });
                if (!attachment.contentType?.includes('text/plain')) return interaction.reply({ content: 'Anexo deve ser um arquivo de texto', ephemeral: true });

                const raw = await axios.get(attachment.url).then(r => r.data).catch(() => null);
                if (typeof raw !== 'string') return interaction.reply({ content: 'Não foi possível ler o anexo', ephemeral: true });

                const parsed = tryParseYAML(raw) as { overrides: OverrideConfig[] } | null;
                if (!parsed?.overrides || !Array.isArray(parsed.overrides)) {
                    return interaction.reply({ content: 'YAML inválido: esperado `overrides: []`', ephemeral: true });
                }

                // Validate all entries upfront before touching any state
                const invalid = parsed.overrides.filter(o =>
                    !o.id ||
                    !Array.isArray(o.allow) ||
                    !Array.isArray(o.deny)
                );
                if (invalid.length > 0) {
                    return interaction.reply({
                        content: `Overrides inválidos (faltando id, allow ou deny):\n${invalid.map(o => `• ${o.id ?? '(sem id)'}`).join('\n')}`,
                        ephemeral: true,
                    });
                }

                const perms = compileOverrides(parsed.overrides, logger);

                const previous = guild.permissionOverrides;
                try {
                    guild.data.permissionsOverrides = parseToDatabase(perms.permissions);
                    guild.data.permissionsResolverConfigs = [...perms.resolverConfigs.entries()];
                    await guild.data.save();
                    guild.permissionOverrides = new Permissions(logger, perms.permissions, perms.resolverConfigs);
                } catch (e) {
                    guild.permissionOverrides = previous; // rollback in-memory state
                    logger.error('Falha ao salvar permissões', e);
                    return interaction.reply({ content: 'Erro ao salvar permissões', ephemeral: true });
                }
                client.guildHandler.invalidateCache(guild.id)
                return interaction.reply({
                    content: `Permissões atualizadas com sucesso.\n> ${perms.activeIds.size} resolvers ativos, ${parsed.overrides.length} overrides compilados.`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            case 'listar': {
                const overrides = decompilePermissions(
                    guild.permissionOverrides.permissions,
                    guild.permissionOverrides.resolverConfigs
                );

                if (overrides.length === 0) {
                    return interaction.reply({ content: 'Nenhum override configurado.', ephemeral: true });
                }

                const file = Buffer.from(yaml.stringify({ overrides }));
                return interaction.reply({
                    files: [{ attachment: file, name: 'overrides.yaml' }],
                    ephemeral: true,
                });
            }

            // ─── AVALIAR ──────────────────────────────────────────────────────
            case 'avaliar': {
                await interaction.deferReply({ ephemeral: true });

                const targetUser = interaction.options.getUser('membro', true);
                const permPath   = interaction.options.getString('caminho');
                const channel    = (interaction.options.getChannel('canal') ?? interaction.channel) as TextChannel;

                const member = await interaction.guild!.members.fetch(targetUser.id).catch(() => null);
                if (!member) return interaction.editReply({ content: 'Membro não encontrado no servidor.' });

                const manager = client.permissionHandler;
                const cache = new Map(); // shared per this interaction

                // ── Active subjects ───────────────────────────────────────────
                const subjects = await manager.resolveSubjects(guild.permissionOverrides, member, channel, cache);
                const meta     = manager.resolveMeta(guild.permissionOverrides, subjects);

                // ── Per-path resolution (if requested) ───────────────────────
                let pathBlock = '';
                if (permPath) {
                    const result = await manager.resolve(permPath, guild.permissionOverrides, member, channel, cache);

                    const statusEmoji: Record<string, string> = {
                        granted:   '✅',
                        denied:    '❌',
                        unknown:   '❓',
                        abstained: '⬜',
                    };

                    const statusLabel: Record<string, string> = {
                        granted:   'Permitido',
                        denied:    'Negado',
                        unknown:   'Caminho desconhecido (não registrado na árvore)',
                        abstained: 'Sem regra correspondente (padrão: negar)',
                    };

                    pathBlock = [
                        `**Caminho:** \`${permPath}\``,
                        `**Resultado:** ${statusEmoji[result.status]} ${statusLabel[result.status]}`,
                        result.meta && Object.keys(result.meta).length > 0
                            ? `**Meta herdada:**\n${formatMeta(result.meta)}`
                            : '',
                    ].filter(Boolean).join('\n');
                }

                // ── Subjects breakdown ────────────────────────────────────────
                const subjectsBlock = subjects.length > 0
                    ? subjects.map(id => `• \`${id}\``).join('\n')
                    : '_Nenhum resolver ativo para este membro neste canal_';

                const metaBlock = Object.keys(meta).length > 0
                    ? formatMeta(meta)
                    : '_Sem meta_';

                // ── Build embed ───────────────────────────────────────────────
                const embed = new EmbedBuilder()
                    .setTitle(`Avaliação de permissões — ${member.displayName}`)
                    .setColor(subjects.length > 0 ? '#a8d8a8' : '#d8a8a8')
                    .setThumbnail(member.displayAvatarURL())
                    .setFooter({ text: `Canal: #${channel.name}` })
                    .addFields(
                        {
                            name: `Resolvers ativos (${subjects.length})`,
                            value: subjectsBlock,
                        },
                        {
                            name: 'Meta mesclada',
                            value: metaBlock,
                        }
                    );

                if (pathBlock) {
                    embed.addFields({ name: 'Verificação de caminho', value: pathBlock });
                }

                return interaction.editReply({ embeds: [embed] });
            }
        }
    },
    global: true,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMeta(meta: Record<string, any>): string {
    return Object.entries(meta)
        .map(([k, v]) => `• \`${k}\`: \`${v}\``)
        .join('\n');
}