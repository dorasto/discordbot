import "dotenv/config";
import * as schema from "./schema";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
// TypeScript type for the users table
const queryClient = postgres(process.env.POSTGRES_URL || "");
export const db = drizzle(queryClient, { schema });
// test();
async function test() {
    await db.insert(schema.discordBotTwitch).values({
        id: "8abb7df6-fd7d-4350-8f00-d2ca3eaf3ebe",
        account_id: "123456789",
        channel_id: "1262765510194364446",
        server_id: "636803646536810496",
        username: "troykomodo",
        message_id: null,
        social_links: false,
        keep_vod: true,
    });
}
