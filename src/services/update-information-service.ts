import { ChatInputCommandInteraction, Guild, Routes } from 'discord.js';

import { SmashCharacters } from '../constants/smash-mains.js';
import { GuildModel, UserModel } from '../database/index.js';
import { EmojiInfo, FormatSlippiDirectoryMessage, SlippiFormatInfo } from '../utils/format-slippi-directory-message.js';

export class UpdateInformation {
    public static async


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
            await currentSlippiTagRole.delete();
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


        for (const newMainChar of newMainCharRoleNames) {
            const roleToAdd = intr.guild.roles.cache.find(role => role.name === newMainChar)

            //todo: fail here and reinitialize if roles are invalid
            intr.guild.members.addRole({ user: intr.user, role: roleToAdd })
            await new Promise(resolve => setTimeout(resolve, 500));
        }

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


}