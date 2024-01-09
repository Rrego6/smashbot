const require = createRequire(import.meta.url);
import { ChannelType, ChatInputCommandInteraction, Emoji, Guild, MessageFlags, PermissionsBitField, Routes, TextChannel } from 'discord.js';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SlippiCharacterColors, SmashCharacters } from '../constants/smash-mains.js';
import { GuildModel, UserModel } from '../database/index.js';
import { EmojiInfo, FormatSlippiDirectoryMessage, SlippiFormatInfo } from '../utils/format-slippi-directory-message.js';
import { FormatUtils } from '../utils/format-utils.js';


const fs = require('node:fs');
const path = require('node:path');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BOT_ADMIN_ROLE_NAME = 'bot-manager'
const BOT_INFO_CHANNEL_NAME = 'smashbot-info';

export class UpdateInformation {
    /**
     * Update pinned directory post using information from database
     * @param guild 
     */
    public static async UpdateDirectoryPost(guild: Guild): Promise<void> {
        const result = await GuildModel.findOne({ where: { guild_id: guild.id } })
        const pinned_channel_id = result.pinned_channel_id;
        const pinned_message_id = result.pinned_message_id;

        const guildUserModels = await UserModel.findAll({
            include: {
                model: GuildModel,
                where: {
                    guild_id: guild.id
                },
            }
        })

        let emojiNameToIdDict = await UpdateInformation.GetSmashEmojisDict(guild);

        const slippiFormatInfo = guildUserModels.map(
            userModel => {
                return {
                    userId: userModel.discord_member_id,
                    slippiTag: userModel.slippi_tag,
                    mainCharacterEmojis: userModel.main_characters?.map(characterName => { return { emojiId: emojiNameToIdDict[characterName], emojiName: characterName } as EmojiInfo })
                } as SlippiFormatInfo
            }
        )

        const content = FormatSlippiDirectoryMessage.format(slippiFormatInfo);

        await guild.client.rest.patch(Routes.channelMessage(pinned_channel_id, pinned_message_id), {
            body: {
                content: content
            }
        })
    }


    public static async AddSlippiTagAsRoleToUser(intr: ChatInputCommandInteraction, slippi_tag: string): Promise<void> {
        const member = intr.guild.members.cache.find(member => member.user.id === intr.user.id);
        const roles = member.roles.cache;

        const guildModelRes = await GuildModel.findOne({ where: { guild_id: intr.guild.id } })
        const [userModelRes] = await UserModel.findOrCreate({ where: { discord_member_id: member.id, guild_fk: guildModelRes.id }, defaults: { discord_member_id: member.id, guild_fk: guildModelRes.id } })
        if (userModelRes.slippi_tag) {
            const currentSlippiTagRole = roles.find(role => role.name.toLowerCase() === userModelRes.slippi_tag.toLowerCase())
            await currentSlippiTagRole?.delete();
        }
        const createdRole = await intr.guild.roles.create({ name: slippi_tag.toLowerCase(), mentionable: false });

        await intr.guild.members.addRole({ user: intr.user, role: createdRole })

        await this.UpdateUserTableWithSlippiTag(member.id, intr.guildId, slippi_tag.toLocaleLowerCase());
        await UpdateInformation.UpdateDirectoryPost(intr.guild);
    }

    public static async assignMainCharRoles(intr: ChatInputCommandInteraction, mainCharSelValues: string[]): Promise<void> {
        const member = intr.guild.members.cache.find(member => member.user.id === intr.user.id);
        const roles = member.roles.cache;
        const currentMainCharRoles = roles.filter(role => SmashCharacters.includes(role.name));
        const invalidMainCharRoles = currentMainCharRoles.filter(role => !mainCharSelValues.includes(role.name));
        const newMainCharRoleNames = mainCharSelValues.filter(mainCharSelName => !roles.find(role => role.name === mainCharSelName));

        for (const [, invalidRole] of invalidMainCharRoles) {
            intr.guild.members.removeRole({ user: intr.user, role: invalidRole })
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        //Code to add only first character as role
        const newMainChar = newMainCharRoleNames.find(_ => true);
        const roleToAdd = intr.guild.roles.cache.find(role => role.name === newMainChar)
        intr.guild.members.addRole({ user: intr.user, role: roleToAdd })
        await new Promise(resolve => setTimeout(resolve, 500));

        //Code to add all characters as roles
        /**
        for (const newMainChar of newMainCharRoleNames) {
            const roleToAdd = intr.guild.roles.cache.find(role => role.name === newMainChar)

            //todo: fail here and reinitialize if roles are invalid
            intr.guild.members.addRole({ user: intr.user, role: roleToAdd })
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        */
        await UpdateInformation.UpdateUserTableWithMainCharacters(member.id, intr.guildId, mainCharSelValues);
        await UpdateInformation.UpdateDirectoryPost(intr.guild);

    }

    private static async UpdateUserTableWithSlippiTag(discord_member_id: string, guildId: string, slippi_tag: string): Promise<void> {
        const guildModelRes = await GuildModel.findOne({ where: { guild_id: guildId } });
        const [userModelRes] = await UserModel.findOrCreate({ where: { discord_member_id: discord_member_id, guild_fk: guildModelRes.id }, defaults: { discord_member_id: discord_member_id, guild_fk: guildModelRes.id } })
        await userModelRes.update({ slippi_tag: slippi_tag }, {
            where: {
                discord_member_id: discord_member_id,
                guild_fk: guildModelRes.id
            }
        })
    }

    private static async UpdateUserTableWithMainCharacters(discord_member_id: string, guildId: string, charNames: string[]): Promise<void> {
        const guildModelRes = await GuildModel.findOne({ where: { guild_id: guildId } });
        const [userModelRes] = await UserModel.findOrCreate({ where: { discord_member_id: discord_member_id, guild_fk: guildModelRes.id }, defaults: { discord_member_id: discord_member_id, guild_fk: guildModelRes.id } })
        await userModelRes.update({ main_characters: charNames }, {
            where: {
                discord_member_id: discord_member_id,
                guild_fk: guildModelRes.id
            }
        })
    }

    public static async GetSmashEmojisDict(guild: Guild): Promise<object> {
        const emojiList = guild.emojis.cache.filter(guildEmoji => SmashCharacters.includes(guildEmoji.name));
        //todo: fail here and reinitialize if emojis are invalid

        let emojiNameToIdDict = {};
        emojiList.forEach((guildEmoji) => { emojiNameToIdDict[guildEmoji.name] = guildEmoji.id })
        return emojiNameToIdDict;
    }

    public static async CreateBotAdminRole(guild: Guild): Promise<void> {
        let rolesList = guild.roles.cache.map(role => role);
        let botAdminRole = rolesList.find(role => role.name == BOT_ADMIN_ROLE_NAME);
        if (!botAdminRole) {
            const pf = PermissionsBitField.Flags;
            botAdminRole = await guild.roles.create({ name: BOT_ADMIN_ROLE_NAME, permissions: [pf.ManageGuild, pf.ManageRoles, pf.ManageGuildExpressions] })
        }
    }

    public static async CreateBotInfoChannel(guild: Guild): Promise<void> {
        const guildId = guild.id;
        const guildModel = await GuildModel.findOne(
            {
                where: { guild_id: guildId }
            }
        )

        const botAdminRole = guild.roles.cache.find(role => role.name === BOT_ADMIN_ROLE_NAME);

        let infoChannel = guild.channels.cache.find(channel => channel.name === BOT_INFO_CHANNEL_NAME);
        if (!infoChannel) {
            infoChannel = await guild.channels.create(
                {
                    name: BOT_INFO_CHANNEL_NAME,
                    topic: 'This channel will broadcast information about Bot issues that need to be resolved.',
                    reason: 'Smash Bot Info',
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone,
                            deny: [PermissionsBitField.Flags.ViewChannel]
                        },
                        {
                            id: botAdminRole.id,
                            allow: [PermissionsBitField.Flags.ViewChannel]
                        },
                        {
                            id: guild.members.me.roles.botRole.id,
                            allow: [PermissionsBitField.Flags.ViewChannel]
                        }
                    ]
                }
            );
            await infoChannel.send({
                content:
                    `This channel will be used to broadcast issues about the SmashBot that need to be resolved. Only ${FormatUtils.roleMention(guild, botAdminRole.id)} can view this channel.`
            })
        }
        guildModel.update(
            {
                bot_info_channel_id: infoChannel.id
            },
            {
                where: { guild_id: guildId },
            }
        )
    }

    private static async PurgeEmojiAsync(guild: Guild, emojisToDelete: Emoji[]): Promise<void> {
        emojisToDelete.forEach(async (emoji) => {
            await guild.emojis.delete(emoji.id);
            await new Promise(resolve => setTimeout(resolve, 500));
        })
    }

    public static async ValidateRoles(guild: Guild): Promise<boolean> {
        const botRole = guild.members.me.roles.botRole;
        const currentMainCharRoles = guild.roles.cache.map(role => role).filter(role => SmashCharacters.includes(role.name));
        //todo upload roles if they don't exist

        if (currentMainCharRoles.some(role => role.rawPosition > botRole.rawPosition)) {
            const infoChannel = guild.channels.cache.find(channel => channel.name === BOT_INFO_CHANNEL_NAME) as TextChannel;
            const message =
                `@everyone The bot currently has an invalid role position that must be fixed. BOT WILL NOT WORK TILL THIS IS FIXED!

To fix:
1. Go to Server Settings
2. Go to Roles
3. Drag the ${FormatUtils.roleMention(guild, botRole.id)} role to the top (or at least above all the smash character roles)
`;
            await infoChannel.send(message);

            return false;
        }
        return true;
    }

    //todo: turn into a question;
    public static async RequestToCleanEmojis(guild: Guild, currentUploadedEmojiList: Emoji[], smashCharEmojiNames: string[]): Promise<void> {
        const unknownExistingEmojis = currentUploadedEmojiList.filter(existingEmoji => !smashCharEmojiNames.includes(existingEmoji.name));

        if (unknownExistingEmojis.length) {
            const infoChannel = guild.channels.cache.find(channel => channel.name === BOT_INFO_CHANNEL_NAME) as TextChannel;
            await infoChannel.send('Unknown existing emojis found. Purging to maintain consistency.... (This will be later replaced with a prompt)');
            await this.PurgeEmojiAsync(guild, unknownExistingEmojis);
        }

    }

    public static async UploadCharacterEmojisAndRoles(guild: Guild): Promise<void> {
        const emojiDir = '../../assets/emojis/';
        const emojiFiles = fs.readdirSync(path.resolve(__dirname, emojiDir)) as string[];
        const iconPathToEmojiName = emojiFiles.reduce((acc, fileName: string) => {
            acc[path.parse(fileName).name] = fileName;
            return acc;
        }, {});

        const emojiNames = Object.keys(iconPathToEmojiName);
        let emojiList = guild.emojis.cache.map(emoji => emoji) as Emoji[];

        await this.RequestToCleanEmojis(guild, emojiList, emojiNames);
        /*
        const smashCharsToBeUploaded = smashCharEmojiNames.filter(
            charName => !currentUploadedEmojiList.find(existingEmoji => existingEmoji.name === charName));
*/

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

        for (const mainCharRole of SmashCharacters) {
            if (!rolesList.map(role => role.name).includes(mainCharRole)) {
                const color = SlippiCharacterColors[mainCharRole];
                await guild.roles.create({ name: mainCharRole, mentionable: true, color: color });
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        await this.ValidateRoles(guild);
    }

    public static async initDirectoryChannel(guild: Guild): Promise<void> {
        const guildId = guild.id;
        const guildModel = await GuildModel.findOne(
            {
                where: { guild_id: guildId }
            }
        );

        if (guildModel.pinned_channel_id && guildModel.pinned_message_id) {
            return;
        }

        //create tag directory channel
        const directoryChannelName = 'slippi-tag-directory';
        const directoryChannelTopic = 'Directory of users and Slippi info';

        let channel = guild.channels.cache.find(channel => channel.name === directoryChannelName);
        if (channel) {
            await channel.delete();
        }

        channel = await guild.channels.create(
            {
                name: directoryChannelName,
                topic: directoryChannelTopic,
                reason: directoryChannelTopic
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

    public static async InitGuildDb(guild: Guild): Promise<GuildModel> {
        const guildId = guild.id;

        //create guild in db if it does not exist
        const [guildModel] = await GuildModel.findOrCreate(
            {
                where: { guild_id: guildId },
                defaults: { guild_id: guildId }
            }
        );

        return guildModel;
    }


}