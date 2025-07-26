import {
    ChatInputCommandInteraction,
    PermissionsBitField,
    SlashCommandBuilder,
    ChannelType,
} from "discord.js";
import { db } from "../db";
import * as schema from "../db/schema";
import { and, eq } from "drizzle-orm";
import { deleteEventSubSubscription } from "../twitch";
import { deleteEventSubSubscriptionKick } from "../kick";
import platforms from "../platforms";
export default {
    data: new SlashCommandBuilder()
        .setName("remove")
        .setDescription("remove notification via platform")
        .addStringOption((option) =>
            option
                .setName("platform")
                .setDescription("Choose the platform")
                .addChoices(platforms)
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("username")
                .setDescription("Username of the platform")
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
            const platform = inter.options.getString("platform");
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
                if (!platform) {
                    await inter.editReply({
                        content: "Please provide a platform",
                    });
                    return;
                }
                if (platform === "twitch") {
                    const check = await db
                        .select()
                        .from(schema.discordBotTwitch)
                        .where(eq(schema.discordBotTwitch.username, username));
                    if (check.length <= 1) {
                        await deleteEventSubSubscription(username);
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
                                eq(
                                    schema.discordBotTwitch.channel_id,
                                    channel.id
                                )
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
                }
                if (platform === "kick") {
                    const check = await db
                        .select()
                        .from(schema.discordBotKick)
                        .where(eq(schema.discordBotKick.username, username));
                    if (check.length <= 1) {
                        await deleteEventSubSubscriptionKick(check[0].sub_id);
                    }
                    const data = await db
                        .delete(schema.discordBotKick)
                        .where(
                            and(
                                eq(
                                    schema.discordBotKick.server_id,
                                    inter.guildId
                                ),
                                eq(schema.discordBotKick.username, username),
                                eq(schema.discordBotKick.channel_id, channel.id)
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
                }
                if (platform === "youtube-live") {
                    const data = await db
                        .delete(schema.discordBotYoutubeLive)
                        .where(
                            and(
                                eq(
                                    schema.discordBotYoutubeLive.server_id,
                                    inter.guildId
                                ),
                                eq(
                                    schema.discordBotYoutubeLive.username,
                                    username?.replace("@", "")
                                ),
                                eq(
                                    schema.discordBotYoutubeLive.channel_id,
                                    channel.id
                                )
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
                }
                if (platform === "youtube-latest") {
                    const data = await db
                        .delete(schema.discordBotYoutubeLatest)
                        .where(
                            and(
                                eq(
                                    schema.discordBotYoutubeLatest.server_id,
                                    inter.guildId
                                ),
                                eq(
                                    schema.discordBotYoutubeLatest.username,
                                    username?.replace("@", "")
                                ),
                                eq(
                                    schema.discordBotYoutubeLatest.channel_id,
                                    channel.id
                                )
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
                }
                if (platform === "youtube-short-latest") {
                    const data = await db
                        .delete(schema.discordBotYoutubeLatestShort)
                        .where(
                            and(
                                eq(
                                    schema.discordBotYoutubeLatestShort
                                        .server_id,
                                    inter.guildId
                                ),
                                eq(
                                    schema.discordBotYoutubeLatestShort
                                        .username,
                                    username?.replace("@", "")
                                ),
                                eq(
                                    schema.discordBotYoutubeLatestShort
                                        .channel_id,
                                    channel.id
                                )
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
                }
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
