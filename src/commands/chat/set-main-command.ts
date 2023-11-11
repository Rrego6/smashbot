import { ActionRowBuilder, ActionRowComponentData, ActionRowData, ChatInputCommandInteraction, ComponentType, EmbedBuilder, PermissionsString, Role, SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';

import { InfoOption } from '../../enums/index.js';
import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { Lang, Logger } from '../../services/index.js';
import { InteractionUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';
import { SmashCharacters } from '../../constants/index.js';
import { db, GuildModel, UserModel } from '../../database/index.js'
import { UpdateInformation } from '../../services/update-information-service.js';


export class SetMainCommand implements Command {
    public names = ["setmain"];
    public deferType = CommandDeferType.HIDDEN;
    public requireClientPerms: PermissionsString[] = [];

    private removeSheikDuplicate(characters: string[]): string[] {
        return characters.filter(character => character.toLowerCase() !== "sheik");
    }
    public async execute(intr: ChatInputCommandInteraction, data: EventData): Promise<void> {

        const emojiList = intr.guild.emojis.cache.filter(guildEmoji => SmashCharacters.includes(guildEmoji.name));

        //todo: fail here and reinitialize if emojis are invalid
        if (emojiList.size !== SmashCharacters.length) {
            const emojiNames = emojiList.map(emoji => emoji.name);
            const missingChars = SmashCharacters.filter(charName => !emojiNames.map(emoji => emoji.includes(charName)))
            Logger.error('Missing emojis for: ' + missingChars.join(','))

        }

        let emojiNameToIdDict = {};
        emojiList.forEach((guildEmoji, i) => { emojiNameToIdDict[guildEmoji.name] = guildEmoji.id })


        const smashCharactersCleaned = this.removeSheikDuplicate(SmashCharacters);

        const optionsList = smashCharactersCleaned.map(mainCharName => {
            return new StringSelectMenuOptionBuilder()
                .setLabel(mainCharName)
                .setEmoji({ name: mainCharName, id: emojiNameToIdDict[mainCharName] })
                .setValue(mainCharName)
        })

        const select = new StringSelectMenuBuilder()
            .setCustomId('MainCharacterSelection')
            .setPlaceholder('Your Main Characters')
            .setMinValues(1)
            .setMaxValues(3)
            .addOptions(optionsList)

        const row = new ActionRowBuilder<StringSelectMenuBuilder>()
            .addComponents(select);

        const selectMainCharResponse = await InteractionUtils.send(intr, {
            content: "Choose your character(s)! \n(Sheik mains should select Zelda)",
            components: [row]
        })

        const mainCharCollector = selectMainCharResponse.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 3_600_600 })

        mainCharCollector.on('collect', async mainCharSelIntr => {
            let mainCharSelValues = mainCharSelIntr.values;
            if (mainCharSelValues.includes("Zelda")) {
                mainCharSelValues = mainCharSelValues.filter(x => x !== "Zelda");

                const zeldaSheikSelect = new StringSelectMenuBuilder()
                    .setCustomId('SheikZeldaSelection')
                    .setPlaceholder('Main Character')
                    .setMinValues(1)
                    .setMaxValues(2)
                    .addOptions(['Zelda', 'Sheik'].map(mainCharName => {
                        return new StringSelectMenuOptionBuilder()
                            .setLabel(mainCharName)
                            .setEmoji({ name: mainCharName, id: emojiNameToIdDict[mainCharName] })
                            .setValue(mainCharName)
                    }))
                const row = new ActionRowBuilder<StringSelectMenuBuilder>()
                    .addComponents(zeldaSheikSelect);

                const response = await mainCharSelIntr.reply({
                    content: "Are you a Sheik and/or Zelda Main",
                    components: [row],
                    ephemeral: true,
                    fetchReply: true
                });
                const zeldaSheikCollector = response.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 3_600_600 });

                zeldaSheikCollector.on('collect', async zeldaSheikIntr => {
                    mainCharSelValues.push(...zeldaSheikIntr.values)
                    zeldaSheikIntr.reply({ content: "Updating main characters...", ephemeral: true });
                    await UpdateInformation.assignMainCharRoles(intr, mainCharSelValues);
                    await zeldaSheikIntr.editReply({ content: "Updated your main characters to: " + mainCharSelValues.map(charName => `<:${charName}:${emojiNameToIdDict[charName]}> (${charName})`).join(", ") });
                })

            } else {
                mainCharSelIntr.reply({ content: "Updating main characters...", ephemeral: true });
                await UpdateInformation.assignMainCharRoles(intr, mainCharSelValues);
                await mainCharSelIntr.editReply({ content: "Updated your main characters to: " + mainCharSelValues.map(charName => `<:${charName}:${emojiNameToIdDict[charName]}> (${charName})`).join(", ") });
            }
        })
    }
}
