import {Event, ExtendedClient} from '../../types'
import {GuildMember, Message, PartialGroupDMChannel, TextChannel} from "discord.js";

const prefix: string = 'k!';


export async function runCommand(client: ExtendedClient, commandName: string | undefined, message: Message<true> & {
    channel: Exclude<Message<boolean>["channel"], PartialGroupDMChannel>
}, args: string[]) {

    client.logger.info(`Command received: ${commandName}`);
    if (!commandName) return;
    const command = client.commands.text.get(commandName);
    client.logger.info(`Command found: ${command?.name}`);
    if (!command) return;
    if (!command.logger) command.logger = client.logger.child({fallback: true});
    if (!command.module) return;
    if (command.disabled) return message.reply('Este comando está desativado temporariamente');
    const module = client.modules.get(command.module);
    if (!module) return;

    client.logger.info(`Command executed: ${command.name}`, {
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
    const guild = await client.guildHandler.fetchOrCreate(message.guild.id);
    const overrides = guild.permissionOverrides.getEndNode(`Commands.${command.name}`)
    let computed: boolean | null = null;
    if (overrides) {
        computed = await client.permissionHandler.computePermissions(overrides, message.member as GuildMember, message.channel as TextChannel);
        if (computed === false) return message.reply('Você não tem permissão para usar este comando aqui');
    }
    if (command.permissions && computed !== true) {
        const missingPermissions = command.permissions.filter(perm => !message.member?.permissions.has(perm));
        if (missingPermissions.length > 0) return message.reply(`Você não tem permissão para usar este comando`);
    }
    command.func({
        client: client,
        message: message,
        args: args,
        profile: await client.profileHandler.fetchOrCreate(message.author.id, message.guild.id),
        logger: command.logger,
        guild: guild,
        interfacer: module.interfacer,
        usedName: commandName
    })
}

export const event: Event<"messageCreate"> = {
    event: 'messageCreate',
    func: async (client, logger, message) => {
        if (message.author.bot) return;
        if (!message.inGuild()) return
        if (message.content.startsWith(prefix)) {
            const args = message.content.slice(prefix.length).trim().split(/ +/);
            const commandName = args.shift()?.toLowerCase();
            return await runCommand(client, commandName, message, args);
        }
    }
}