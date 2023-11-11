import { FormatUtils } from './format-utils.js';

export interface EmojiInfo {
    emojiId: string
    emojiName: string
}

export interface SlippiFormatInfo {
    userId: string,
    slippiTag?: string,
    region?: string,
    mainCharacterEmojis: EmojiInfo[]
}

export class FormatSlippiDirectoryMessage {

    public static format(userInfos: SlippiFormatInfo[]): string {
        return [`__**Directory**__`, [...userInfos.map(userInfo => this.formatUserInfo(userInfo))].join('\n\n')].join('\n\n');
    }

    private static formatUserInfo(userInfo: SlippiFormatInfo): string {

        const lines = [] as string[];

        const discordUserLine = `\`Discord\`: ${FormatUtils.userMention(userInfo.userId)}`;
        lines.push(discordUserLine);
        if (userInfo.mainCharacterEmojis) {
            const mainCharactersLine = `\`Mains\`: ` + userInfo.mainCharacterEmojis.map(emoji => FormatUtils.emoji(emoji.emojiName, emoji.emojiId) + `(${emoji.emojiName})`).join(' ');
            lines.push(mainCharactersLine);
        }
        if (userInfo?.slippiTag) {
            const transformedSlippiTag = userInfo.slippiTag.replace('#', '-');
            const fmtSlippiTagLine = `\`Slippi Tag\`: [${userInfo.slippiTag}](https://slippi.gg/user/${transformedSlippiTag})`;
            lines.push(fmtSlippiTagLine)
        }

        return lines.join('\n');
    }
}