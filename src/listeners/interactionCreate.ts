import { Client, EmbedBuilder, Message, MessageMentionOptions, GuildMemberRoleManager } from "discord.js";
import type { Database } from '@firebase/database-types';

import { postLeaderboard, postLoserboard, postRank } from '../misc/leaderboards';
import { generateAllowedMentions, helpText, whyText } from '../misc/misc';
import { VERSION } from '../raiha';

export default (client: Client, db: Database, leaderboards: {[key:string]:any}): void => {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName, options, user } = interaction;

    if (commandName === 'rank') {
      await interaction.deferReply();
      const specifiedUser = options.getUser('user') || user;
      const id = specifiedUser.id;

      const content = await postRank(id, leaderboards);
      const embed = new EmbedBuilder()
        .setTitle(`Alt Text Leaderboards`)
        .setDescription(content)
        .setColor(0xd797ff);

      await interaction.editReply({ embeds: [embed], allowedMentions: generateAllowedMentions([[], []]) });
      return;
    }

    if (commandName === 'leaderboard') {
      await interaction.deferReply();

      let page = 1;
      if (options.get('page')) page = parseInt(`${options.get('page')!.value!}`); // WHY DOESN'T getNumber() EXIST WHEN IT SAYS IT DOES

      const content = await postLeaderboard(leaderboards, page);
      const embed = new EmbedBuilder()
        .setTitle(`Alt Text Leaderboards${page !== 1 ? ' (Page ' + page + ')' : ''}`)
        .setDescription(content.text)
        .setFooter({ text: content.footer })
        .setColor(0xd797ff);

      await interaction.editReply({ embeds: [embed], allowedMentions: generateAllowedMentions([[], []]) });
      return;
    }

    if (commandName === 'loserboard') {
      await interaction.deferReply();

      let page = 1;     
      if (options.get('page')) page = parseInt(`${options.get('page')!.value!}`); // WHY DOESN'T getNumber() EXIST WHEN IT SAYS IT DOES
      const content = await postLoserboard(leaderboards, page);
      const embed = new EmbedBuilder()
        .setTitle(`Loserboard${page !== 1 ? ' (Page ' + page + ')' : ''}`)
        .setDescription(content)
        .setColor(0xd797ff);

      await interaction.editReply({ embeds: [embed], allowedMentions: generateAllowedMentions([[], []]) });
      return;
    }

    if (commandName === 'delete') {
      await interaction.deferReply({ ephemeral: true });

      const messageID = options.get('msgid')!.value!;
      
      let message: Message<boolean>;
      try {
        message = await interaction.channel!.messages!.fetch(`${messageID}`);
      } catch (err) {
        const embed = new EmbedBuilder()
          .setTitle(`Raiha Message Delete`)
          .setDescription(`Could not find the message with ID ${messageID}.`)
          .setColor(0xd797ff);
        await interaction.editReply({ embeds: [embed], allowedMentions: generateAllowedMentions([[], []]) });
        return;
      }
      
      let isOP = false;
      let currentMessageID = messageID;
      // loop safety
      let idx = 0;
      while (idx < 15) { // if there's ever more than 15... there's a bigger issue than the ability to delete lol
        idx++;
        const dbRef = db.ref();
        const ref = await dbRef.child(`/Actions/${message.guild!.id}/${message.channel!.id}/${currentMessageID}`).get();
        if (!ref.exists()) break;
        const refVal = await ref.val();
        if (refVal['Parent'] == ref.key) {
          // Reached the top-level message
          if (refVal['OP'] == user.id) {
            isOP = true;
            break;
          } else break;
        } else {
          // Still must traverse upwards
          currentMessageID = refVal['Parent'];
        }
      }

      let responseText = '';
      if (isOP) {
        try { await message.delete(); } catch (err) { /* TODO: something here */ }
        responseText = 'The message was successfully deleted.';
      } else {
        responseText = 'You are not the author of this message, or this message is not a Raiha message.';
      }
      const embed = new EmbedBuilder()
        .setTitle(`Raiha Message Delete`)
        .setDescription(responseText)
        .setColor(0xd797ff);
      await interaction.editReply({ embeds: [embed], allowedMentions: generateAllowedMentions([[], []]) });
      return;
    }

    if (commandName === 'set') {
      await interaction.deferReply();

      const { commandName, options, user, member } = interaction;

      let roles = (member!.roles as GuildMemberRoleManager).cache;
      if (roles.some(role => role.name === 'Staff')) {
        const specifiedUser = options.getUser('user');
        const specifiedBoard = options.get('board')!.value!;
        let specifiedValue = options.get('value')!.value!;
        specifiedValue = (specifiedValue! < 0) ? 0 : specifiedValue;

        const ref = db.ref(`/Leaderboard/${specifiedBoard!}`).child(specifiedUser!.id);
        ref.set(specifiedValue!);

        const embed = new EmbedBuilder()
          .setTitle(`Leaderboard Override`)
          .setDescription(`Set <@${specifiedUser!.id}>'s **${specifiedBoard!}** value to \`${specifiedValue!}\`.`)
          .setColor(0xd797ff);
        await interaction.editReply({ embeds: [embed], allowedMentions: generateAllowedMentions([[], []]) });
        return;
      } else {
        // User does NOT have the 'Staff' role
        const embed = new EmbedBuilder()
          .setTitle(`Leaderboard Override`)
          .setDescription(`Unfortunately, you do not have sufficient permission to perform this action.`)
          .setColor(0xd797ff);
        await interaction.editReply({ embeds: [embed], allowedMentions: generateAllowedMentions([[], []]) });
        return;
      }
    }

    if (commandName === 'help') {
      const embed = new EmbedBuilder()
        .setTitle(`Raiha Help`)
        .setDescription(helpText)
        .setColor(0xd797ff);

      await interaction.reply({ embeds: [embed], allowedMentions: generateAllowedMentions([[], []]) });
      return;
    }

    if (commandName === 'why') {
      const embed = new EmbedBuilder()
        .setTitle(`Why Use Alt Text?`)
        .setDescription(whyText)
        .setURL(`https://moz.com/learn/seo/alt-text`)
        .setColor(0xd797ff);

      await interaction.reply({ embeds: [embed], allowedMentions: generateAllowedMentions([[], []]) });
      return;
    }

    if (commandName === 'about') {
      const embed = new EmbedBuilder()
        .setTitle(`Raiha Accessibility Bot`)
        .setDescription(`Version: ${VERSION}\nAuthor: <@248600185423396866>`)
        .setURL(`https://github.com/9vult/Raiha`)
        .setColor(0xd797ff);
      await interaction.reply({ embeds: [embed], allowedMentions: generateAllowedMentions([[], []]) });
      return;
    }

  });
};
