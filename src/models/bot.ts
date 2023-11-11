import {
    AutocompleteInteraction,
    ButtonInteraction,
    Client,
    CommandInteraction,
    Emoji,
    Events,
    Guild,
    Interaction,
    Message,
    MessageFlags,
    MessageReaction,
    PartialMessageReaction,
    PartialUser,
    RateLimitData,
    RESTEvents,
    Role,
    Routes,
    User,
} from 'discord.js';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SmashCharacters, SlippiCharacterColors } from '../constants/index.js';
import { db, GuildModel as GuildModel } from '../database/index.js';
import {
    ButtonHandler,
    CommandHandler,
    GuildJoinHandler,
    GuildLeaveHandler,
    MessageHandler,
    ReactionHandler,
} from '../events/index.js';
import { JobService, Logger } from '../services/index.js';
import { FormatSlippiDirectoryMessage } from '../utils/format-slippi-directory-message.js';
import { PartialUtils } from '../utils/index.js';


const require = createRequire(import.meta.url);

const fs = require('node:fs');
const path = require('node:path');

let Config = require('../../config/config.json');
let Debug = require('../../config/debug.json');
let Logs = require('../../lang/logs.json');


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


export class Bot {
    private ready = false;

    constructor(
        private token: string,
        private client: Client,
        private guildJoinHandler: GuildJoinHandler,
        private guildLeaveHandler: GuildLeaveHandler,
        private messageHandler: MessageHandler,
        private commandHandler: CommandHandler,
        private buttonHandler: ButtonHandler,
        private reactionHandler: ReactionHandler,
        private jobService: JobService
    ) { }

    public async start(): Promise<void> {


        this.registerListeners();
        await this.login(this.token);


    }

    private registerListeners(): void {
        this.client.on(Events.ClientReady, () => this.onReady());
        this.client.on(Events.ShardReady, (shardId: number, unavailableGuilds: Set<string>) =>
            this.onShardReady(shardId, unavailableGuilds)
        );
        this.client.on(Events.GuildCreate, (guild: Guild) => this.onGuildJoin(guild));
        this.client.on(Events.GuildDelete, (guild: Guild) => this.onGuildLeave(guild));
        this.client.on(Events.MessageCreate, (msg: Message) => this.onMessage(msg));
        this.client.on(Events.InteractionCreate, (intr: Interaction) => this.onInteraction(intr));
        this.client.on(
            Events.MessageReactionAdd,
            (messageReaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) =>
                this.onReaction(messageReaction, user)
        );
        this.client.rest.on(RESTEvents.RateLimited, (rateLimitData: RateLimitData) =>
            this.onRateLimit(rateLimitData)
        );
    }

    private async login(token: string): Promise<void> {
        try {
            await this.client.login(token);
        } catch (error) {
            Logger.error(Logs.error.clientLogin, error);
            return;
        }
    }


    private async onReady(): Promise<void> {
        let userTag = this.client.user?.tag;
        db.sync();

        Logger.info(Logs.info.clientLogin.replaceAll('{USER_TAG}', userTag));

        if (!Debug.dummyMode.enabled) {
            this.jobService.start();
        }

        this.ready = true;
        Logger.info(Logs.info.clientReady);
    }

    private onShardReady(shardId: number, _unavailableGuilds: Set<string>): void {
        Logger.setShardId(shardId);
    }

    private async onGuildJoin(guild: Guild): Promise<void> {
        if (!this.ready || Debug.dummyMode.enabled) {
            return;
        }
        // does not do anything useful. Should check to make sure bot can perform the duties based on role though
        // await this.initializeBotRole(guild);

        await Bot.UploadEmojisAndRoles(guild);

        await Bot.InitializeGuildAndMessage(guild);

        //TODO: Validate bot status here. send message to room owner to correct if fails
        // check if character and slippi tag role positions are lower than current bot role
        // check if pinned message can be edited
        // check if character emojis exist
        // check if character roles exist


        try {
            await this.guildJoinHandler.process(guild);
            Logger.info(Logs.info.clientReady);
        } catch (error) {
            Logger.error(Logs.error.guildJoin, error);
        }
    }

    private static async InitializeGuildAndMessage(guild: Guild): Promise<void> {
        const guildId = guild.id;

        //create guild in db if it does not exist
        const [guildModel] = await GuildModel.findOrCreate(
            {
                where: { guild_id: guildId },
                defaults: { guild_id: guildId }
            }
        );

        //skip if guild already has existing pin
        if (guildModel.pinned_message_id) {
            return;
        }

        //create guild
        const channelName = 'Slippi Tag Directory';
        const channelTopic = 'Directory of users and Slippi info';

        let channel = guild.channels.cache.find(channel => channel.name === channelName);
        if (!channel) {
            channel = await guild.channels.create(
                {
                    name: channelName,
                    topic: channelTopic,
                    reason: channelTopic
                }
            );
            await channel.permissionOverwrites.create(channel.guild.roles.everyone, { SendMessages: false });
            const botMember = await guild.members.fetchMe();
            const botRole = botMember.roles.botRole;
            await channel.permissionOverwrites.create(botRole, { SendMessages: true });
            const message = await channel.send({
                content: FormatSlippiDirectoryMessage.format([]),
                flags: [MessageFlags.SuppressNotifications, MessageFlags.SuppressEmbeds]
            }
            );
            guildModel.update(
                {
                    pinned_message_id: message.id,
                    pinned_channel_id: channel.id
                },
                {
                    where: { guild_id: guildId },
                }
            )
            guildModel.save();
        }

        //TODO: if channel does exist find the pinned message and update the database


    }

    private async onGuildLeave(guild: Guild): Promise<void> {
        if (!this.ready || Debug.dummyMode.enabled) {
            return;
        }

        try {
            await this.guildLeaveHandler.process(guild);
        } catch (error) {
            Logger.error(Logs.error.guildLeave, error);
        }
    }

    private async onMessage(msg: Message): Promise<void> {
        if (
            !this.ready ||
            (Debug.dummyMode.enabled && !Debug.dummyMode.whitelist.includes(msg.author.id))
        ) {
            return;
        }

        try {
            msg = await PartialUtils.fillMessage(msg);
            if (!msg) {
                return;
            }

            await this.messageHandler.process(msg);
        } catch (error) {
            Logger.error(Logs.error.message, error);
        }
    }

    private async onInteraction(intr: Interaction): Promise<void> {
        if (
            !this.ready ||
            (Debug.dummyMode.enabled && !Debug.dummyMode.whitelist.includes(intr.user.id))
        ) {
            return;
        }

        if (intr instanceof CommandInteraction || intr instanceof AutocompleteInteraction) {
            try {
                await this.commandHandler.process(intr);
            } catch (error) {
                Logger.error(Logs.error.command, error);
            }
        } else if (intr instanceof ButtonInteraction) {
            try {
                await this.buttonHandler.process(intr);
            } catch (error) {
                Logger.error(Logs.error.button, error);
            }
        }
    }

    private async onReaction(
        msgReaction: MessageReaction | PartialMessageReaction,
        reactor: User | PartialUser
    ): Promise<void> {
        if (
            !this.ready ||
            (Debug.dummyMode.enabled && !Debug.dummyMode.whitelist.includes(reactor.id))
        ) {
            return;
        }

        try {
            msgReaction = await PartialUtils.fillReaction(msgReaction);
            if (!msgReaction) {
                return;
            }

            reactor = await PartialUtils.fillUser(reactor);
            if (!reactor) {
                return;
            }

            await this.reactionHandler.process(
                msgReaction,
                msgReaction.message as Message,
                reactor
            );
        } catch (error) {
            Logger.error(Logs.error.reaction, error);
        }
    }

    private async onRateLimit(rateLimitData: RateLimitData): Promise<void> {
        if (rateLimitData.timeToReset >= Config.logging.rateLimit.minTimeout * 1000) {
            Logger.error(Logs.error.apiRateLimit, rateLimitData);
        }
    }

    public static async UploadEmojisAndRoles(guild: Guild): Promise<void> {
        const emojiDir = '../../assets/emojis/';
        const emojiFiles = fs.readdirSync(path.resolve(__dirname, emojiDir)) as string[];
        const iconPathToEmojiName = emojiFiles.reduce((acc, fileName: string) => {
            acc[path.parse(fileName).name] = fileName;
            return acc;
        }, {});

        const emojiNames = Object.keys(iconPathToEmojiName);
        let emojiList = guild.emojis.cache.map(emoji => emoji) as Emoji[];
        if (emojiList.length == 0) {
            emojiList = await guild.client.rest.get(Routes.guildEmojis(guild.id)) as Emoji[];
        }

        let emojiNameToIdDict = {};
        emojiList.forEach((guildEmoji) => { emojiNameToIdDict[guildEmoji.name] = guildEmoji.id })

        for (const emojiName of emojiNames) {
            const containsEmoji = emojiList.map(guildEmoji => guildEmoji.name).some((el) => el == emojiName)
            if (!containsEmoji) {
                const emojiPath = path.resolve(__dirname, emojiDir, iconPathToEmojiName[emojiName])
                await guild.emojis.create({ attachment: emojiPath, name: emojiName })
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        let rolesList = guild.roles.cache.map(role => role);
        if (rolesList.length == 0) {
            rolesList = await guild.client.rest.get(Routes.guildRoles(guild.id)) as Role[];
        }

        for (const mainCharRole of SmashCharacters) {
            if (!rolesList.map(role => role.name).includes(mainCharRole)) {
                const color = SlippiCharacterColors[mainCharRole];
                await guild.roles.create({ name: mainCharRole, mentionable: true, color: color });
                await new Promise(resolve => setTimeout(resolve, 500));
            }

        }
    }
}
