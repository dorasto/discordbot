import { ChatInputCommandInteraction, Events, Interaction } from "discord.js";
import {
    AddButtonDataKick,
    AddButtonDataTwitch,
    AddButtonDataYoutubeLatest,
    AddButtonDataYoutubeLatestShort,
    AddButtonDataYoutubeLive,
    commands,
    discord,
    kickLiveEmbeds,
    twitchLiveEmbeds,
} from "..";
import { db } from "../db";
import * as schema from "../db/schema";
import { randomUUID } from "crypto";
import { createEventSubSubscription } from "../twitch";
import { createEventSubSubscriptionKick } from "../kick";
import { eq } from "drizzle-orm";
discord.on(
    Events.InteractionCreate,
    async (interaction: Interaction): Promise<any> => {
        if (interaction.isButton()) {
            // Handle button interaction here
            try {
                switch (interaction.customId) {
                    case "accept-twitch":
                        const data = AddButtonDataTwitch.get(
                            interaction.message.id
                        );
                        if (!data) {
                            await interaction.reply({
                                content: "Button pressed but no data found.",
                                ephemeral: true,
                            });
                            AddButtonDataTwitch.delete(interaction.message.id);
                            return;
                        }
                        const dataDB = await db
                            .insert(schema.discordBotTwitch)
                            .values({
                                id: randomUUID(),
                                account_id: interaction.user.id,
                                channel_id: data?.channel || "",
                                server_id: data.server || "",
                                username: data.username || "",
                                message_id: null,
                                social_links: false,
                                keep_vod: data.keep_vod || false,
                                mention: data.mention || null,
                                message: data.message || null,
                            })
                            .returning();
                        if (!dataDB) {
                            await interaction.reply({
                                content:
                                    "There was an error executing the command.",
                                ephemeral: true,
                            });
                            AddButtonDataTwitch.delete(interaction.message.id);
                            return;
                        } else {
                            await interaction.reply({
                                content: `${data.username} has been added to the database.`,
                                ephemeral: true,
                            });
                            const item = dataDB[0];
                            const eventSub = await createEventSubSubscription(
                                item.username,
                                "stream.online"
                            );
                            await twitchLiveEmbeds(item, -50);
                            if (!eventSub) {
                                AddButtonDataTwitch.delete(
                                    interaction.message.id
                                );
                                return;
                            }
                            AddButtonDataTwitch.delete(interaction.message.id);
                        }
                        break;
                    case "reject-twitch":
                        AddButtonDataTwitch.delete(interaction.message.id);
                        await interaction.reply({
                            content: "User has rejected",
                            ephemeral: true,
                        });
                        break;
                    case "accept-kick":
                        const dataKick = AddButtonDataKick.get(
                            interaction.message.id
                        );
                        if (!dataKick) {
                            await interaction.reply({
                                content: "Button pressed but no data found.",
                                ephemeral: true,
                            });
                            AddButtonDataTwitch.delete(interaction.message.id);
                            return;
                        }
                        const dataDBKick = await db
                            .insert(schema.discordBotKick)
                            .values({
                                id: randomUUID(),
                                account_id: interaction.user.id,
                                channel_id: dataKick?.channel || "",
                                server_id: dataKick.server || "",
                                username: dataKick.username || "",
                                message_id: null,
                                social_links: false,
                                keep_vod: dataKick.keep_vod || false,
                                mention: dataKick.mention || null,
                                message: dataKick.message || null,
                                sub_id: "",
                            })
                            .returning();
                        if (!dataDBKick) {
                            await interaction.reply({
                                content:
                                    "There was an error executing the command.",
                                ephemeral: true,
                            });
                            AddButtonDataKick.delete(interaction.message.id);
                            return;
                        } else {
                            await interaction.reply({
                                content: `${dataKick.username} has been added to the database.`,
                                ephemeral: true,
                            });
                            const item = dataDBKick[0];
                            const eventSub =
                                await createEventSubSubscriptionKick(
                                    item.username,
                                    "livestream.status.updated"
                                );
                            await kickLiveEmbeds(item, -50);
                            if (eventSub) {
                                await db
                                    .update(schema.discordBotKick)
                                    .set({ sub_id: eventSub })
                                    .where(
                                        eq(schema.discordBotKick.id, item.id)
                                    );
                                AddButtonDataKick.delete(
                                    interaction.message.id
                                );
                                return;
                            }
                            AddButtonDataKick.delete(interaction.message.id);
                            return;
                        }
                    case "reject-kick":
                        AddButtonDataKick.delete(interaction.message.id);
                        await interaction.reply({
                            content: "User has rejected",
                            ephemeral: true,
                        });
                        break;
                    case "accept-youtube-live":
                        const dataYT = AddButtonDataYoutubeLive.get(
                            interaction.message.id
                        );
                        if (!dataYT) {
                            await interaction.reply({
                                content: "Button pressed but no data found.",
                                ephemeral: true,
                            });
                            AddButtonDataYoutubeLive.delete(
                                interaction.message.id
                            );
                            return;
                        }
                        const dataDBYT = await db
                            .insert(schema.discordBotYoutubeLive)
                            .values({
                                id: randomUUID(),
                                account_id: interaction.user.id,
                                channel_id: dataYT?.channel || "",
                                server_id: dataYT.server || "",
                                username: dataYT.username || "",
                                message_id: null,
                                social_links: false,
                                keep_vod: dataYT.keep_vod || false,
                                message: dataYT.message || null,
                            })
                            .returning();
                        if (!dataDBYT) {
                            await interaction.reply({
                                content:
                                    "There was an error executing the command.",
                                ephemeral: true,
                            });
                            AddButtonDataYoutubeLive.delete(
                                interaction.message.id
                            );
                            return;
                        } else {
                            await interaction.reply({
                                content: `${dataYT.username} has been added to the database.`,
                                ephemeral: true,
                            });
                            AddButtonDataYoutubeLive.delete(
                                interaction.message.id
                            );
                        }
                        break;
                    case "reject-youtube-live":
                        AddButtonDataYoutubeLive.delete(interaction.message.id);
                        await interaction.reply({
                            content: "User has rejected",
                            ephemeral: true,
                        });
                        break;
                    case "accept-youtube-latest":
                        const dataYTLatest = AddButtonDataYoutubeLatest.get(
                            interaction.message.id
                        );
                        if (!dataYTLatest) {
                            await interaction.reply({
                                content: "Button pressed but no data found.",
                                ephemeral: true,
                            });
                            AddButtonDataYoutubeLatest.delete(
                                interaction.message.id
                            );
                            return;
                        }
                        const dataDBYTLatest = await db
                            .insert(schema.discordBotYoutubeLatest)
                            .values({
                                id: randomUUID(),
                                account_id: interaction.user.id,
                                channel_id: dataYTLatest?.channel || "",
                                server_id: dataYTLatest.server || "",
                                username: dataYTLatest.username || "",
                                youtube_id: dataYTLatest.youtube_id || "",
                                social_links: false,
                                message: dataYTLatest.message || null,
                            })
                            .returning();
                        if (!dataDBYTLatest) {
                            await interaction.reply({
                                content:
                                    "There was an error executing the command.",
                                ephemeral: true,
                            });
                            AddButtonDataYoutubeLatest.delete(
                                interaction.message.id
                            );
                            return;
                        } else {
                            await interaction.reply({
                                content: `${dataYTLatest.username} has been added to the database.`,
                                ephemeral: true,
                            });
                            AddButtonDataYoutubeLatest.delete(
                                interaction.message.id
                            );
                        }
                        break;
                    case "reject-youtube-latest":
                        AddButtonDataYoutubeLatest.delete(
                            interaction.message.id
                        );
                        await interaction.reply({
                            content: "User has rejected",
                            ephemeral: true,
                        });
                        break;
                    case "accept-youtube-latest-short":
                        const dataYTLatestShort =
                            AddButtonDataYoutubeLatestShort.get(
                                interaction.message.id
                            );
                        if (!dataYTLatestShort) {
                            await interaction.reply({
                                content: "Button pressed but no data found.",
                                ephemeral: true,
                            });
                            AddButtonDataYoutubeLatestShort.delete(
                                interaction.message.id
                            );
                            return;
                        }
                        const dataDBYTLatestShort = await db
                            .insert(schema.discordBotYoutubeLatestShort)
                            .values({
                                id: randomUUID(),
                                account_id: interaction.user.id,
                                channel_id: dataYTLatestShort?.channel || "",
                                server_id: dataYTLatestShort.server || "",
                                username: dataYTLatestShort.username || "",
                                youtube_id: dataYTLatestShort.youtube_id || "",
                                social_links: false,
                                message: dataYTLatestShort.message || null,
                            })
                            .returning();
                        if (!dataDBYTLatestShort) {
                            await interaction.reply({
                                content:
                                    "There was an error executing the command.",
                                ephemeral: true,
                            });
                            AddButtonDataYoutubeLatestShort.delete(
                                interaction.message.id
                            );
                            return;
                        } else {
                            await interaction.reply({
                                content: `${dataYTLatestShort.username} has been added to the database.`,
                                ephemeral: true,
                            });
                            AddButtonDataYoutubeLatestShort.delete(
                                interaction.message.id
                            );
                        }
                        break;
                    case "reject-youtube-latest":
                        AddButtonDataYoutubeLatestShort.delete(
                            interaction.message.id
                        );
                        await interaction.reply({
                            content: "User has rejected",
                            ephemeral: true,
                        });
                        break;
                    default:
                        await interaction.reply({
                            content: "Button pressed!",
                            ephemeral: true,
                        });
                        setTimeout(() => {
                            interaction.deleteReply().catch(console.error);
                        }, 2500);
                        break;
                }
            } catch (error: any) {
                console.error(error);
                interaction
                    .reply({
                        content:
                            "There was an error handling the button interaction.",
                        ephemeral: true,
                    })
                    .catch(console.error);
            }
            return;
        }
        if (!interaction.isChatInputCommand()) return;

        const command = commands.get(interaction.commandName);

        if (!command) return;
        try {
            command.execute(interaction as ChatInputCommandInteraction);
        } catch (error: any) {
            console.error(error);
            if (error.message.includes("permissions")) {
                interaction
                    .reply({ content: error.toString(), ephemeral: true })
                    .catch(console.error);
            } else {
                interaction
                    .reply({
                        content: "There was an error executing that command.",
                        ephemeral: true,
                    })
                    .catch(console.error);
            }
        }
    }
);
