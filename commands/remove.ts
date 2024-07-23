import {
    ChatInputCommandInteraction,
    PermissionsBitField,
    SlashCommandBuilder,
    EmbedBuilder,
    ChannelType,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
} from "discord.js";
import { discord, AddButtonDataTwitch } from "..";
import { db } from "../db";
import * as schema from "../db/schema";
import { and, eq } from "drizzle-orm";
export default {
    data: new SlashCommandBuilder()
        .setName("remove")
        .setDescription("remove twitch user")
        .addStringOption((option) =>
            option
                .setName("username")
                .setDescription("Twitch username to remove")
                .setRequired(true)
        )
        .addChannelOption((option) =>
            option
                .addChannelTypes(
                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement
                )
                .setName("channel")
                .setDescription("Channel to remove it from")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    async execute(inter: ChatInputCommandInteraction) {
        try {
            await inter.deferReply({
                ephemeral: true,
            });
            const username = inter.options.getString("username");
            const channel = inter.options.getChannel("channel");
            try {
                if (!channel) {
                    await inter.editReply({
                        content: "Please provide a channel",
                    });
                    return;
                }
                if (!username) {
                    await inter.editReply({
                        content: "Please provide a username",
                    });
                    return;
                }
                if (!inter.guildId) {
                    await inter.editReply({
                        content: "Please provide a server",
                    });
                    return;
                }
                const data = await db
                    .delete(schema.discordBotTwitch)
                    .where(
                        and(
                            eq(
                                schema.discordBotTwitch.server_id,
                                inter.guildId
                            ),
                            eq(schema.discordBotTwitch.username, username),
                            eq(schema.discordBotTwitch.channel_id, channel.id)
                        )
                    )
                    .returning();
                if (data.length === 0) {
                    await inter.editReply({
                        content: "User not found",
                    });
                    return;
                }
                await inter.editReply({
                    content: "User removed",
                });
            } catch (error) {
                console.error("Error executing remove command: ", error);
                await inter.editReply({
                    content: "There was an error executing the command.",
                });
            }
        } catch (error) {
            console.error("Error executing remove command: ", error);
            await inter.editReply({
                content: "There was an error executing the command.",
            });
        }
    },
};
