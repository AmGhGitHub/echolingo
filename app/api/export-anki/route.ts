import { NextResponse } from "next/server";
import { db } from "@/lib/database";

export async function GET() {
  try {
    // Get words from last 7 days
    const result = await db.execute({
      sql: `
        SELECT word, pronunciation, definitions, examples, synonyms, created_at
        FROM words
        WHERE created_at >= datetime('now', '-7 days')
      `,
    });

    const csvRows: string[] = [];

    for (const row of result.rows) {
      csvRows.push(
        [
          String(row.word ?? ""),
          String(row.pronunciation ?? ""),
          formatMultiEntry(row.definitions),
          formatMultiEntry(row.examples),
          formatMultiEntry(row.synonyms),
          String(row.created_at ?? ""),
        ]
          .map((field) => escapeCsvField(field))
          .map((field) => `"${field}"`)
          .join(",")
      );
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
function formatMultiEntry(items: unknown): string {
  if (!items) return "";
  if (typeof items !== "string") return String(items);
  try {
    const arr = JSON.parse(items);
    if (Array.isArray(arr)) {
      return arr.map((item) => `• ${item}`).join("\n");
    }
    return items;
  } catch {
    return items;
  }
}

function escapeCsvField(field: unknown): string {
  const stringField = typeof field === "string" ? field : String(field ?? "");
  return stringField.replace(/"/g, '""').replace(/\n/g, "<br>");
}
