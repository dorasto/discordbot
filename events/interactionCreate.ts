import { ChatInputCommandInteraction, Events, Interaction } from "discord.js";
import { AddButtonDataTwitch, commands, discord } from "..";
import { db } from "../db";
import * as schema from "../db/schema";
import { randomUUID } from "crypto";
discord.on(
    Events.InteractionCreate,
    async (interaction: Interaction): Promise<any> => {
        if (interaction.isButton()) {
            // Handle button interaction here
            try {
                switch (interaction.customId) {
                    case "accept":
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
                            AddButtonDataTwitch.delete(interaction.message.id);
                        }
                        break;
                    case "reject":
                        AddButtonDataTwitch.delete(interaction.message.id);
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
