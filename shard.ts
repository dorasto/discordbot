import { ShardingManager } from "discord.js";
import { config } from "dotenv";

// Load environment variables from .env file (optional)
config();

const token = process.env.DISCORD_TOKEN || "your-token-goes-here";
const manager = new ShardingManager("./build/index.js", {
    totalShards: "auto",
    mode: "worker",
    token,
});

manager.on("shardCreate", (shard) => {
    console.log(`Shard ${shard.id} launched`);
});

manager
    .spawn()
    .catch((error) => console.error(`[ERROR/SHARD] Shard failed to spawn.`));
