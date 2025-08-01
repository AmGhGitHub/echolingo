// scripts/init-db.ts
import { db } from "../lib/database";

async function init() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT NOT NULL UNIQUE,
      pronunciation TEXT,
      definitions TEXT,
      examples TEXT,
      synonyms TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log("Table created!");
  process.exit(0);
}

init();
