// app/api/save-word/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/database";

let posColumnEnsured = false;
async function ensurePosColumn(): Promise<void> {
  if (posColumnEnsured) return;
  try {
    // Try to add the column; if it already exists, this will throw and we ignore it
    await db.execute("ALTER TABLE words ADD COLUMN pos TEXT");
  } catch (err) {
    // Ignore duplicate column errors; other errors are non-fatal here
  } finally {
    posColumnEnsured = true;
  }
}

// GET method to check if a word exists
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const word = searchParams.get('word');

    if (!word) {
      return NextResponse.json({ error: "Word parameter is required" }, { status: 400 });
    }

    const wordLower = word.toLowerCase();

    // Check if the word exists
    const result = await db.execute({
      sql: "SELECT id FROM words WHERE word = ?",
      args: [wordLower],
    });

    return NextResponse.json({
      isSaved: result.rows.length > 0
    });
  } catch (error) {
    console.error('Error checking word status:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensurePosColumn();
    const data = await request.json();
    const {
      word,
      pronunciation = "",
      definitions = [],
      examples = [],
      synonyms = [],
      pos = "",
    } = data;

    if (!word) {
      return NextResponse.json({ error: "Word is required" }, { status: 400 });
    }

    const wordLower = word.toLowerCase();

    // Check if the word already exists
    const check = await db.execute({
      sql: "SELECT id FROM words WHERE word = ?",
      args: [wordLower],
    });

    if (check.rows.length > 0) {
      return NextResponse.json(
        { message: "Word already exists" },
        { status: 200 }
      );
    }

    // Insert the word
    await db.execute({
      sql: `
        INSERT INTO words (word, pronunciation, definitions, examples, synonyms, pos)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      args: [
        wordLower,
        pronunciation,
        JSON.stringify(definitions),
        JSON.stringify(examples),
        JSON.stringify(synonyms),
        pos,
      ],
    });

    return NextResponse.json(
      { message: "Word saved successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
