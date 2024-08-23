import {
    pgTable,
    uuid,
    timestamp,
    text,
    jsonb,
    boolean,
} from "drizzle-orm/pg-core";

export const auditLogs = pgTable("audit_logs", {
    id: uuid("id").primaryKey().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
    accountId: uuid("account_id"),
    event: text("event"),
    actorId: text("actor_id"),
    type: text("type"),
    newValue: jsonb("new_value"),
    oldValue: jsonb("old_value"),
});

export const discordBot = pgTable("discord_bot", {
    id: uuid("id").primaryKey().notNull(),
    server_id: text("server_id"),
    twitch: jsonb("twitch").default([]).notNull(),
});

export const discordBotTwitch = pgTable("discord_bot_twitch", {
    id: uuid("id").primaryKey().notNull(),
    account_id: text("account_id").notNull(),
    server_id: text("server_id").notNull(),
    channel_id: text("channel_id").notNull(),
    username: text("username").notNull(),
    message_id: text("message_id"),
    social_links: boolean("social_links").default(false).notNull(),
    keep_vod: boolean("keep_vod").default(false).notNull(),
    mention: text("mention"),
    message: text("message"),
    vod_id: text("vod_id"),
});
