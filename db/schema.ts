import {
    pgTable,
    uuid,
    timestamp,
    text,
    jsonb,
    boolean,
} from "drizzle-orm/pg-core";

export const discordBotTwitch = pgTable("discord_bot_twitch", {
    id: uuid("id").primaryKey().notNull(),
    account_id: text("account_id").notNull(),
    server_id: text("server_id").notNull(),
    channel_id: text("channel_id").notNull(),
    username: text("username").notNull(),
    message_id: text("message_id"),
    social_links: boolean("social_links").default(false).notNull(),
    social_link_url: text("social_link_url"),
    keep_vod: boolean("keep_vod").default(false).notNull(),
    mention: text("mention"),
    message: text("message"),
    vod_id: text("vod_id"),
    live: boolean("live").default(false).notNull(),
    last_live: text("last_live"),
    live_started_at: text("live_started_at"),
});

export const discordBotKick = pgTable("discord_bot_kick", {
    id: uuid("id").primaryKey().notNull(),
    account_id: text("account_id").notNull(),
    server_id: text("server_id").notNull(),
    channel_id: text("channel_id").notNull(),
    username: text("username").notNull(),
    message_id: text("message_id"),
    social_links: boolean("social_links").default(false).notNull(),
    social_link_url: text("social_link_url"),
    keep_vod: boolean("keep_vod").default(false).notNull(),
    mention: text("mention"),
    message: text("message"),
    vod_id: text("vod_id"),
    live: boolean("live").default(false).notNull(),
    last_live: text("last_live"),
    live_started_at: text("live_started_at"),
    sub_id: text("sub_id").notNull(),
});

export const discordBotYoutubeLive = pgTable("discord_bot_youtube_live", {
    id: uuid("id").primaryKey().notNull(),
    account_id: text("account_id").notNull(),
    server_id: text("server_id").notNull(),
    channel_id: text("channel_id").notNull(),
    username: text("username").notNull(),
    message_id: text("message_id"),
    social_links: boolean("social_links").default(false).notNull(),
    social_link_url: text("social_link_url"),
    keep_vod: boolean("keep_vod").default(false).notNull(),
    message: text("message"),
    vod_id: text("vod_id"),
    live: boolean("live").default(false).notNull(),
    last_live: text("last_live"),
    live_started_at: text("live_started_at"),
});

export const discordBotYoutubeLatest = pgTable("discord_bot_youtube_latest", {
    id: uuid("id").primaryKey().notNull(),
    account_id: text("account_id").notNull(),
    server_id: text("server_id").notNull(),
    channel_id: text("channel_id").notNull(),
    username: text("username").notNull(),
    youtube_id: text("youtube_id").notNull(),
    social_links: boolean("social_links").default(false).notNull(),
    social_link_url: text("social_link_url"),
    message: text("message"),
    video_id: text("video_id"),
});

export const discordBotYoutubeLatestShort = pgTable(
    "discord_bot_youtube_latest_short",
    {
        id: uuid("id").primaryKey().notNull(),
        account_id: text("account_id").notNull(),
        server_id: text("server_id").notNull(),
        channel_id: text("channel_id").notNull(),
        username: text("username").notNull(),
        youtube_id: text("youtube_id").notNull(),
        social_links: boolean("social_links").default(false).notNull(),
        social_link_url: text("social_link_url"),
        message: text("message"),
        video_id: text("video_id"),
    }
);

export const discordBotServer = pgTable("discord_bot_server", {
    id: uuid("id").primaryKey().notNull(),
    account_id: text("account_id").notNull(),
    server_id: text("server_id").notNull(),
    name: text("name").notNull(),
    icon: text("icon"),
    banner: text("banner"),
    channels: jsonb("channels").default([]),
    roles: jsonb("roles").default([]),
    created_at: timestamp("created_at").defaultNow().notNull(),
});

export const userServerAccess = pgTable("user_server_access", {
    id: uuid("id").primaryKey().notNull(), // Unique identifier for each user record
    discord_user_id: text("discord_user_id").notNull().unique(), // The user's Discord ID
    discord_username: text("discord_username").notNull(), // The user's Discord username
    servers: jsonb("servers").default([]), // An array of servers the user is part of (JSONB type)
    created_at: timestamp("created_at").defaultNow().notNull(), // Timestamp of when the user record was created
});
