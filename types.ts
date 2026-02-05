import {
    discordBotKick,
    discordBotTwitch,
    discordBotYoutubeLatest,
    discordBotYoutubeLive,
    discordBotXLatestPost,
    userServerAccess,
} from "./db/schema";

export type ITwitch = typeof discordBotTwitch.$inferInsert;
export type IKick = typeof discordBotKick.$inferInsert;
export type IYoutubeLive = typeof discordBotYoutubeLive.$inferInsert;
export type IYoutubeLatest = typeof discordBotYoutubeLatest.$inferInsert;
export type IYoutubeLatestShort = typeof discordBotYoutubeLatest.$inferInsert;
export type IXLatestPost = typeof discordBotXLatestPost.$inferInsert;
export type IUserServerAccess = typeof userServerAccess.$inferInsert & {
    servers: {
        id: string;
        name: string;
        owner: boolean;
        permissions: string;
    }[];
};
