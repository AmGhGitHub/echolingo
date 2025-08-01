// lib/database.ts
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// ...rest of your code
import { createClient } from "@libsql/client";

const dbUrl = process.env.TURSO_DATABASE_URL;
const dbAuthToken = process.env.TURSO_AUTH_TOKEN;

if (!dbUrl) {
  throw new Error("TURSO_DATABASE_URL is not set in .env.local");
}

export const db = createClient({
  url: dbUrl,
  authToken: dbAuthToken,
});
