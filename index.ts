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
    ActivityType,
} from "discord.js";
import { readdirSync } from "fs";
import { join } from "path";
import { db } from "./db";
import * as schema from "./db/schema";
import {
    IKick,
    ITwitch,
    IYoutubeLatest,
    IYoutubeLatestShort,
    IYoutubeLive,
} from "./types";
import { eq, isNull } from "drizzle-orm";
import cron from "node-cron";
export const AddButtonDataTwitch = new Map();
export const AddButtonDataKick = new Map();
export const AddButtonDataYoutubeLive = new Map();
export const AddButtonDataYoutubeLatest = new Map();
export const AddButtonDataYoutubeLatestShort = new Map();
export const discord = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildExpressions,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
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
    const task = cron.schedule("*/10 * * * *", async () => {
        await TwitchEmbedLoop();
        await KickEmbedLoop();
        await youtubeLiveEmbedLoop();
        await youtubeLatestEmbedLoop();
        await youtubeLatestShortEmbedLoop();
    });
    // const task = null;
    if (task) {
        console_log.log("Cron job for embeds added successfully!");
    } else {
        console_log.log("Failed to add cron job for embeds.");
    }
    discord.user?.setActivity({
        name: "Watching doras.to",
        type: ActivityType.Custom,
    });
    if (process.env.TWITCH_EVENTSUB == "true") {
        console_log.log("Twitch EventSub Enabled");
        await TwitchEmbedLoopStart();
    }
    await KickEmbedLoopStart();
});
// discord.on("messageCreate", async (message) => {
//     if (message.content === "stream-info") {
//         const discordServer = discord.guilds.cache.get("636803646536810496");
//         if (!discordServer) {
//             return;
//         }
//         const channel = discordServer.channels.cache.get("1327873623951933522");
//         if (!channel) {
//             return;
//         }
//         if (!channel.isTextBased()) return;
//         channel.messages.edit("1382250549470171276", {
//             flags: 32768,
//             components: [
//                 {
//                     type: 3,
//                     //@ts-expect-error
//                     custom_id: "string_select",
//                     placeholder: "Favorite bug?",
//                     options: [
//                         {
//                             label: "Ant",
//                             value: "ant",
//                             description: "(best option)",
//                             emoji: { name: "🐜" },
//                         },
//                         {
//                             label: "Butterfly",
//                             value: "butterfly",
//                             emoji: { name: "🦋" },
//                         },
//                         {
//                             label: "Catarpillar",
//                             value: "caterpillar",
//                             emoji: { name: "🐛" },
//                         },
//                     ],
//                 },
//             ],
//         });
//     }
// });
const TwitchEmbedLoopStart = async () => {
    const items = await db.query.discordBotTwitch.findMany();
    console_log.log(`Twitch EventSub Processing ${items.length} Users`);
    for (const [index, item] of items.entries()) {
        console_log.log(
            `Twitch EventSub Processing for ${index + 1}: ${item.username}`
        );
        await createEventSubSubscription(item.username, "stream.online");
    }
    console_log.log(
        `Twitch EventSub Finished Processing ${items.length} Users`
    );
};
const KickEmbedLoopStart = async () => {
    const items = await db
        .select()
        .from(schema.discordBotKick)
        .where(isNull(schema.discordBotKick.sub_id))
        .execute();
    console_log.log(`Kick EventSub Processing ${items.length} Users`);
    for (const [index, item] of items.entries()) {
        console_log.log(
            `Kick EventSub Processing for ${index + 1}: ${item.username}`
        );
        const eventSub = await createEventSubSubscriptionKick(
            item.username,
            "livestream.status.updated"
        );
        if (eventSub) {
            await db
                .update(schema.discordBotKick)
                .set({ sub_id: eventSub })
                .where(eq(schema.discordBotKick.id, item.id));
        }
    }
    console_log.log(`Kick EventSub Finished Processing ${items.length} Users`);
};
import "./events/interactionCreate";
import "./server";
import { createEventSubSubscription } from "./twitch";
import { createEventSubSubscriptionKick } from "./kick";
// run every 10 minutes
const TwitchEmbedLoop = async () => {
    if (process.env.TWITCH_EVENTSUB == "true") {
        console_log.log("Twitch embed check eventsub");
        const servers = await db
            .select()
            .from(schema.discordBotTwitch)
            .where(eq(schema.discordBotTwitch.live, true))
            .execute();
        console_log.log(
            `Twitch Embeds Processing ${servers.length} Live Users`
        );
        for (const [index, item] of servers.entries()) {
            try {
                await twitchLiveEmbeds(item, index);
            } catch (error) {
                console.error(`Error processing ${item.username}:`, error);
            }
        }
        console_log.log(
            `Twitch Embeds Finished Processing ${servers.length} Live Users`
        );
    } else {
        const servers = await db.query.discordBotTwitch.findMany();
        console_log.log(`Twitch Embeds Processing ${servers.length} Users`);
        for (const [index, item] of servers.entries()) {
            try {
                await twitchLiveEmbeds(item, index);
            } catch (error) {
                console.error(`Error processing ${item.username}:`, error);
            }
        }
        console_log.log(
            `Twitch Embeds Finished Processing ${servers.length} Users`
        );
    }
};
const KickEmbedLoop = async () => {
    console_log.log("Kick embed check eventsub");
    const servers = await db
        .select()
        .from(schema.discordBotKick)
        .where(eq(schema.discordBotKick.live, true))
        .execute();
    console_log.log(`Kick Embeds Processing ${servers.length} Live Users`);
    for (const [index, item] of servers.entries()) {
        try {
            await kickLiveEmbeds(item, index);
        } catch (error) {
            console.error(`Error processing ${item.username}:`, error);
        }
    }
    console_log.log(
        `Kick Embeds Finished Processing ${servers.length} Live Users`
    );
};
const youtubeLiveEmbedLoop = async () => {
    const servers = await db.query.discordBotYoutubeLive.findMany();
    console_log.log(`Youtube Live Embeds Processing ${servers.length} Users`);
    servers.sort((a, b) => (b.live === a.live ? 0 : b.live ? 1 : -1));
    for (const [index, item] of servers.entries()) {
        await youtubeLiveEmbeds(item, index);
    }
    console_log.log(
        `Youtube Live Embeds Finished Processing ${servers.length} Users`
    );
};
const youtubeLatestEmbedLoop = async () => {
    const servers = await db.query.discordBotYoutubeLatest.findMany();
    console_log.log(`Youtube Latest Embeds Processing ${servers.length} Users`);
    for (const [index, item] of servers.entries()) {
        await youtubeLatestEmbeds(item, index);
    }
    console_log.log(
        `Youtube Latest Embeds Finished Processing ${servers.length} Users`
    );
};
const youtubeLatestShortEmbedLoop = async () => {
    const servers = await db.query.discordBotYoutubeLatestShort.findMany();
    console_log.log(
        `Youtube Latest Short Embeds Processing ${servers.length} Users`
    );
    for (const [index, item] of servers.entries()) {
        await youtubeLatestShortEmbeds(item, index);
    }
    console_log.log(
        `Youtube Latest Short Embeds Finished Processing ${servers.length} Users`
    );
};
export const twitchLiveEmbeds = async (item: ITwitch, index: number) => {
    console_log.log(`Entering twitchLiveEmbeds for ${item.username} (index: ${index})`);
    const discordServer = discord.guilds.cache.get(item.server_id);
    if (!discordServer) {
        console_log.error(
            `Discord Server not found for ${item.username} server: ${item.server_id}. Skipping embed processing.`
        );
        return;
    }
    const channel = discordServer.channels.cache.get(item.channel_id);
    if (!channel) {
        console_log.error(
            `Discord Channel not found for ${item.username} server: ${item.server_id}. Skipping embed processing.`
        );
        return;
    }
    try {
        const dataLiveReq = await fetch(
            process.env.API_SERVER_LIVE + "/twitch/" + item.username,
            {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "doras.to discordbot",
                },
            }
        );
        const dataLive = await dataLiveReq.json();
        if (dataLive.error) {
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
                    name: "Live Since",
                    value: `<t:${isoToUnix(dataLive.started_at)}:R>`,
                    inline: true,
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
        const url = `https://www.twitch.tv/${item.username?.toLowerCase()}`;
        let buttonWatch = new ButtonBuilder()
            .setLabel("Watch Stream")
            .setStyle(ButtonStyle.Link)
            .setURL(String(url)); // Explicitly convert to string
        let row: any = new ActionRowBuilder().addComponents(buttonWatch);
        let buttonLinks =
            (item.social_link_url &&
                new ButtonBuilder()
                    .setLabel("Social Links")
                    .setStyle(ButtonStyle.Link)
                    .setURL(
                        "https://doras.to/" + item.social_link_url || ""
                    )) ||
            "";
        if (item.social_links && item.social_link_url)
            buttonLinks && row.addComponents(buttonLinks);
        if (!dataLive.live) {
            if (!item.keep_vod) {
                if (item.message_id) {
                    if (!channel.isTextBased()) return;
                    await channel.messages
                        .delete(item.message_id)
                        .catch((e) => {
                            console_log.error(
                                `Twitch ${item.username}: Error deleting message: ` +
                                e
                            );
                        });
                    await db
                        .update(schema.discordBotTwitch)
                        .set({
                            message_id: null,
                            vod_id: null,
                            live: false,
                            last_live: new Date().toISOString(),
                            live_started_at: null,
                        })
                        .where(eq(schema.discordBotTwitch.id, item.id));
                    return;
                }
                return;
            }
            if (item.vod_id === dataLive.video.live_id) {
                buttonWatch.setLabel("Watch Vod");
                dataLive.video.url &&
                    buttonWatch.setURL(String(dataLive.video.url));
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
                        await channel.messages.edit(item.message_id, {
                            embeds: [embed],
                            components: [row],
                        });
                    }
                }
                await db
                    .update(schema.discordBotTwitch)
                    .set({
                        message_id: null,
                        vod_id: null,
                        live: false,
                        last_live: new Date().toISOString(),
                        live_started_at: null,
                    })
                    .where(eq(schema.discordBotTwitch.id, item.id));
                return;
            } else {
                await db
                    .update(schema.discordBotTwitch)
                    .set({
                        message_id: null,
                        vod_id: null,
                        live: false,
                        last_live: new Date().toISOString(),
                        live_started_at: null,
                    })
                    .where(eq(schema.discordBotTwitch.id, item.id));
                return;
            }
        }
        if (!channel.isTextBased()) return;
        let mention: any;
        try {
            mention =
                item.mention && discordServer.roles.cache.get(item.mention);
        } catch (error) {
            console_log.error(
                `Twitch ${item.username}: Error getting mention: ` + error
            );
        }
        if (
            (mention && mention.name == "@everyone") ||
            (mention && mention.name == "@here")
        ) {
            mention = mention.name;
        } else {
            const message = item.message ? item.message : "";
            mention = mention ? `<@&${item.mention}> ${message}` : message;
        }
        if (!item.message_id) {
            const message = await channel.send({
                content: item.message || "",
                embeds: [embed],
                components: [row],
            });
            if (message.id) {
                await db
                    .update(schema.discordBotTwitch)
                    .set({
                        message_id: message.id,
                        vod_id: dataLive.id,
                        live: true,
                        live_started_at: dataLive.started_at,
                    })
                    .where(eq(schema.discordBotTwitch.id, item.id));
                console_log.log(`twitchLiveEmbeds sent message with Guild ID: ${item.server_id}, Channel ID: ${item.channel_id}, Message ID: ${message.id} Username: ${item.username}`);
                return;
            }
            return;
        }
        await channel.messages
            .edit(item.message_id, {
                content: mention,
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
                            vod_id: dataLive.id,
                        })
                        .where(eq(schema.discordBotTwitch.id, item.id));
                    return;
                }
            });
        console_log.log(`twitchLiveEmbeds edited message with Guild ID: ${item.server_id}, Channel ID: ${item.channel_id}, Message ID: ${item.message_id} Username: ${item.username}`);
        console_log.log(
            `Processed twitchLiveEmbeds for ${index + 1}: ${item.username}`
        );
    } catch (error) {
        console.log(error);
        console_log.error(`Twitch ${item.username}: catch: ` + error);
        return;
    }
};
export const kickLiveEmbeds = async (item: IKick, index: number) => {
    console_log.log(`Entering kickLiveEmbeds for ${item.username} (index: ${index})`);
    const discordServer = discord.guilds.cache.get(item.server_id);
    if (!discordServer) {
        console_log.error(
            `Discord Server not found for ${item.username} server: ${item.server_id}`
        );
        return;
    }
    const channel = discordServer.channels.cache.get(item.channel_id);
    if (!channel) {
        console_log.error(
            `Discord Channel not found for ${item.username} server: ${item.server_id}`
        );
        return;
    }
    try {
        const dataLiveReq = await fetch(
            process.env.API_SERVER_LIVE + "/kick/" + item.username,
            {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "doras.to discordbot",
                },
            }
        );
        const dataLive = await dataLiveReq.json();
        if (dataLive.error) {
            console_log.error(
                `Kick Error getting data for ${item.username} ` +
                dataLive.message
            );
            return;
        }
        let embed: any = {
            color: parseInt("53fc18", 16),
            url: `https://kick.com/${item.username.toLowerCase()}`,
            title: dataLive.title,
            author: {
                name: `${item.username} is now live on Kick!`,
                url: `https://kick.com/${item.username.toLowerCase()}`,
                iconURL:
                    "https://cdn.doras.to/doras/kick-streaming-platform-logo-icon.png",
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
                    name: "Live Since",
                    value: `<t:${isoToUnix(dataLive.started_at)}:R>`,
                    inline: true,
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
        const url = `https://kick.com/${item.username?.toLowerCase()}`;
        let buttonWatch = new ButtonBuilder()
            .setLabel("Watch Stream")
            .setStyle(ButtonStyle.Link)
            .setURL(String(url)); // Explicitly convert to string
        let row: any = new ActionRowBuilder().addComponents(buttonWatch);
        let buttonLinks =
            (item.social_link_url &&
                new ButtonBuilder()
                    .setLabel("Social Links")
                    .setStyle(ButtonStyle.Link)
                    .setURL(
                        "https://doras.to/" + item.social_link_url || ""
                    )) ||
            "";
        if (item.social_links && item.social_link_url)
            buttonLinks && row.addComponents(buttonLinks);
        if (!dataLive.live) {
            if (!item.keep_vod) {
                if (item.message_id) {
                    if (!channel.isTextBased()) return;
                    await channel.messages
                        .delete(item.message_id)
                        .catch((e) => {
                            console_log.error(
                                `Kick ${item.username}: Error deleting message: ` +
                                e
                            );
                        });
                    await db
                        .update(schema.discordBotKick)
                        .set({
                            message_id: null,
                            vod_id: null,
                            live: false,
                            last_live: new Date().toISOString(),
                            live_started_at: null,
                        })
                        .where(eq(schema.discordBotKick.id, item.id));
                    return;
                }
                return;
            }
            if (item.vod_id == dataLive.video.live_id) {
                buttonWatch.setLabel("Watch Vod");
                dataLive.video.url &&
                    buttonWatch.setURL(String(dataLive.video.url));
                if (!channel.isTextBased()) return;
                embed.url = dataLive.video.url;
                embed.title = dataLive.video.title;
                embed.author = {
                    name: `${item.username} is offline`,
                    url: dataLive.video.url,
                    icon_url:
                        "https://cdn.doras.to/doras/kick-streaming-platform-logo-icon.png",
                };
                embed.fields = [
                    {
                        name: "Vod Duration",
                        value: `${humanReadableDurationExtendedKick(
                            dataLive.video.duration
                        )}`,
                    },
                ];
                embed.image = {
                    url: dataLive.video.thumbnail_url,
                };
                if (item.message_id) {
                    if (item.keep_vod) {
                        await channel.messages.edit(item.message_id, {
                            embeds: [embed],
                            components: [row],
                        });
                    }
                }
                await db
                    .update(schema.discordBotKick)
                    .set({
                        message_id: null,
                        vod_id: null,
                        live: false,
                        last_live: new Date().toISOString(),
                        live_started_at: null,
                    })
                    .where(eq(schema.discordBotKick.id, item.id));
                return;
            } else {
                await db
                    .update(schema.discordBotKick)
                    .set({
                        message_id: null,
                        vod_id: null,
                        live: false,
                        last_live: new Date().toISOString(),
                        live_started_at: null,
                    })
                    .where(eq(schema.discordBotKick.id, item.id));
                return;
            }
        }
        if (!channel.isTextBased()) return;
        let mention: any;
        try {
            mention =
                item.mention && discordServer.roles.cache.get(item.mention);
        } catch (error) {
            console_log.error(
                `Kick ${item.username}: Error getting mention: ` + error
            );
        }
        if (
            (mention && mention.name == "@everyone") ||
            (mention && mention.name == "@here")
        ) {
            mention = mention.name;
        } else {
            const message = item.message ? item.message : "";
            mention = mention ? `<@&${item.mention}> ${message}` : message;
        }
        if (!item.message_id) {
            const message = await channel.send({
                content: item.message || "",
                embeds: [embed],
                components: [row],
            });
            if (message.id) {
                await db
                    .update(schema.discordBotKick)
                    .set({
                        message_id: message.id,
                        vod_id: dataLive.id,
                        live: true,
                        live_started_at: dataLive.started_at,
                    })
                    .where(eq(schema.discordBotKick.id, item.id));
                console_log.log(`kickLiveEmbeds sent message with Guild ID: ${item.server_id}, Channel ID: ${item.channel_id}, Message ID: ${message.id} Username: ${item.username}`);
                return;
            }
            return;
        }
        await channel.messages
            .edit(item.message_id, {
                content: mention,
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
                        .update(schema.discordBotKick)
                        .set({
                            message_id: message.id,
                            vod_id: dataLive.id,
                        })
                        .where(eq(schema.discordBotKick.id, item.id));
                    return;
                }
            });
        console_log.log(`kickLiveEmbeds edited message with Guild ID: ${item.server_id}, Channel ID: ${item.channel_id}, Message ID: ${item.message_id} Username: ${item.username}`);
        console_log.log(
            `Processed kickLiveEmbeds for ${index + 1}: ${item.username}`
        );
    } catch (error) {
        console.log(error);
        console_log.error(`Kick ${item.username}: catch: ` + error);
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
function isoToUnix(isoString: string): number {
    // Parse the ISO 8601 string and convert it to a Unix timestamp in seconds
    return Math.floor(new Date(isoString).getTime() / 1000);
}
function convertRelativeTimeToUnix(relativeTime: string): number {
    const now = Math.floor(Date.now() / 1000); // Current Unix timestamp in seconds
    const timeUnits: { [key: string]: number } = {
        second: 1,
        minute: 60,
        hour: 3600,
        day: 86400,
        week: 604800,
        month: 2592000, // Approximate, assuming 30 days
        year: 31536000, // Approximate, assuming 365 days
    };

    const match = relativeTime?.match(
        /(\d+)\s*(second|minute|hour|day|week|month|year)s?\s*ago/i
    );

    if (!match) {
        console_log.error("Invalid relative time format");
        return now;
    }

    const [_, amount, unit] = match; // Destructure the matched groups
    const secondsAgo = parseInt(amount, 10) * timeUnits[unit.toLowerCase()];
    return now - secondsAgo; // Subtract the difference in seconds from the current time
}
function humanReadableDurationExtended(duration: string) {
    const parts = duration.split(":").map(Number);

    let totalSeconds = 0;

    if (parts.length === 3) {
        // Format: HH:MM:SS
        const [hours, minutes, seconds] = parts;
        totalSeconds = seconds + minutes * 60 + hours * 3600;
    } else if (parts.length === 2) {
        // Format: MM:SS
        const [minutes, seconds] = parts;
        totalSeconds = seconds + minutes * 60;
    } else {
        console_log.error("Invalid duration format");
        return "Invalid duration format";
    }

    const days = Math.floor(totalSeconds / 86400);
    totalSeconds %= 86400;
    const hours = Math.floor(totalSeconds / 3600);
    totalSeconds %= 3600;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    const partsFormatted = [];
    if (days > 0) partsFormatted.push(`${days}d`);
    if (hours > 0) partsFormatted.push(`${hours}h`);
    if (minutes > 0) partsFormatted.push(`${minutes}m`);
    if (seconds > 0 || partsFormatted.length === 0)
        partsFormatted.push(`${seconds}s`);

    return partsFormatted.join("");
}
function humanReadableDurationExtendedKick(durationInMs: number): string {
    // Convert milliseconds to seconds
    let totalSeconds = Math.floor(durationInMs / 1000);

    if (typeof totalSeconds !== "number" || totalSeconds < 0) {
        console.error(
            "Invalid duration: expected a non-negative number of seconds"
        );
        return "Invalid duration";
    }

    const days = Math.floor(totalSeconds / 86400);
    totalSeconds %= 86400;
    const hours = Math.floor(totalSeconds / 3600);
    totalSeconds %= 3600;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    const partsFormatted: string[] = [];
    if (days > 0) partsFormatted.push(`${days}d`);
    if (hours > 0) partsFormatted.push(`${hours}h`);
    if (minutes > 0) partsFormatted.push(`${minutes}m`);
    if (seconds > 0 || partsFormatted.length === 0)
        partsFormatted.push(`${seconds}s`);

    return partsFormatted.join("");
}
const youtubeLiveEmbeds = async (item: IYoutubeLive, index: number) => {
    item.username = item.username.replace("@", "");
    console_log.log(`Entering youtubeLiveEmbeds for ${item.username} (index: ${index})`);
    const discordServer = discord.guilds.cache.get(item.server_id);
    if (!discordServer) return;
    const channel = discordServer.channels.cache.get(item.channel_id);
    if (!channel) return;
    try {
        const dataLiveReq = await fetch(
            process.env.API_SERVER_LIVE + "/youtube/@" + item.username,
            {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "doras.to discordbot",
                },
            }
        );
        const dataLive = await dataLiveReq.json();
        if (dataLive.error) {
            console_log.error(
                `Youtube Error getting data for ${item.username} ` +
                dataLive.message
            );
            return;
        }
        if (!dataLive.live) {
            if (!item.keep_vod || !item.vod_id) {
                if (item.message_id) {
                    if (!channel.isTextBased()) return;
                    await channel.messages
                        .delete(item.message_id)
                        .catch((e) => {
                            console_log.error(
                                `Youtube ${item.username}: Error deleting message: ` +
                                e
                            );
                        });
                    await db
                        .update(schema.discordBotYoutubeLive)
                        .set({
                            message_id: null,
                            vod_id: null,
                            live: false,
                            last_live: new Date().toISOString(),
                            live_started_at: null,
                        })
                        .where(eq(schema.discordBotYoutubeLive.id, item.id));
                }
                return; // Exit early when not live and no valid VOD
            }
        }
        let embed: any = {
            color: parseInt("ff0033", 16),
            url: `https://www.youtube.com/watch?v=${dataLive.url}`,
            title: dataLive.title,
            author: {
                name: `${item.username} is now live on YouTube!`,
                url: `https://www.youtube.com/watch?v=${dataLive.url}`,
                iconURL:
                    "https://cdn1.iconfinder.com/data/icons/logotypes/32/youtube-512.png",
            },
            thumbnail: {
                url: dataLive.channel.profile_image,
            },
            fields: [
                {
                    name: "Viewers",
                    value: formatViewersCount(dataLive.viewers),
                    inline: true,
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
            .setURL(`https://www.youtube.com/watch?v=${dataLive.url}`);
        let row: any = new ActionRowBuilder().addComponents(buttonWatch);
        let buttonLinks =
            (item.social_link_url &&
                new ButtonBuilder()
                    .setLabel("Social Links")
                    .setStyle(ButtonStyle.Link)
                    .setURL(
                        "https://doras.to/" + item.social_link_url || ""
                    )) ||
            "";
        if (item.social_links && item.social_link_url) {
            buttonLinks && row.addComponents(buttonLinks);
        }
        const isNotLive = !dataLive.live;
        const isNotVod = !item.vod_id;
        const hasMessageId = !!item.message_id;
        const vodIdMismatch =
            item.vod_id !== null && item.vod_id !== dataLive.url;
        if (
            (isNotLive && isNotVod && hasMessageId) ||
            (vodIdMismatch && hasMessageId && isNotLive)
        ) {
            const vod = dataLive.vods.find(
                (v: any) => v.video_id === item.vod_id
            );
            if (!vod) {
                buttonWatch.setLabel("Watch Vod");
                buttonWatch.setURL(
                    `https://www.youtube.com/watch?v=${item.vod_id}`
                );
                if (item.message_id) {
                    if (item.keep_vod) {
                        try {
                            if (!channel.isTextBased()) return;
                            await channel.messages.edit(item.message_id, {
                                content: item.message,
                                components: [row],
                            });
                        } catch (error) {
                            console.error("Error editing message:", error);
                        }
                    }
                }
                try {
                    await db
                        .update(schema.discordBotYoutubeLive)
                        .set({
                            message_id: null,
                            vod_id: null,
                            live: false,
                            last_live: new Date().toISOString(),
                            live_started_at: null,
                        })
                        .where(eq(schema.discordBotYoutubeLive.id, item.id));
                } catch (error) {
                    console.error("Error updating database:", error);
                }
                return;
            }
            buttonWatch.setLabel("Watch Vod");
            buttonWatch.setURL(vod.link);
            embed.url = vod.link;
            embed.title = vod.title;
            embed.author = {
                name: `${item.username} is offline`,
                url: vod.link,
                icon_url:
                    "https://cdn1.iconfinder.com/data/icons/logotypes/32/youtube-512.png",
            };
            embed.fields = [
                {
                    name: "Vod Duration",
                    value: humanReadableDurationExtended(vod.length || "00:00"),
                },
            ];
            embed.image = {
                url: vod.thumbnail,
            };
            if (item.message_id) {
                if (item.keep_vod) {
                    try {
                        if (!channel.isTextBased()) return;
                        await channel.messages.edit(item.message_id, {
                            content: item.message,
                            embeds: [embed],
                            components: [row],
                        });
                    } catch (error) {
                        console.error("Error editing message:", error);
                    }
                }
            }
            try {
                await db
                    .update(schema.discordBotYoutubeLive)
                    .set({
                        message_id: null,
                        vod_id: null,
                        live: false,
                        last_live: new Date().toISOString(),
                        live_started_at: null,
                    })
                    .where(eq(schema.discordBotYoutubeLive.id, item.id));
            } catch (error) {
                console.error("Error updating database:", error);
            }
            return;
        }
        if (!channel.isTextBased()) return;
        if (!item.message_id) {
            const message = await channel.send({
                content: item?.message || "",
                embeds: [embed],
                components: [row],
            });
            if (message.id) {
                await db
                    .update(schema.discordBotYoutubeLive)
                    .set({
                        message_id: message.id,
                        vod_id: dataLive.url,
                        live: true,
                        live_started_at: new Date().toISOString(),
                    })
                    .where(eq(schema.discordBotYoutubeLive.id, item.id));
                console_log.log(`youtubeLiveEmbeds sent message with Guild ID: ${item.server_id}, Channel ID: ${item.channel_id}, Message ID: ${message.id} Username: ${item.username}`);
                return;
            }
            return;
        }
        await channel.messages
            .edit(item.message_id, {
                content: item.message,
                embeds: [embed],
                components: [row],
            })
            .catch(async (error) => {
                const message = await channel.send({
                    content: item?.message || "",
                    embeds: [embed],
                    components: [row],
                });
                if (message.id) {
                    await db
                        .update(schema.discordBotYoutubeLive)
                        .set({
                            message_id: message.id,
                            vod_id: dataLive.url,
                            live: true,
                        })
                        .where(eq(schema.discordBotYoutubeLive.id, item.id));
                    return;
                }
            });
        console_log.log(`youtubeLiveEmbeds edited message with Guild ID: ${item.server_id}, Channel ID: ${item.channel_id}, Message ID: ${item.message_id} Username: ${item.username}`);
        console_log.log(
            `Processed youtubeLiveEmbeds for ${index + 1}: ${item.username}`
        );
    } catch (error) {
        console.log(error);
        console_log.error(`Youtube ${item.username}: catch: ` + error);
        return;
    }
};
const youtubeLatestEmbeds = async (item: IYoutubeLatest, index: number) => {
    item.username = item.username.replace("@", "");
    console_log.log(`Entering youtubeLatestEmbeds for ${item.username} (index: ${index})`);
    const discordServer = discord.guilds.cache.get(item.server_id);
    if (!discordServer) return;
    const channel = discordServer.channels.cache.get(item.channel_id);
    if (!channel) return;
    try {
        const dataLatestReq = await fetch(
            process.env.API_SERVER_LIVE + "/youtube",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "doras.to discordbot",
                },
                body: JSON.stringify({
                    channel_id: item.youtube_id,
                }),
            }
        );
        const _dataLatest = await dataLatestReq.json();
        const dataLatest = _dataLatest.data;
        if (!dataLatest) return;
        if (dataLatest.video_id === item.video_id) return;
        let embed: any = {
            color: parseInt("ff0033", 16),
            url: dataLatest.link,
            title: dataLatest.title,
            author: {
                name: `${item.username} new video!`,
                url: dataLatest.link,
                iconURL:
                    "https://cdn1.iconfinder.com/data/icons/logotypes/32/youtube-512.png",
            },
            thumbnail: {
                url: dataLatest.channel.profile_image,
            },
            fields: [
                {
                    name: "Views",
                    value: dataLatest?.views || "0",
                    inline: true,
                },
                {
                    name: "Duration",
                    value: humanReadableDurationExtended(
                        dataLatest.length || "00:00"
                    ),
                    inline: true,
                },
                {
                    name: "Uploaded",
                    value: `<t:${convertRelativeTimeToUnix(
                        dataLatest?.published || ""
                    )}:R>`,
                },
            ],
            image: {
                url: dataLatest.thumbnail,
            },
            timestamp: new Date(),
            footer: {
                text: "doras.to",
                iconURL: "https://cdn.doras.to/doras/icons/light/doras.webp",
            },
        };
        let buttonWatch = new ButtonBuilder()
            .setLabel("Watch Video")
            .setStyle(ButtonStyle.Link)
            .setURL(dataLatest.link);
        let row: any = new ActionRowBuilder().addComponents(buttonWatch);
        let buttonLinks =
            (item.social_link_url &&
                new ButtonBuilder()
                    .setLabel("Social Links")
                    .setStyle(ButtonStyle.Link)
                    .setURL(
                        "https://doras.to/" + item.social_link_url || ""
                    )) ||
            "";
        if (item.social_links && item.social_link_url)
            buttonLinks && row.addComponents(buttonLinks);
        if (!channel.isTextBased()) return;
        const message = await channel.send({
            content: item?.message || "",
            embeds: [embed],
            components: [row],
        });
        if (message.id) {
            await db
                .update(schema.discordBotYoutubeLatest)
                .set({
                    video_id: dataLatest.video_id,
                })
                .where(eq(schema.discordBotYoutubeLatest.id, item.id));
            console_log.log(`youtubeLatestEmbeds sent message with Guild ID: ${item.server_id}, Channel ID: ${item.channel_id}, Message ID: ${message.id} Username: ${item.username}`);
            console_log.log(
                `Processed youtubeLatestEmbeds for ${index + 1}: ${item.username}`
            );
            return;
        }
    } catch (error) {
        console.log(error);
        console_log.error(`youtubeLatestEmbeds ${item.username}: catch: ` + error);
        return;
    }
};
const youtubeLatestShortEmbeds = async (
    item: IYoutubeLatestShort,
    index: number
) => {
    item.username = item.username.replace("@", "");
    console_log.log(`Entering youtubeLatestShortEmbeds for ${item.username} (index: ${index})`);
    const discordServer = discord.guilds.cache.get(item.server_id);
    if (!discordServer) return;
    const channel = discordServer.channels.cache.get(item.channel_id);
    if (!channel) return;
    try {
        const dataLatestReq = await fetch(
            process.env.API_SERVER_LIVE + "/youtube/short",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "doras.to discordbot",
                },
                body: JSON.stringify({
                    channel_id: item.youtube_id,
                }),
            }
        );
        const _dataLatest = await dataLatestReq.json();
        const dataLatest = _dataLatest.data;
        if (!dataLatest) return;
        if (dataLatest.video_id === item.video_id) return;
        let embed: any = {
            color: parseInt("ff0033", 16),
            url: dataLatest.link,
            title: dataLatest.title,
            author: {
                name: `${item.username} new short!`,
                url: dataLatest.link,
                iconURL:
                    "https://cdn1.iconfinder.com/data/icons/logotypes/32/youtube-512.png",
            },
            thumbnail: {
                url: dataLatest.channel.profile_image,
            },
            fields: [
                {
                    name: "Views",
                    value: dataLatest?.views,
                    inline: true,
                },
                {
                    name: "Uploaded",
                    value: `<t:${convertRelativeTimeToUnix(
                        dataLatest?.published || ""
                    )}:R>`,
                },
            ],
            image: {
                url: dataLatest.thumbnail,
            },
            timestamp: new Date(),
            footer: {
                text: "doras.to",
                iconURL: "https://cdn.doras.to/doras/icons/light/doras.webp",
            },
        };
        let buttonWatch = new ButtonBuilder()
            .setLabel("Watch Video")
            .setStyle(ButtonStyle.Link)
            .setURL(dataLatest.link);
        let row: any = new ActionRowBuilder().addComponents(buttonWatch);
        let buttonLinks =
            (item.social_link_url &&
                new ButtonBuilder()
                    .setLabel("Social Links")
                    .setStyle(ButtonStyle.Link)
                    .setURL(
                        "https://doras.to/" + item.social_link_url || ""
                    )) ||
            "";
        if (item.social_links && item.social_link_url)
            buttonLinks && row.addComponents(buttonLinks);
        if (!channel.isTextBased()) return;
        const message = await channel.send({
            content: item?.message || "",
            embeds: [embed],
            components: [row],
        });
        if (message.id) {
            await db
                .update(schema.discordBotYoutubeLatestShort)
                .set({
                    video_id: dataLatest.video_id,
                })
                .where(eq(schema.discordBotYoutubeLatestShort.id, item.id));
            console_log.log(`youtubeLatestShortEmbeds Embed sent message with Guild ID: ${item.server_id}, Channel ID: ${item.channel_id}, Message ID: ${message.id} Username: ${item.username}`);
            console_log.log(
                `Processed youtubeLatestShortEmbeds Embed for ${index + 1}: ${item.username}`
            );
            return;
        }
    } catch (error) {
        console.log(error);
        console_log.error(
            `Youtube Latest Short ${item.username}: catch: ` + error
        );
        return;
    }
};
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
