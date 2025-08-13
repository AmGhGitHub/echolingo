import { NextResponse } from "next/server";
import { db } from "@/lib/database";

export async function GET() {
  try {
    // Get words from last 7 days
    const result = await db.execute({
      sql: `
        SELECT word, pos, pronunciation, definitions, examples, synonyms, created_at
        FROM words
        WHERE created_at >= datetime('now', '-7 days')
      `,
    });

    const csvRows: string[] = [];

    for (const row of result.rows) {
      const word = String(row.word ?? "");
      const pos = String(row.pos ?? "");
      const pronunciation = String(row.pronunciation ?? "");
      const createdAt = String(row.created_at ?? "");

      const definitions = safeParseStringArray(String(row.definitions ?? ""));
      const examples = safeParseStringArray(String(row.examples ?? ""));
      const translations = safeParseStringArray(String(row.synonyms ?? ""));

      const groups = groupByPartOfSpeech(definitions, examples, translations);

      if (groups.size === 0) {
        // Fallback: no POS tagging detected, keep single row
        csvRows.push(
          [
            word,
            pos,
            pronunciation,
            unorderedList(definitions),
            unorderedList(examples),
            unorderedList(translations),
            createdAt,
          ]
            .map((field) => escapeCsvField(field))
            .map((field) => `"${field}"`)
            .join(",")
        );
      } else {
        for (const [pos, data] of groups.entries()) {
          const wordWithPos = pos ? `${word} (${pos})` : word;
          csvRows.push(
            [
              wordWithPos,
              pos,
              pronunciation,
              unorderedList(data.definitions),
              unorderedList(data.examples),
              unorderedList(data.translations),
              createdAt,
            ]
              .map((field) => escapeCsvField(field))
              .map((field) => `"${field}"`)
              .join(",")
          );
        }
      }
    }

    const csvContent = csvRows.join("\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="echolingo_anki_7_days.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting Anki CSV:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper functions
function unorderedList(items: string[]): string {
  const safeItems = (items || []).map((item) => item.trim()).filter(Boolean);
  if (safeItems.length === 0) return "";
  const listItems = safeItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return `<ul>${listItems}</ul>`;
}

function safeParseStringArray(maybeJsonArray: string): string[] {
  if (!maybeJsonArray) return [];
  try {
    const parsed = JSON.parse(maybeJsonArray);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

type PosGroup = {
  definitions: string[];
  examples: string[];
  translations: string[];
};

const POS_REGEX = /^\s*\[(noun|verb|adjective|adverb|pronoun|preposition|conjunction|interjection|determiner)\]\s*/i;

function groupByPartOfSpeech(
  definitions: string[],
  examples: string[],
  translations: string[]
): Map<string, PosGroup> {
  const groups = new Map<string, PosGroup>();

  const anyTagged = [...definitions, ...examples, ...translations].some((s) => POS_REGEX.test(s));
  if (!anyTagged) {
    return groups; // empty means fallback single-row mode
  }

  const addItem = (posKey: string, type: keyof PosGroup, value: string) => {
    const key = posKey.toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, { definitions: [], examples: [], translations: [] });
    }
    groups.get(key)![type].push(value);
  };

  const process = (items: string[], type: keyof PosGroup) => {
    for (const raw of items) {
      const match = raw.match(POS_REGEX);
      if (match) {
        const pos = match[1];
        const cleaned = raw.replace(POS_REGEX, "").trim();
        if (cleaned) addItem(pos, type, cleaned);
      } else {
        // Untagged items: replicate across all groups later; collect separately
        addItem("general", type, raw.trim());
      }
    }
  };

  process(definitions, "definitions");
  process(examples, "examples");
  process(translations, "translations");

  // If we only have general (no specific POS extracted), treat as untagged
  const keys = [...groups.keys()].filter((k) => k !== "general");
  if (keys.length === 0) {
    return new Map();
  }

  // Distribute general items to each specific POS group
  const general = groups.get("general");
  if (general) {
    for (const key of keys) {
      const g = groups.get(key)!;
      g.definitions.push(...general.definitions);
      g.examples.push(...general.examples);
      g.translations.push(...general.translations);
    }
    groups.delete("general");
  }

  return groups;
}

function escapeCsvField(field: unknown): string {
  const stringField = typeof field === "string" ? field : String(field ?? "");
  return stringField.replace(/"/g, '""').replace(/\n/g, "<br>");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
