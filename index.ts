import "dotenv/config";
import * as console_log from "./utils/logs";
import {
    Client,
    GatewayIntentBits,
    Partials,
    Events,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    REST,
    Routes,
} from "discord.js";
import { readdirSync } from "fs";
import { join } from "path";
import { db } from "./db";
import * as schema from "./db/schema";
import { ITwitch } from "./types";
import { eq } from "drizzle-orm";
export const AddButtonDataTwitch = new Map();
export const discord = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
        Partials.User,
        Partials.GuildMember,
        Partials.GuildScheduledEvent,
    ],
});
discord.login(process.env.DISCORD_TOKEN);
discord.on(Events.ClientReady, async () => {
    console_log.colour(discord?.user?.username + " bot is ready", "green");
    await registerSlashCommands();
    setInterval(timeCheck, 1000);
});
import "./events/interactionCreate";
function timeCheck() {
    var now = new Date();
    let minute = now.getMinutes();
    let second = now.getSeconds();
    if (minute % 10 === 0 && second === 0) {
        TwitchEmbedLoop();
    }
}
const TwitchEmbedLoop = async () => {
    const servers = await db.query.discordBotTwitch.findMany();
    console_log.log(`Twitch Embeds Processing ${servers.length} Users`);
    for (const [index, item] of servers.entries()) {
        await twitchLiveEmbeds(item, index);
    }
    console_log.log(
        `Twitch Embeds Finished Processing ${servers.length} Users`
    );
};
const twitchLiveEmbeds = async (item: ITwitch, index: number) => {
    console_log.log(
        `Processed Twitch Live Embed for ${index + 1}: ${item.username}`
    );
    const discordServer = discord.guilds.cache.get(item.server_id);
    if (!discordServer) return;
    const channel = discordServer.channels.cache.get(item.channel_id);
    if (!channel) return;
    try {
        const dataLiveReq = await fetch(
            process.env.API_SERVER + "/v2/live/twitch/" + item.username,
            {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );
        const dataLive = await dataLiveReq.json();
        if (!dataLive.live && !item.keep_vod) {
            if (!item.keep_vod && item.message_id) {
                if (!channel.isTextBased()) return;
                channel.messages.delete(item.message_id);
                await db
                    .update(schema.discordBotTwitch)
                    .set({
                        message_id: null,
                    })
                    .where(eq(schema.discordBotTwitch.id, item.id));
                return;
            }
            return;
        }
        let embed: any = {
            color: parseInt("a970ff", 16),
            url: `https://www.twitch.tv/${item.username.toLowerCase()}`,
            title: dataLive.title,
            author: {
                name: `${item.username} is now live on Twitch!`,
                url: `https://www.twitch.tv/${item.username.toLowerCase()}`,
                iconURL:
                    "https://cdn3.iconfinder.com/data/icons/popular-services-brands-vol-2/512/twitch-512.png",
            },
            thumbnail: {
                url: dataLive.user.profile_image,
            },
            fields: [
                {
                    name: "Category",
                    value: dataLive.category,
                    inline: true,
                },
                {
                    name: "Viewers",
                    value: formatViewersCount(dataLive.viewers),
                    inline: true,
                },
                {
                    name: "Duration",
                    value: timeDifference(dataLive.started_at),
                },
            ],
            image: {
                url: dataLive.image,
            },
            timestamp: new Date(),
            footer: {
                text: "doras.to",
                iconURL: "https://cdn.doras.to/doras/icons/light/doras.webp",
            },
        };
        let buttonWatch = new ButtonBuilder()
            .setLabel("Watch Stream")
            .setStyle(ButtonStyle.Link)
            .setURL(`https://www.twitch.tv/${item.username.toLowerCase()}`);
        let buttonLinks = new ButtonBuilder()
            .setLabel("Social Links")
            .setStyle(ButtonStyle.Link)
            .setURL("https://doras.to/trent");
        let row: any = new ActionRowBuilder().addComponents(buttonWatch);
        if (!dataLive.live) {
            buttonWatch.setLabel("Watch Vod");
            buttonWatch.setURL(dataLive.video.url);
            if (!channel.isTextBased()) return;
            embed.url = dataLive.video.url;
            embed.title = dataLive.video.title;
            embed.author = {
                name: `${item.username} is offline`,
                url: dataLive.video.url,
                icon_url:
                    "https://cdn3.iconfinder.com/data/icons/popular-services-brands-vol-2/512/twitch-512.png",
            };
            embed.fields = [
                {
                    name: "Vod Duration",
                    value: `${dataLive.video.duration}`,
                },
            ];
            embed.image = {
                url: dataLive.video.thumbnail_url,
            };
            if (item.message_id) {
                if (item.keep_vod) {
                    channel.messages.edit(item.message_id, {
                        embeds: [embed],
                        components: [row],
                    });
                }
            }
            await db
                .update(schema.discordBotTwitch)
                .set({
                    message_id: null,
                })
                .where(eq(schema.discordBotTwitch.id, item.id));
            return;
        }
        if (!channel.isTextBased()) return;
        if (item.social_links) row.addComponents(buttonLinks);
        let mention: any =
            item.mention && discordServer.roles.cache.get(item.mention);
        if (
            (mention && mention.name == "@everyone") ||
            (mention && mention.name == "@here")
        ) {
            mention = mention.name;
        } else {
            mention = mention ? `<@&${item.mention}>` : "";
        }
        if (!item.message_id) {
            const message = await channel.send({
                content: mention,
                embeds: [embed],
                components: [row],
            });
            if (message.id) {
                await db
                    .update(schema.discordBotTwitch)
                    .set({
                        message_id: message.id,
                    })
                    .where(eq(schema.discordBotTwitch.id, item.id));
                return;
            }
            return;
        }
        await channel.messages
            .edit(item.message_id, {
                embeds: [embed],
                components: [row],
            })
            .catch(async (error) => {
                const message = await channel.send({
                    content: mention,
                    embeds: [embed],
                    components: [row],
                });
                if (message.id) {
                    await db
                        .update(schema.discordBotTwitch)
                        .set({
                            message_id: message.id,
                        })
                        .where(eq(schema.discordBotTwitch.id, item.id));
                    return;
                }
            });
    } catch (error) {
        console_log.error(error);
        return;
    }
};
function formatViewersCount(count: number): string {
    if (count < 1000) {
        return count.toString();
    } else if (count >= 1000 && count < 1_000_000) {
        return (count / 1000).toFixed(1) + "K";
    } else if (count >= 1_000_000 && count < 1_000_000_000) {
        return (count / 1_000_000).toFixed(1) + "M";
    } else {
        return (count / 1_000_000_000).toFixed(1) + "B";
    }
}
function timeDifference(startedAt: string | Date): string {
    const startDate = new Date(startedAt);
    const now = new Date();
    const timeDifference = now.getTime() - startDate.getTime(); // Difference in milliseconds

    let remainingTime = timeDifference;

    const days = Math.floor(remainingTime / (1000 * 60 * 60 * 24));
    remainingTime -= days * (1000 * 60 * 60 * 24);

    const hours = Math.floor(remainingTime / (1000 * 60 * 60));
    remainingTime -= hours * (1000 * 60 * 60);

    const minutes = Math.floor(remainingTime / (1000 * 60));
    remainingTime -= minutes * (1000 * 60);

    const seconds = Math.floor(remainingTime / 1000);

    let result = "";
    if (days > 0) result += `${days} days `;
    if (hours > 0) result += `${hours} hours `;
    if (minutes > 0) result += `${minutes} minutes `;
    if (seconds > 0) result += `${seconds} seconds`;

    return result.trim(); // Remove any trailing space
}
export const commands = new Map();
async function registerSlashCommands() {
    let slashCommands = [];
    const rest = new REST({ version: "9" }).setToken(
        process.env.DISCORD_TOKEN!
    );
    const commandFiles = readdirSync(join(__dirname, ".", "commands")).filter(
        (file) => !file.endsWith(".map")
    );
    for (const file of commandFiles) {
        const command = await import(
            join(__dirname, ".", "commands", `${file}`)
        );
        slashCommands.push(command.default.data);
        commands.set(command.default.data.name, command.default);
    }
    await rest.put(Routes.applicationCommands(discord.user!.id), {
        body: slashCommands,
    });
    console_log.colour("Slash commands registered!", "green");
}
