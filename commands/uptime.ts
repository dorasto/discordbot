import {
    ChatInputCommandInteraction,
    PermissionsBitField,
    SlashCommandBuilder,
    EmbedBuilder,
} from "discord.js";
import { discord } from "..";

export default {
    data: new SlashCommandBuilder()
        .setName("uptime")
        .setDescription("Check the uptime")
        .setDefaultMemberPermissions(
            PermissionsBitField.Flags.UseApplicationCommands
        ),
    cooldown: 3,
    async execute(inter: ChatInputCommandInteraction) {
        try {
            await inter.deferReply();
            let seconds = Math.floor(discord.uptime! / 1000);
            let minutes = Math.floor(seconds / 60);
            let hours = Math.floor(minutes / 60);
            let days = Math.floor(hours / 24);
            seconds %= 60;
            minutes %= 60;
            hours %= 24;
            let defaultEmbed = new EmbedBuilder().setColor("#2f3136");
            defaultEmbed.addFields([
                {
                    name: "Uptime",
                    value: `${days} day(s),${hours} hours, ${minutes} minutes, ${seconds} seconds`,
                },
                {
                    name: "Shard",
                    value: inter.guild?.shardId.toString() || "0",
                },
                {
                    name: "Servers",
                    value: discord.guilds.cache.size.toString(),
                },
            ]);
            await inter.editReply({ embeds: [defaultEmbed] });
        } catch (error) {
            console.error("Error executing play command: ", error);
            await inter.editReply({
                content: "There was an error executing the command.",
            });
        }
    },
};
