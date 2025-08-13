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
      pos TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Ensure backward compatibility: add 'pos' column if the table already existed without it
  const tableInfo = await db.execute({ sql: "PRAGMA table_info(words)" });
  let hasPos = false;
  for (const row of tableInfo.rows as Array<Record<string, unknown>>) {
    if (String(row["name"]) === 'pos') { hasPos = true; break; }
  }
  if (!hasPos) {
    await db.execute(`ALTER TABLE words ADD COLUMN pos TEXT`);
  }
  console.log("Table created!");
  process.exit(0);
}

init();
