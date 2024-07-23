import "dotenv/config";
import * as schema from "./schema";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
// TypeScript type for the users table
const queryClient = postgres(process.env.POSTGRES_URL || "");
export const db = drizzle(queryClient, { schema });
