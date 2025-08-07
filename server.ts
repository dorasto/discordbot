import * as console_log from "./utils/logs";
import { discord, kickLiveEmbeds, twitchLiveEmbeds } from ".";
import { Context, Hono } from "hono";
import { serve } from "@hono/node-server";
import crypto from "crypto";
import { db } from "./db";
import {
    validateBodyConnectionAdd,
    validateBodyConnectionEdit,
    validateBodyConnectionRemove,
} from "./utils/v1-api";
import {
    discordBotKick,
    discordBotTwitch,
    discordBotYoutubeLatest,
    discordBotYoutubeLatestShort,
    discordBotYoutubeLive,
    userServerAccess,
} from "./db/schema";
import { and, eq } from "drizzle-orm";
import path from "path";
import fs from "fs";
import { IUserServerAccess } from "./types";
import {
    createEventSubSubscription,
    deleteEventSubSubscription,
    getSecret,
    getTwitchUser,
    TwitchTokenManager,
} from "./twitch";
import {
    createEventSubSubscriptionKick,
    deleteEventSubSubscriptionKick,
} from "./kick";
//web server
const baseHeaders = {
    "X-Service-Name": "DorasBot",
    "X-Organization-Name": "Doras.to",
    "X-API-Version": "1.0.0",
    "X-Request-ID": crypto.randomUUID(),
    "X-Environment": process.env.NODE_ENV,
};
// Middleware to add headers to every response
const addHeadersMiddleware = async (c: Context, next: () => Promise<void>) => {
    Object.entries(baseHeaders).forEach(([key, value]) => {
        if (value) c.header(key, value);
    });
    await next(); // Ensure the middleware chain continues
};
// Middleware to check Authorization header
const checkAuthorizationMiddleware = async (
    c: Context,
    next: () => Promise<void>
) => {
    const authHeader = c.req.header("Authorization"); // Properly fetch the header
    // Check if the header matches the expected format and API key
    if (authHeader !== `Bearer ${process.env.API_KEY}`) {
        return c.json({ error: "Unauthorized" }, 401);
    }
    await next(); // Ensure the middleware chain continues if authorized
};
const app = new Hono();
app.use("*", addHeadersMiddleware); // Apply middleware to all routes
app.use("/api/v1/*", checkAuthorizationMiddleware); // Apply middleware to api routes for authorization
app.get("/", async (c) => {
    const filePath = path.join(__dirname, "public", "index.html");
    const htmlContent = fs.readFileSync(filePath, "utf-8");
    return c.html(htmlContent);
});
app.get("/health", async (c) => {
    return c.text("OK");
});
app.get("/favicon.ico", async (c) => {
    return c.redirect("https://cdn.doras.to/doras/doras_favicon.png", 308);
});
function getRandomAvatarUrl() {
    const randomNumber = Math.floor(Math.random() * 6); // Random number between 0 and 5
    return `https://cdn.discordapp.com/embed/avatars/${randomNumber}.png`;
}
app.get("/api/v1/get_all_connections", async (c) => {
    try {
        const user_id = c.req.header()["user-id"];
        if (!user_id) return c.json({ error: "user-id is required" });
        const userData: any = await db
            .select()
            .from(userServerAccess)
            .where(eq(userServerAccess.discord_user_id, user_id))
            .limit(1)
            .execute();
        if (userData.length === 0) return c.json({ error: "User not found" });
        const user: IUserServerAccess = userData[0];
        const servers = await Promise.all(
            user.servers.map(async (e) => {
                const discordServer = discord.guilds.cache.get(e.id);
                if (!discordServer) return null;
                const twitch = await db
                    .select()
                    .from(discordBotTwitch)
                    .where(eq(discordBotTwitch.server_id, e.id))
                    .execute();
                const kick = await db
                    .select()
                    .from(discordBotKick)
                    .where(eq(discordBotKick.server_id, e.id))
                    .execute();
                const youtubeLatest = await db
                    .select()
                    .from(discordBotYoutubeLatest)
                    .where(eq(discordBotYoutubeLatest.server_id, e.id))
                    .execute();
                const youtubeShort = await db
                    .select()
                    .from(discordBotYoutubeLatestShort)
                    .where(eq(discordBotYoutubeLatestShort.server_id, e.id))
                    .execute();
                const youtubeLive = await db
                    .select()
                    .from(discordBotYoutubeLive)
                    .where(eq(discordBotYoutubeLive.server_id, e.id))
                    .execute();
                const textChannels = discordServer.channels.cache
                    .filter((channel) => channel.isTextBased())
                    .map((channel) => ({
                        id: channel.id,
                        name: channel.name,
                        type: channel.type,
                        created_at: channel.createdAt,
                    }));
                return {
                    id: e.id,
                    name: e.name,
                    icon: discordServer.iconURL() || getRandomAvatarUrl(),
                    channels: textChannels,
                    roles: discordServer.roles.cache
                        .filter((role) => !role.managed)
                        .map((role) => ({
                            id: role.id,
                            name: role.name,
                            color: role.hexColor,
                            created_at: role.createdAt,
                        })),
                    members: discordServer.members.cache.map((member) => ({
                        id: member.id,
                        username: member.user.username,
                        avatar: member.user.avatarURL(),
                        discriminator: member.user.discriminator,
                        created_at: member.joinedAt,
                    })),
                    twitch: twitch,
                    kick: kick || [],
                    youtubeLive: youtubeLive,
                    youtubeLatest: youtubeLatest,
                    youtubeShort: youtubeShort,
                };
            })
        );
        const filteredServers = servers.filter((server) => server !== null);

        return c.json(filteredServers);
    } catch (error) {
        console.error(
            "Error in /api/v1/get_all_connections:",
            error?.toString()
        );
        return c.json({ error: error?.toString() }, { status: 500 });
    }
});
app.post("/api/v1/get_server", async (c) => {
    try {
        const body = await c.req.json();
        const { server_id, user_id } = body;
        if (!server_id) return c.json({ error: "server_id is required" });
        if (!user_id) return c.json({ error: "user_id is required" });
        const discordServer = discord.guilds.cache.get(server_id);
        if (!discordServer) return c.json({ error: "Server not found" });
        const member = await discordServer.members.fetch(user_id);
        if (!member) return c.json({ error: "User not found" });
        if (!member.permissions.has("Administrator"))
            return c.json({ error: "You are not an administrator" });
        return c.json({
            id: discordServer.id,
            name: discordServer.name,
            icon: discordServer.iconURL() || getRandomAvatarUrl(),
            owner_id: discordServer.ownerId,
            member_count: discordServer.memberCount,
            created_at: discordServer.createdAt,
            roles: discordServer.roles.cache.map((role) => ({
                id: role.id,
                name: role.name,
                color: role.hexColor,
                created_at: role.createdAt,
            })),
            channels: discordServer.channels.cache.map((channel) => ({
                id: channel.id,
                name: channel.name,
                type: channel.type,
                created_at: channel.createdAt,
            })),
        });
    } catch (error) {
        console.error("Error in /api/v1/get_server:", error?.toString());
        return c.json({ error: error?.toString() }, { status: 500 });
    }
});
app.post("/api/v1/get_connections", async (c) => {
    try {
        const body = await c.req.json();
        const { server_id, user_id } = body;

        if (!server_id) return c.json({ error: "server_id is required" });
        if (!user_id) return c.json({ error: "user_id is required" });

        const discordServer = discord.guilds.cache.get(server_id);
        if (!discordServer) return c.json({ error: "Server not found" });

        // Helper function to process data and include Discord user info
        const processWithDiscordUser = (items: any) =>
            items.map((item: any) => {
                const discordUser = discordServer.members.cache.get(
                    item.account_id
                );
                return {
                    ...item,
                    discord_user: discordUser
                        ? {
                              id: discordUser.id,
                              username: discordUser.user.username,
                              discriminator: discordUser.user.discriminator,
                              displayName: discordUser.displayName,
                              logo:
                                  discordUser.user.avatarURL() ||
                                  getRandomAvatarUrl(),
                          }
                        : null, // Handle cases where the user is not found in the cache
                };
            });

        // Fetch data from the database
        const twitchLiveStreams = await db.query.discordBotTwitch.findMany({
            where: (table, { eq }) => eq(table.server_id, server_id),
        });

        const youtubeLiveStreams =
            await db.query.discordBotYoutubeLive.findMany({
                where: (table, { eq }) => eq(table.server_id, server_id),
            });

        const youtubeLatest = await db.query.discordBotYoutubeLatest.findMany({
            where: (table, { eq }) => eq(table.server_id, server_id),
        });
        const youtubeLatestShorts =
            await db.query.discordBotYoutubeLatestShort.findMany({
                where: (table, { eq }) => eq(table.server_id, server_id),
            });

        // Apply user processing to all data
        return c.json({
            twitch: processWithDiscordUser(twitchLiveStreams),
            youtube: {
                live: processWithDiscordUser(youtubeLiveStreams),
                latest: processWithDiscordUser(youtubeLatest),
                shorts: processWithDiscordUser(youtubeLatestShorts),
            },
        });
    } catch (error) {
        console.error("Error in /api/v1/get_connections:", error?.toString());
        return c.json({ error: error?.toString() }, { status: 500 });
    }
});
app.post("/api/v1/connection", async (e) => {
    try {
        const body = await e.req.json();
        const { valid, error, fields } = validateBodyConnectionAdd(body);
        if (!valid) {
            return e.json(
                {
                    status: 400,
                    message: error,
                    fields: fields,
                },
                {
                    status: 400,
                }
            );
        }
        const {
            server_id,
            user_id,
            account_id,
            type,
            channel_id,
            username,
            social_links,
            social_link_url,
            keep_vod,
            message,
        } = body;
        const userData: any = await db
            .select()
            .from(userServerAccess)
            .where(eq(userServerAccess.discord_user_id, user_id))
            .limit(1)
            .execute();
        if (!userData[0]) {
            return e.json(
                {
                    status: 400,
                    message: "You don't have access to this server",
                },
                {
                    status: 400,
                }
            );
        }
        const user: IUserServerAccess = userData[0];
        if (!user.servers.find((server) => server.id === server_id)) {
            return e.json(
                {
                    status: 400,
                    message: "You don't have access to this server",
                },
                {
                    status: 400,
                }
            );
        }
        const discordServer = discord.guilds.cache.get(server_id);
        if (!discordServer) return e.json({ error: "Server not found" });
        const channel = discordServer.channels.cache.get(channel_id);
        if (!channel) return e.json({ error: "Channel not found" });
        if (type === "twitch") {
            const dataLiveReq = await fetch(
                process.env.API_SERVER_LIVE + "/twitch/" + username,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );
            const dataLive = await dataLiveReq.json();
            if (!dataLive?.user?.username) {
                return e.json({
                    status: 400,
                    message: `User ${username} not found on Twitch`,
                });
            }
            const newRow = await db
                .insert(discordBotTwitch)
                .values({
                    id: crypto.randomUUID(),
                    server_id: server_id,
                    account_id: account_id,
                    channel_id: channel_id,
                    username: username,
                    social_links: social_links || false,
                    social_link_url: social_link_url,
                    keep_vod: keep_vod || false,
                    message: message,
                })
                .returning();
            if (newRow.length > 0) {
                await createEventSubSubscription(
                    newRow[0].username,
                    "stream.online"
                );
                return e.json({
                    status: 200,
                    message: "Twitch connection added",
                    data: newRow[0],
                });
            } else {
                return e.json({
                    status: 500,
                    message: "Error adding Twitch connection",
                });
            }
        }
        if (type === "youtubeLive") {
            const dataLiveReq = await fetch(
                process.env.API_SERVER_LIVE +
                    "/youtube/@" +
                    username?.replace("@", ""),
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );
            const dataLive = await dataLiveReq.json();
            if (!dataLive?.channel?.id) {
                return e.json({
                    status: 400,
                    message: `User ${username?.replace(
                        "@",
                        ""
                    )} not found on Youtube`,
                });
            }
            const newRow = await db
                .insert(discordBotYoutubeLive)
                .values({
                    id: crypto.randomUUID(),
                    server_id: server_id,
                    account_id: account_id,
                    channel_id: channel_id,
                    username: username?.replace("@", ""),
                    social_links: social_links || false,
                    social_link_url: social_link_url,
                    keep_vod: keep_vod || false,
                    message: message,
                })
                .returning();
            if (newRow.length > 0) {
                return e.json({
                    status: 200,
                    message: "Youtube Live connection added",
                    data: newRow,
                });
            } else {
                return e.json({
                    status: 500,
                    message: "Error adding Youtube Live connection",
                });
            }
        }
        if (type === "youtubeLatest") {
            const dataLiveReq = await fetch(
                process.env.API_SERVER_LIVE +
                    "/youtube/@" +
                    username?.replace("@", ""),
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );
            const dataLive = await dataLiveReq.json();
            if (!dataLive?.channel?.id) {
                return e.json({
                    status: 400,
                    message: `User ${username?.replace(
                        "@",
                        ""
                    )} not found on Youtube`,
                });
            }
            const newRow = await db
                .insert(discordBotYoutubeLatest)
                .values({
                    id: crypto.randomUUID(),
                    server_id: server_id,
                    account_id: account_id,
                    channel_id: channel_id,
                    username: username?.replace("@", ""),
                    youtube_id: dataLive.channel?.id,
                    social_links: social_links || false,
                    social_link_url: social_link_url,
                    message: message,
                })
                .returning();
            if (newRow.length > 0) {
                return e.json({
                    status: 200,
                    message: "Youtube Latest connection added",
                    data: newRow,
                });
            } else {
                return e.json({
                    status: 500,
                    message: "Error adding Youtube Latest connection",
                });
            }
        }
        if (type === "youtubeShort") {
            const dataLiveReq = await fetch(
                process.env.API_SERVER_LIVE +
                    "/youtube/@" +
                    username?.replace("@", ""),
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );
            const dataLive = await dataLiveReq.json();
            if (!dataLive?.channel?.id) {
                return e.json({
                    status: 400,
                    message: `User ${username?.replace(
                        "@",
                        ""
                    )} not found on Youtube`,
                });
            }
            const newRow = await db
                .insert(discordBotYoutubeLatestShort)
                .values({
                    id: crypto.randomUUID(),
                    server_id: server_id,
                    account_id: account_id,
                    channel_id: channel_id,
                    username: username?.replace("@", ""),
                    youtube_id: dataLive.channel?.id,
                    social_links: social_links || false,
                    social_link_url: social_link_url,
                    message: message,
                })
                .returning();
            if (newRow.length > 0) {
                return e.json({
                    status: 200,
                    message: "Youtube Latest Short connection added",
                    data: newRow,
                });
            } else {
                return e.json({
                    status: 500,
                    message: "Error adding Youtube Latest Short connection",
                });
            }
        }
        return e.json({
            status: 400,
            message: `Invalid key: 'type'. One of the following is required:`,
            fields: [
                {
                    key: "twitch",
                    type: "string",
                    description: "twitch connection",
                },
                {
                    key: "kick",
                    type: "string",
                    description: "kick live connection",
                },
                {
                    key: "youtubeLive",
                    type: "string",
                    description: "youtube live connection",
                },
                {
                    key: "youtubeLatest",
                    type: "string",
                    description: "youtube latest connection",
                },
                {
                    key: "youtubeShort",
                    type: "string",
                    description: "youtube latest short connection",
                },
            ],
        });
    } catch (error) {
        console.error("Error in /api/v1/connection POST:", error?.toString());
        return e.json({ error: error?.toString() }, { status: 500 });
    }
});
app.patch("/api/v1/connection", async (e) => {
    try {
        const body = await e.req.json();
        const { valid, error, fields } = validateBodyConnectionEdit(body);
        if (!valid) {
            return e.json(
                {
                    status: 400,
                    message: error,
                    fields: fields,
                },
                {
                    status: 400,
                }
            );
        }
        const {
            server_id,
            user_id,
            id,
            type,
            channel_id,
            username,
            message,
            social_links,
            social_link_url,
            keep_vod,
        } = body;
        const userData: any = await db
            .select()
            .from(userServerAccess)
            .where(eq(userServerAccess.discord_user_id, user_id))
            .limit(1)
            .execute();
        if (!userData[0]) {
            return e.json(
                {
                    status: 400,
                    message: "You don't have access to this server",
                },
                {
                    status: 400,
                }
            );
        }
        const user: IUserServerAccess = userData[0];
        if (!user.servers.find((server) => server.id === server_id)) {
            return e.json(
                {
                    status: 400,
                    message: "You don't have access to this server",
                },
                {
                    status: 400,
                }
            );
        }
        const discordServer = discord.guilds.cache.get(server_id);
        if (!discordServer) return e.json({ error: "Server not found" });
        const channel = discordServer.channels.cache.get(channel_id);
        if (!channel) return e.json({ error: "Channel not found" });
        if (type === "twitch") {
            const dataLiveReq = await fetch(
                process.env.API_SERVER_LIVE + "/twitch/" + username,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );
            const dataLive = await dataLiveReq.json();
            if (!dataLive?.user?.username) {
                return e.json({
                    status: 400,
                    message: `User ${username} not found on Twitch`,
                });
            }
            const check = await db
                .select()
                .from(discordBotTwitch)
                .where(eq(discordBotTwitch.username, username));
            if (check.length <= 1) {
                await deleteEventSubSubscription(username);
            }
            await createEventSubSubscription(username, "stream.online");
            const updateRow = await db
                .update(discordBotTwitch)
                .set({
                    channel_id: channel_id,
                    username: username,
                    message: message,
                    social_links: social_links || false,
                    social_link_url: social_link_url,
                    keep_vod: keep_vod || false,
                })
                .where(
                    and(
                        eq(discordBotTwitch.id, id),
                        eq(discordBotTwitch.server_id, server_id)
                    )
                )
                .returning();
            if (updateRow.length > 0) {
                return e.json({
                    status: 200,
                    message: "Twitch connection updated",
                    data: updateRow,
                });
            } else {
                return e.json({
                    status: 500,
                    message: "Error updating Twitch connection",
                });
            }
        }
        if (type === "kick") {
            const dataLiveReq = await fetch(
                process.env.API_SERVER_LIVE + "/kick/" + username,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );
            const dataLive = await dataLiveReq.json();
            if (!dataLive?.user?.username) {
                return e.json({
                    status: 400,
                    message: `User ${username} not found on Kick`,
                });
            }
            const check = await db
                .select()
                .from(discordBotKick)
                .where(eq(discordBotKick.username, username));
            if (check.length <= 1) {
                await deleteEventSubSubscriptionKick(check?.[0]?.sub_id);
            }
            const eventSub = await createEventSubSubscriptionKick(
                username,
                "livestream.status.updated"
            );
            const updateRow = await db
                .update(discordBotKick)
                .set({
                    channel_id: channel_id,
                    username: username,
                    message: message,
                    social_links: social_links || false,
                    social_link_url: social_link_url,
                    keep_vod: keep_vod || false,
                    sub_id: eventSub || "",
                })
                .where(
                    and(
                        eq(discordBotKick.id, id),
                        eq(discordBotKick.server_id, server_id)
                    )
                )
                .returning();
            if (updateRow.length > 0) {
                return e.json({
                    status: 200,
                    message: "Kick connection updated",
                    data: updateRow,
                });
            } else {
                return e.json({
                    status: 500,
                    message: "Error updating Kick connection",
                });
            }
        }
        if (type === "youtubeLive") {
            const dataLiveReq = await fetch(
                process.env.API_SERVER_LIVE +
                    "/youtube/@" +
                    username.replace("@", ""),
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );
            const dataLive = await dataLiveReq.json();
            if (!dataLive?.channel?.id) {
                return e.json({
                    status: 400,
                    message: `User ${username.replace(
                        "@",
                        ""
                    )} not found on Youtube`,
                });
            }
            const updateRow = await db
                .update(discordBotYoutubeLive)
                .set({
                    channel_id: channel_id,
                    username: username.replace("@", ""),
                    message: message,
                    social_links: social_links || false,
                    social_link_url: social_link_url,
                    keep_vod: keep_vod || false,
                })
                .where(
                    and(
                        eq(discordBotYoutubeLive.id, id),
                        eq(discordBotYoutubeLive.server_id, server_id)
                    )
                )
                .returning();
            if (updateRow.length > 0) {
                return e.json({
                    status: 200,
                    message: "Youtube Live connection updated",
                    data: updateRow,
                });
            } else {
                return e.json({
                    status: 500,
                    message: "Error updating Youtube Live connection",
                });
            }
        }
        if (type === "youtubeLatest") {
            const dataLiveReq = await fetch(
                process.env.API_SERVER_LIVE +
                    "/youtube/@" +
                    username.replace("@", ""),
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );
            const dataLive = await dataLiveReq.json();
            if (!dataLive?.channel?.id) {
                return e.json({
                    status: 400,
                    message: `User ${username.replace(
                        "@",
                        ""
                    )} not found on Youtube`,
                });
            }
            const updateRow = await db
                .update(discordBotYoutubeLatest)
                .set({
                    channel_id: channel_id,
                    username: username.replace("@", ""),
                    youtube_id: dataLive.channel?.id,
                    message: message,
                    social_links: social_links || false,
                    social_link_url: social_link_url,
                })
                .where(
                    and(
                        eq(discordBotYoutubeLatest.id, id),
                        eq(discordBotYoutubeLatest.server_id, server_id)
                    )
                )
                .returning();
            if (updateRow.length > 0) {
                return e.json({
                    status: 200,
                    message: "Youtube Latest connection updated",
                    data: updateRow,
                });
            } else {
                return e.json({
                    status: 500,
                    message: "Error updating Youtube Latest connection",
                });
            }
        }
        if (type === "youtubeShort") {
            const dataLiveReq = await fetch(
                process.env.API_SERVER_LIVE +
                    "/youtube/@" +
                    username.replace("@", ""),
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );
            const dataLive = await dataLiveReq.json();
            if (!dataLive?.channel?.id) {
                return e.json({
                    status: 400,
                    message: `User ${username.replace(
                        "@",
                        ""
                    )} not found on Youtube`,
                });
            }
            const updateRow = await db
                .update(discordBotYoutubeLatestShort)
                .set({
                    channel_id: channel_id,
                    username: username.replace("@", ""),
                    youtube_id: dataLive.channel?.id,
                    message: message,
                    social_links: social_links || false,
                    social_link_url: social_link_url,
                })
                .where(
                    and(
                        eq(discordBotYoutubeLatestShort.id, id),
                        eq(discordBotYoutubeLatestShort.server_id, server_id)
                    )
                )
                .returning();
            if (updateRow.length > 0) {
                return e.json({
                    status: 200,
                    message: "Youtube Latest Short connection updated",
                    data: updateRow,
                });
            } else {
                return e.json({
                    status: 500,
                    message: "Error updating Youtube Latest Short connection",
                });
            }
        }
        return e.json({
            status: 400,
            message: `Invalid key: 'type'. One of the following is required:`,
            fields: [
                {
                    key: "twitch",
                    type: "string",
                    description: "twitch connection",
                },
                {
                    key: "youtubeLive",
                    type: "string",
                    description: "youtube live connection",
                },
                {
                    key: "youtubeLatest",
                    type: "string",
                    description: "youtube latest connection",
                },
                {
                    key: "youtubeShort",
                    type: "string",
                    description: "youtube latest short connection",
                },
            ],
        });
    } catch (error) {
        console.error("Error in /api/v1/connection PATCH:", error?.toString());
        return e.json({ error: error?.toString() }, { status: 500 });
    }
});
app.delete("/api/v1/connection", async (e) => {
    try {
        const body = await e.req.json();
        const { valid, error, fields } = validateBodyConnectionRemove(body);
        if (!valid) {
            return e.json(
                {
                    status: 400,
                    message: error,
                    fields: fields,
                },
                {
                    status: 400,
                }
            );
        }
        const { server_id, user_id, id, type } = body;
        const userData: any = await db
            .select()
            .from(userServerAccess)
            .where(eq(userServerAccess.discord_user_id, user_id))
            .limit(1)
            .execute();
        if (!userData[0]) {
            return e.json(
                {
                    status: 400,
                    message: "You don't have access to this server",
                },
                {
                    status: 400,
                }
            );
        }
        const user: IUserServerAccess = userData[0];
        if (!user.servers.find((server) => server.id === server_id)) {
            return e.json(
                {
                    status: 400,
                    message: "You don't have access to this server",
                },
                {
                    status: 400,
                }
            );
        }
        const discordServer = discord.guilds.cache.get(server_id);
        if (!discordServer) return e.json({ error: "Server not found" });
        if (type === "twitch") {
            const getRow = await db
                .select()
                .from(discordBotTwitch)
                .where(
                    and(
                        eq(discordBotTwitch.id, id),
                        eq(discordBotTwitch.server_id, server_id)
                    )
                );
            if (getRow.length === 0) {
                return e.json({
                    status: 500,
                    message: "Twitch connection not found",
                });
            }
            await deleteEventSubSubscription(getRow[0].username);
            const deleteRow = await db
                .delete(discordBotTwitch)
                .where(
                    and(
                        eq(discordBotTwitch.id, id),
                        eq(discordBotTwitch.server_id, server_id)
                    )
                );
            if (deleteRow.length === 0) {
                return e.json({
                    status: 200,
                    message: "Twitch connection removed",
                });
            } else {
                return e.json({
                    status: 500,
                    message: "Error removing Twitch connection",
                });
            }
        }
        if (type === "kick") {
            const getRow = await db
                .select()
                .from(discordBotKick)
                .where(
                    and(
                        eq(discordBotKick.id, id),
                        eq(discordBotKick.server_id, server_id)
                    )
                );
            if (getRow.length === 0) {
                return e.json({
                    status: 500,
                    message: "Kick connection not found",
                });
            }
            await deleteEventSubSubscriptionKick(getRow[0].sub_id);
            const deleteRow = await db
                .delete(discordBotKick)
                .where(
                    and(
                        eq(discordBotKick.id, id),
                        eq(discordBotKick.server_id, server_id)
                    )
                );
            if (deleteRow.length === 0) {
                return e.json({
                    status: 200,
                    message: "Kick connection removed",
                });
            } else {
                return e.json({
                    status: 500,
                    message: "Error removing Kick connection",
                });
            }
        }
        if (type === "youtubeLive") {
            const getRow = await db
                .select()
                .from(discordBotYoutubeLive)
                .where(
                    and(
                        eq(discordBotYoutubeLive.id, id),
                        eq(discordBotYoutubeLive.server_id, server_id)
                    )
                );
            if (getRow.length === 0) {
                return e.json({
                    status: 500,
                    message: "Youtube Live connection not found",
                });
            }
            const deleteRow = await db
                .delete(discordBotYoutubeLive)
                .where(
                    and(
                        eq(discordBotYoutubeLive.id, id),
                        eq(discordBotYoutubeLive.server_id, server_id)
                    )
                );
            if (deleteRow.length === 0) {
                return e.json({
                    status: 200,
                    message: "Youtube Live connection removed",
                });
            } else {
                return e.json({
                    status: 500,
                    message: "Error removing Youtube Live connection",
                });
            }
        }
        if (type === "youtubeLatest") {
            const getRow = await db
                .select()
                .from(discordBotYoutubeLatest)
                .where(
                    and(
                        eq(discordBotYoutubeLatest.id, id),
                        eq(discordBotYoutubeLatest.server_id, server_id)
                    )
                );
            if (getRow.length === 0) {
                return e.json({
                    status: 500,
                    message: "Youtube Latest connection not found",
                });
            }
            const deleteRow = await db
                .delete(discordBotYoutubeLatest)
                .where(
                    and(
                        eq(discordBotYoutubeLatest.id, id),
                        eq(discordBotYoutubeLatest.server_id, server_id)
                    )
                );
            if (deleteRow.length === 0) {
                return e.json({
                    status: 200,
                    message: "Youtube Latest connection removed",
                });
            } else {
                return e.json({
                    status: 500,
                    message: "Error removing Youtube Latest connection",
                });
            }
        }
        if (type === "youtubeShort") {
            const getRow = await db
                .select()
                .from(discordBotYoutubeLatestShort)
                .where(
                    and(
                        eq(discordBotYoutubeLatestShort.id, id),
                        eq(discordBotYoutubeLatestShort.server_id, server_id)
                    )
                );
            if (getRow.length === 0) {
                return e.json({
                    status: 500,
                    message: "Youtube Latest Short connection not found",
                });
            }
            const deleteRow = await db
                .delete(discordBotYoutubeLatestShort)
                .where(
                    and(
                        eq(discordBotYoutubeLatestShort.id, id),
                        eq(discordBotYoutubeLatestShort.server_id, server_id)
                    )
                );
            if (deleteRow.length === 0) {
                return e.json({
                    status: 200,
                    message: "Youtube Latest Short connection removed",
                });
            } else {
                return e.json({
                    status: 500,
                    message: "Error removing Youtube Latest Short connection",
                });
            }
        }
        return e.json({
            status: 400,
            message: `Invalid key: 'type'. One of the following is required:`,
            fields: [
                {
                    key: "twitch",
                    type: "string",
                    description: "twitch connection",
                },
                {
                    key: "kick",
                    type: "string",
                    description: "kick connection",
                },
                {
                    key: "youtubeLive",
                    type: "string",
                    description: "youtube live connection",
                },
                {
                    key: "youtubeLatest",
                    type: "string",
                    description: "youtube latest connection",
                },
                {
                    key: "youtubeShort",
                    type: "string",
                    description: "youtube latest short connection",
                },
            ],
        });
    } catch (error) {
        console.error("Error in /api/v1/connection DELETE:", error?.toString());
        return e.json({ error: error?.toString() }, { status: 500 });
    }
});
app.get("/api/v1/all", async (e) => {
    try {
        const twitch = await db.select().from(discordBotTwitch);
        const kick = await db.select().from(discordBotKick);
        const youtubeLive = await db.select().from(discordBotYoutubeLive);
        const youtubeLatest = await db.select().from(discordBotYoutubeLatest);
        const youtubeLatestShort = await db
            .select()
            .from(discordBotYoutubeLatestShort);
        const servers = Array.from(
            new Map(
                (
                    await Promise.all(
                        twitch.map(async (server_id) => {
                            const discordServer = discord.guilds.cache.get(
                                server_id.server_id
                            );
                            return {
                                server_id: server_id.server_id,
                                server_name: discordServer?.name,
                                server_logo:
                                    discordServer?.iconURL() ||
                                    getRandomAvatarUrl(),
                                twitch: twitch.filter(
                                    (e) => e.server_id === server_id.server_id
                                ),
                                kick: kick.filter(
                                    (e) => e.server_id === server_id.server_id
                                ),
                                youtubeLive: youtubeLive.filter(
                                    (e) => e.server_id === server_id.server_id
                                ),
                                youtubeLatest: youtubeLatest.filter(
                                    (e) => e.server_id === server_id.server_id
                                ),
                                youtubeLatestShort: youtubeLatestShort.filter(
                                    (e) => e.server_id === server_id.server_id
                                ),
                            };
                        })
                    )
                ).map((server) => [server.server_id, server]) // Use Map to ensure unique server_id
            ).values()
        );
        const live = twitch.filter((e) => e.message_id);
        return e.json(
            {
                live,
                twitch: twitch.length,
                youtubeLive: youtubeLive.length,
                youtubeLatest: youtubeLatest.length,
                youtubeLatestShor: youtubeLatestShort.length,
                servers,
            },
            {
                status: 200,
            }
        );
    } catch (error) {
        console.error("Error in /api/v1/all GET:", error?.toString());
        return e.json({ error: error?.toString() }, { status: 500 });
    }
});
app.get("/auth/login", (e) => {
    const url = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${process.env.SERVER_URL}/auth/callback&response_type=code&scope=identify%20guilds`;
    return e.redirect(url);
});
app.post("/twitch/callback", async (c) => {
    return twitchCallbackHandler(c);
});
app.post("/kick/callback", async (c) => {
    return kickCallbackHandler(c);
});
app.get("/auth/callback", async (c) => {
    try {
        const code = c.req.query().code;
        if (!code) {
            return c.json({ error: "No code provided" }, 400);
        }
        const response = await fetch(`https://discord.com/api/oauth2/token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID || "",
                client_secret: process.env.DISCORD_CLIENT_SECRET || "",
                code,
                grant_type: "authorization_code",
                redirect_uri: `${process.env.SERVER_URL}/auth/callback`,
                scope: "identify",
            }).toString(),
        });
        const data = await response.json();
        const accessToken = data.access_token;
        const userResult = await fetch("https://discord.com/api/users/@me", {
            headers: {
                authorization: `Bearer ${accessToken}`,
            },
        });
        const user = await userResult.json();
        const guilds = await fetchGuildsWithAdminPermissions(accessToken);
        const existingUser = await db
            .select()
            .from(userServerAccess)
            .where(eq(userServerAccess.discord_user_id, user.id))
            .limit(1)
            .execute();
        if (existingUser.length > 0) {
            // User exists, update the servers list
            await db
                .update(userServerAccess)
                .set({
                    servers: guilds, // Update the servers array
                })
                .where(eq(userServerAccess.discord_user_id, user.id)); // Update for this user ID
        } else {
            // User does not exist, insert a new record
            await db.insert(userServerAccess).values({
                id: crypto.randomUUID(),
                discord_user_id: user.id,
                discord_username: user.username,
                servers: guilds,
            });
        }
        return c.redirect(`https://doras.to/admin/settings/discord`);
    } catch (error) {
        console.error("Error in /auth/callback GET:", error?.toString());
        return c.json({ error: error?.toString() }, { status: 500 });
    }
});
app.get("/api/live/twitch/:slug", async (c) => {
    try {
        let data = {
            live: false,
            id: "",
            title: "",
            category: "",
            viewers: "",
            started_at: "",
            image: "",
            tags: [],
            user: {
                username: null,
                display_name: null,
                broadcaster_type: null,
                description: null,
                profile_image: null,
                offline_image: null,
            },
            video: {
                live_id: null,
                id: null,
                title: null,
                description: null,
                created_at: null,
                published_at: null,
                url: null,
                thumbnail_url: null,
                view_count: null,
                duration: null,
            },
        };
        const tokenManager = new TwitchTokenManager();
        const slug = c.req.param("slug");
        const userData = await getTwitchUser(slug);
        const accessToken = await tokenManager.getAccessToken();
        if (!userData) {
            return c.json(data, { status: 200 });
        }
        await fetch(`https://api.twitch.tv/helix/streams?user_login=` + slug, {
            method: "GET",
            headers: {
                Authorization: "Bearer " + accessToken,
                "Client-ID": process.env.TWITCH_CLIENT_ID || "",
            },
        })
            .then(function (response) {
                return response.json();
            })
            .then(async function (twitch_data) {
                if (twitch_data?.status == 401) {
                    return c.json(data, { status: 200 });
                }
                if (
                    twitch_data.data?.length == 0 ||
                    !twitch_data.data ||
                    twitch_data.data == undefined
                ) {
                    return c.json(data, { status: 200 });
                }
                twitch_data = twitch_data.data[0];
                data = {
                    live: true,
                    id: twitch_data?.id,
                    title: twitch_data?.title,
                    category: twitch_data?.game_name,
                    viewers: twitch_data?.viewer_count,
                    started_at: twitch_data?.started_at,
                    image: twitch_data?.thumbnail_url
                        .replace("{width}", "1920")
                        .replace("{height}", "1080")
                        .replace(".jpg", ".jpg?random=" + Math.random()),
                    tags: twitch_data?.tags,
                    user: {
                        username: (userData.login as any) || null,
                        display_name: (userData.display_name as any) || null,
                        broadcaster_type:
                            (userData.broadcaster_type as any) || null,
                        description: (userData.description as any) || null,
                        profile_image:
                            (userData.profile_image_url as any) || null,
                        offline_image:
                            (userData.offline_image_url as any) || null,
                    },
                    video: {
                        live_id: null,
                        id: null,
                        title: null,
                        description: null,
                        created_at: null,
                        published_at: null,
                        url: null,
                        thumbnail_url: null,
                        view_count: null,
                        duration: null,
                    },
                };
                return c.json(data, { status: 200 });
            })
            .catch(function (err) {
                console.error("err: ", err);
            });
        const videoReq = await fetch(
            `https://api.twitch.tv/helix/videos?user_id=` +
                userData?.id +
                "&first=1",
            {
                method: "GET",
                headers: {
                    Authorization: "Bearer " + accessToken,
                    "Client-ID": process.env.TWITCH_CLIENT_ID || "",
                },
            }
        );
        const videoData = await videoReq.json();
        if (data.live == false) {
            data.user = {
                username: (userData.login as any) || null,
                display_name: (userData.display_name as any) || null,
                broadcaster_type: (userData.broadcaster_type as any) || null,
                description: (userData.description as any) || null,
                profile_image: (userData.profile_image_url as any) || null,
                offline_image: (userData.offline_image_url as any) || null,
            };
            if (videoData.data[0]) {
                const match = videoData?.data[0].thumbnail_url
                    .replace("%{width}", "1920")
                    .replace("%{height}", "1080")
                    .match(/_(\d+)_/);
                let live_id;
                if (match) {
                    live_id = match[1];
                }
                data.video = {
                    live_id: live_id,
                    id: videoData?.data[0].id || null,
                    title: videoData?.data[0].title || null,
                    description: videoData?.data[0].description || null,
                    created_at: videoData?.data[0].created_at || null,
                    published_at: videoData?.data[0].published_at || null,
                    url: videoData?.data[0].url || null,
                    thumbnail_url:
                        videoData?.data[0].thumbnail_url
                            .replace("%{width}", "1920")
                            .replace("%{height}", "1080") || null,
                    view_count: videoData?.data[0].view_count || null,
                    duration: videoData?.data[0].duration || null,
                };
            }
        }
        return c.json(data, { status: 200 });
    } catch (error) {
        console.error(
            "Error in /api/v1/get_all_connections:",
            error?.toString()
        );
        return c.json({ error: error?.toString() }, { status: 500 });
    }
});
serve({
    fetch: app.fetch,
    hostname: "0.0.0.0",
    port: 5468,
}).on("listening", () => {
    console_log.colour("Server is running on port 5468", "green");
});
const hasAdminPermission = (permissions: number) => {
    const ADMINISTRATOR_PERMISSION = 0x8; // Bit flag for Administrator permission
    return (
        (permissions & ADMINISTRATOR_PERMISSION) === ADMINISTRATOR_PERMISSION
    );
};
const fetchGuildsWithAdminPermissions = async (accessToken: string) => {
    try {
        const guildsResponse = await fetch(
            "https://discord.com/api/v10/users/@me/guilds",
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        );

        const guildsData = await guildsResponse.json();

        const guildsWithAdminPerms = guildsData
            .filter((guild: any) => {
                if (hasAdminPermission(guild.permissions)) {
                    return true;
                }
                return false;
            })
            .map((guild: any) => ({
                id: guild.id,
                name: guild.name,
                owner: guild.owner,
                permissions: guild.permissions,
            }));

        return guildsWithAdminPerms;
    } catch (error) {
        console.error("Error fetching guilds with admin permissions:", error);
        return [];
    }
};

const TWITCH_MESSAGE_ID = "Twitch-Eventsub-Message-Id";
const TWITCH_MESSAGE_TIMESTAMP = "Twitch-Eventsub-Message-Timestamp";
const TWITCH_MESSAGE_SIGNATURE = "Twitch-Eventsub-Message-Signature";
const MESSAGE_TYPE = "Twitch-Eventsub-Message-Type";

const MESSAGE_TYPE_VERIFICATION = "webhook_callback_verification";
const MESSAGE_TYPE_NOTIFICATION = "notification";
const MESSAGE_TYPE_REVOCATION = "revocation";

const HMAC_PREFIX = "sha256=";

const getHmacMessage = (
    messageId: string,
    messageTimestamp: string,
    rawBody: string
): string => {
    if (!messageId || !messageTimestamp) {
        throw new Error("Missing required headers for HMAC verification.");
    }
    // Need the entire raw body, so read it using req.text()
    return messageId + messageTimestamp + rawBody;
};

const getHmac = (secret: string, message: string): string => {
    const hmac = crypto
        .createHmac("sha256", secret)
        .update(message)
        .digest("hex");

    return hmac;
};

const verifyMessage = (hmac: string, signature: string | null): boolean => {
    if (!signature) {
        console.warn("No signature header found");
        return false;
    }
    return hmac === signature;
};
export const twitchCallbackHandler = async (c: Context) => {
    try {
        const req = c.req.raw; // Get the raw Request object
        const secret = getSecret();
        // Read the raw body BEFORE parsing as JSON (critical for HMAC verification)
        const rawBody = await c.req.text();
        const messageId = req.headers.get(TWITCH_MESSAGE_ID) ?? "";
        const messageTimestamp =
            req.headers.get(TWITCH_MESSAGE_TIMESTAMP) ?? "";
        const message = getHmacMessage(messageId, messageTimestamp, rawBody); //rawBody is read inside here
        const hmac = HMAC_PREFIX + getHmac(secret, message); // Signature to compare
        const signature = req.headers.get(TWITCH_MESSAGE_SIGNATURE);
        if (verifyMessage(hmac, signature)) {
            const messageType = req.headers.get(MESSAGE_TYPE);
            const notification = JSON.parse(rawBody);
            if (messageType === MESSAGE_TYPE_NOTIFICATION) {
                if (notification.subscription.type === "stream.online") {
                    const items = await db
                        .select()
                        .from(discordBotTwitch)
                        .where(
                            eq(
                                discordBotTwitch.username,
                                notification.event.broadcaster_user_login.toLowerCase()
                            )
                        )
                        .execute();
                    setTimeout(async () => {
                        for (const [index, item] of items.entries()) {
                            await twitchLiveEmbeds(item, index);
                        }
                    }, 5000);
                }
                c.status(204);
                return c.text(""); // Send a 204 No Content
            } else if (messageType === MESSAGE_TYPE_VERIFICATION) {
                c.header("Content-Type", "text/plain");
                c.status(200);
                return c.text(notification.challenge);
            } else if (messageType === MESSAGE_TYPE_REVOCATION) {
                c.status(204);
                console.log(
                    `${notification.subscription.type} notifications revoked!`
                );
                console.log(`reason: ${notification.subscription.status}`);
                console.log(
                    `condition: ${JSON.stringify(
                        notification.subscription.condition,
                        null,
                        4
                    )}`
                );
                return c.text(""); // Send a 204 No Content
            } else {
                c.status(204);
                console.log(
                    `Unknown message type: ${req.headers.get(MESSAGE_TYPE)}`
                );
                return c.text(""); // Send a 204 No Content
            }
        } else {
            console.log("403"); // Signatures didn't match.
            c.status(403);
            return c.text("Signature verification failed");
        }
    } catch (error) {
        console.error("Error processing Twitch callback:", error);
        c.status(500);
        return c.json({ error: "Internal server error" });
    }
};
export const kickCallbackHandler = async (c: Context) => {
    try {
        const req = c.req.raw; // Get the raw Request object
        const type = req.headers.get("kick-event-type") ?? "";
        if (type === "livestream.status.updated") {
            const body = await req.json();
            if (body.is_live) {
                console.log("kick live:", body);
                const items = await db
                    .select()
                    .from(discordBotKick)
                    .where(
                        eq(
                            discordBotKick.username,
                            body.broadcaster.channel_slug.toLowerCase()
                        )
                    )
                    .execute();
                setTimeout(async () => {
                    for (const [index, item] of items.entries()) {
                        await kickLiveEmbeds(item, index);
                    }
                }, 5000);
            }
        }
        return c.text("OK");
    } catch (error) {
        console.error("Error processing Kick callback:", error);
        c.status(500);
        return c.json({ error: "Internal server error" });
    }
};
