/**
 * Defines the structure of commands to be registers
 */

import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    RESTPostAPIChatInputApplicationCommandsJSONBody,
    RESTPostAPIContextMenuApplicationCommandsJSONBody,
} from 'discord.js';

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
};

export const UserCommandMetadata: {
    [command: string]: RESTPostAPIContextMenuApplicationCommandsJSONBody;
} = {
    GET_SLIPPI_TAG: {
        type: ApplicationCommandType.User,
        name: 'Get Slippi Tag',
        default_member_permissions: undefined,
        dm_permission: true
    }
};
