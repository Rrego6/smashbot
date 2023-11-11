import { ChatInputCommandInteraction, EmbedBuilder, PermissionsString } from 'discord.js';

import { InfoOption } from '../../enums/index.js';
import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { Lang } from '../../services/index.js';
import { UpdateInformation } from '../../services/update-information-service.js';
import { FormatUtils, InteractionUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

export class SetTagCommand implements Command {
    public names = ['settag'];
    public deferType = CommandDeferType.HIDDEN;
    public requireClientPerms: PermissionsString[] = [];

    public async execute(intr: ChatInputCommandInteraction, data: EventData): Promise<void> {
        const tag = intr.options.getString('tag');
        const userId = intr.user.id;

        const fmtUser = FormatUtils.userMention(userId);
        const response = `Set ${fmtUser} Slippi tag to: \`${tag}\``;
        console.log(response);
        await InteractionUtils.send(intr, {
            content: response,
            ephemeral: true
        })

        await UpdateInformation.AddSlippiTagAsRoleToUser(intr, tag);

    }
}
