import SlashCommand from "../../classes/structs/SlashCommand";
import {
    SlashCommandBuilder,
    PermissionsBitField,
    GuildTextBasedChannel
} from "discord.js";
import fuse from "fuse.js";
import {InteractionView} from "../../utils/InteractionView";
import {defaultSaveMethod, Setting} from "../../settings/Setting";



export default new SlashCommand({
    data: new SlashCommandBuilder()
        .setName('configurações')
        .setDescription(`Mostra todas as configurações do servidor`)
        .addStringOption(option =>
            option
                .setName('configuração')
                .setDescription('Nome da configuração para pesquisar')
                .setRequired(true)
                .setAutocomplete(true)
        ),
    func: async ({interaction, client, logger, guild, profile}) => {
        if (!interaction.inGuild()) return interaction.reply({
            content: 'Este comando só pode ser usado em servidores',
            ephemeral: true
        });
        const guildSetting = guild.settings.find(setting => setting.name === interaction.options.getString('configuração'));
        const userSetting = profile.settings.find(setting => setting.name === interaction.options.getString('configuração'));
        if (guildSetting && userSetting) {
            logger.crit(`Setting ${interaction.options.getString('configuração')} found in both guild and user settings, this is SUPER wrong`)
            return interaction.reply({
                content: 'Configuração encontrada em guild e usuário, isso não deveria acontecer, por favor, contate o desenvolvedor',
                ephemeral: true
            });
        }
        if (!guildSetting && !userSetting ) return interaction.reply({content: 'Configuração não encontrada.. :(', ephemeral: true});
        const setting = (guildSetting || userSetting) as Setting<unknown>
        if (setting.permission && !profile.member.permissions.has(setting.permission)) return interaction.reply({
            content: 'Você não tem permissão para mudar essa configuração',
            ephemeral: true
        });
        if (setting.condition && !setting.condition(guild, profile)) return interaction.reply({
            content: 'Essa configuração não está disponível no momento para você',
            ephemeral: true
        });

        const view = new InteractionView(interaction, interaction.channel as GuildTextBasedChannel, client, {
            filter: (i) => i.user.id === interaction.user.id,
            timeout: 4 * 60 * 1000
        })
        view.once('end', (reason) => {
            if (reason !== 'time') return
            view.update({
                embeds: [],
                components: [],
                content: 'Tempo esgotado'
            })
        })
        const result = await setting.run(view);
        if (!result) {
            setting.value = undefined
        } else {
            setting.value = result
        }
        if (guildSetting) client.guildHandler.invalidateCache(guild.guild.id)
        if (setting.save) {
            await setting.save(guild, result, profile)
        } else {
            const entity = guildSetting ? guild : profile
            await defaultSaveMethod(client, entity, setting)
        }
    },
    global: true,
    autoCompleteFunc: async ({interaction, guild, profile}) => {
        if (!interaction.inGuild()) return interaction.respond([{
            name: 'Este comando só pode ser usado em servidores',
            value: 'null'
        }]);
        function testCondition(setting: Setting<unknown>) {
            if (setting.condition) {
                return setting.condition(guild, profile)
            } else {
                return true
            }
        }
        const guilds = [...guild.settings.values()].filter(v => testCondition(v)).map(setting => {
            return {
                ...setting,
                displayName: `[Servidor] ${setting.name}`
            }
        })
        const users = [...profile.settings.values()].filter(v => testCondition(v)).map(setting => {
            return {
                ...setting,
                displayName: `[Usuário] ${setting.name}`,
                permission: setting.permission || PermissionsBitField.Flags.SendMessages
            }
        })
        const result = new fuse([...guilds, ...users], {
            keys: ['name'],
            includeScore: true,
            threshold: 1,
            ignoreLocation: true,
            findAllMatches: true,
            distance: 800
        })
        const settings = (result.search(interaction.options.getString('configuração') || 'abc', {
            limit: 23
        }).map(result => result.item)).filter(setting => {
            if (typeof interaction.member.permissions === 'string') return false
            return interaction.member.permissions.has(setting.permission || PermissionsBitField.Flags.Administrator)
        });
        await interaction.respond(settings.map(setting => {
            return {
                name: `${setting.displayName}`,
                value: setting.name
            }
        }))
    }
})