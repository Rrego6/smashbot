/**
 * Defines the structure of commands to be registers
 */

import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    RESTPostAPIChatInputApplicationCommandsJSONBody,
    RESTPostAPIContextMenuApplicationCommandsJSONBody,
} from 'discord.js';

import { Language } from '../models/enum-helpers/index.js';
import { Lang } from '../services/index.js';

export const ChatCommandMetadata: {
    [command: string]: RESTPostAPIChatInputApplicationCommandsJSONBody;
} = {
    SET_MAIN: {
        type: ApplicationCommandType.ChatInput,
        name: 'setmain',
        description: 'Set your main character(s)',
        dm_permission: true,
        default_member_permissions: undefined
    },
    SET_TAG: {
        type: ApplicationCommandType.ChatInput,
        name: 'settag',
        description: 'Set your Slippi tag',
        dm_permission: true,
        default_member_permissions: undefined,
        options: [
            {
                required: true,
                name: 'tag',
                description: 'slippi tag ie: user#412',
                type: ApplicationCommandOptionType.String,

            }
        ]
    }
};

export const MessageCommandMetadata: {
    [command: string]: RESTPostAPIContextMenuApplicationCommandsJSONBody;
} = {
    VIEW_DATE_SENT: {
        type: ApplicationCommandType.Message,
        name: Lang.getRef('messageCommands.viewDateSent', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('messageCommands.viewDateSent'),
        default_member_permissions: undefined,
        dm_permission: true
    },
};

export const UserCommandMetadata: {
    [command: string]: RESTPostAPIContextMenuApplicationCommandsJSONBody;
} = {
    GET_SLIPPI_TAG: {
        type: ApplicationCommandType.User,
        name: "Get Slippi Tag",
        default_member_permissions: undefined,
        dm_permission: true
    }
};
