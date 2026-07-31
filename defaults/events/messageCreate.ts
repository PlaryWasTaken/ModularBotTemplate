import {Event} from '../../types'
import {GuildMember, Message, TextChannel} from "discord.js";
import {Client} from "../../index";

const prefix: string = 'k!';


export async function runCommand( commandName: string, message: Message<true>, args: string[]) {

    Client.logger.info(`Command received: ${commandName}`);
    if (!commandName) return;
    const command = Client.commands.text.get(commandName);
    Client.logger.info(`Command found: ${command?.name}`);
    if (!command) return;
    if (!command.logger) command.logger = Client.logger.child({fallback: true});
    if (!command.module) return;
    if (command.disabled) return message.reply('Este comando está desativado temporariamente');
    const module = Client.modules.get(command.module);
    if (!module) return;

    Client.logger.info(`Command executed: ${command.name}`, {
        command: {
            name: command.name,
            module: command.module,
            typedName: commandName
        },
        guild: {
            name: message.guild.name,
            id: message.guild.id
        },
        user: {
            name: message.author.username,
            id: message.author.id
        }
    })
    const guild = await Client.guildHandler.fetchOrCreate(message.guild.id);
    const computed = await Client.permissionHandler.resolve(`Commands.${command.name}`, guild.permissionOverrides, message.member as GuildMember, message.channel as TextChannel);
    const noPermission = `Você não tem permissão para usar este comando`

    if (command.permissions && (computed.status === "unknown" || computed.status === "abstained")) {
        const missingPermissions = command.permissions.filter(perm => !message.member?.permissions.has(perm));
        if (missingPermissions.length > 0) return message.reply(noPermission);
    }
    if (computed.status === "denied") return message.reply(noPermission)
    command.func({
        client: Client,
        message: message,
        args: args,
        profile: await Client.profileHandler.fetchOrCreate(message.author.id, message.guild.id),
        logger: command.logger,
        guild: guild,
        interfacer: module.interfacer,
        usedName: commandName
    })
}

export const event: Event<"messageCreate"> = {
    event: 'messageCreate',
    func: async (_client, _logger, message) => {
        if (message.author.bot) return;
        if (!message.inGuild()) return
        if (message.content.startsWith(prefix)) {
            const args = message.content.slice(prefix.length).trim().split(/ +/);
            const commandName = args.shift()?.toLowerCase() as string;
            return await runCommand(commandName, message, args);
        }
    }
}