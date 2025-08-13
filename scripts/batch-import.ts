// scripts/batch-import.ts
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import OpenAI from 'openai';
import { db } from '../lib/database';

type Entry = {
  partOfSpeech: string;
  definitions: string[];
  examples: string[];
  persianTranslations: string[];
};

type VocabResult = {
  word: string;
  pronunciation?: string;
  entries?: Entry[];
  definitions?: string[];
  examples?: string[];
  persianTranslations?: string[];
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Retry helpers
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 800;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let attempt = 0;
  let lastError: unknown;
  while (attempt < MAX_RETRIES) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      attempt += 1;
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);
      console.warn(`[retry] ${label} failed (attempt ${attempt}/${MAX_RETRIES}). Waiting ${delay}ms...`);
      await sleep(delay);
    }
  }
  throw lastError;
}

async function ensurePosColumn(): Promise<void> {
  try {
    await db.execute('ALTER TABLE words ADD COLUMN pos TEXT');
  } catch {
    // ignore if it already exists
  }
}

async function analyzeWord(word: string): Promise<VocabResult> {
  const prompt = `Analyze the English word "${word.trim()}" and provide detailed information, including multiple parts of speech if relevant.

Return a JSON object with this exact structure:
{
  "word": "the word exactly as provided",
  "pronunciation": "phonetic pronunciation using IPA notation with slashes (e.g., /ˈwɜːrd/)",
  "entries": [
    {
      "partOfSpeech": "one of: noun | verb | adjective | adverb | pronoun | preposition | conjunction | interjection | determiner",
      "definitions": [
        "definition 1 (for this partOfSpeech)",
        "definition 2 (if significantly different)",
        "definition 3 (if another important meaning exists)"
      ],
      "examples": [
        "example sentence 1 using the word as this partOfSpeech",
        "example sentence 2 using the word as this partOfSpeech"
      ],
      "persianTranslations": [
        "Persian translation 1",
        "Persian translation 2"
      ]
    }
  ],
  // Also include aggregated lists across all entries (unique/merged):
  "definitions": ["...merged unique definitions across entries..."],
  "examples": ["...merged unique examples across entries..."],
  "persianTranslations": ["...merged unique translations across entries..."]
}

Guidelines:
- If the word functions as multiple parts of speech commonly (e.g., "run" as noun and verb), include separate entries for each (max 2-3)
- Keep examples natural (CEFR B1-B2) and make sure they match the respective partOfSpeech
- The aggregated arrays must be present and deduplicated across all entries
- Use clear, educational language`;

  const completion = await withRetry(
    () =>
      openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are an English-Persian dictionary and language teacher. Always respond with valid JSON. Provide multiple entries when the word has more than one common part of speech. Ensure definitions/examples match each entry\'s part of speech and also include aggregated arrays across entries.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      }),
    `openai:${word}`
  );

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('No content from OpenAI');
  const raw = content.trim();
  let jsonText = raw;
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  }
  let resultData: VocabResult;
  try {
    resultData = JSON.parse(jsonText) as VocabResult;
  } catch {
    // Try to extract the first JSON object in the string
    const match = jsonText.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('Failed to parse JSON from OpenAI response');
    }
    resultData = JSON.parse(match[0]) as VocabResult;
  }

  if (!resultData.word) throw new Error('Invalid vocabulary response: missing word');

  const hasEntries = Array.isArray(resultData.entries) && resultData.entries.length > 0;
  const hasTopLevel = Array.isArray(resultData.definitions) && Array.isArray(resultData.persianTranslations);
  if (!hasEntries && !hasTopLevel) {
    throw new Error('Invalid vocabulary response: missing entries and top-level arrays');
  }

  if (hasEntries) {
    const mergedDefinitions = new Set<string>();
    const mergedExamples = new Set<string>();
    const mergedTranslations = new Set<string>();
    for (const entry of resultData.entries!) {
      const pos = String(entry.partOfSpeech).toLowerCase();
      (entry.definitions || []).forEach((d) => mergedDefinitions.add(`[${pos}] ${d}`));
      (entry.examples || []).forEach((e) => mergedExamples.add(`[${pos}] ${e}`));
      (entry.persianTranslations || []).forEach((t) => mergedTranslations.add(`[${pos}] ${t}`));
    }
    if (!Array.isArray(resultData.definitions)) {
      resultData.definitions = Array.from(mergedDefinitions);
    }
    if (!Array.isArray(resultData.examples)) {
      resultData.examples = Array.from(mergedExamples);
    }
    if (!Array.isArray(resultData.persianTranslations)) {
      resultData.persianTranslations = Array.from(mergedTranslations);
    }
  }

  return resultData;
}

function derivePos(result: VocabResult): string {
  if (result.entries && result.entries.length > 0) {
    const set = new Set(
      result.entries
        .map((e) => String(e.partOfSpeech || '').toLowerCase())
        .filter((s) => s)
    );
    return Array.from(set).join(' | ');
  }
  return '';
}

async function upsertWord(result: VocabResult): Promise<void> {
  const wordLower = result.word.toLowerCase();
  const pronunciation = String(result.pronunciation || '');
  const definitions = JSON.stringify(result.definitions || []);
  const examples = JSON.stringify(result.examples || []);
  const synonyms = JSON.stringify(result.persianTranslations || []);
  const pos = derivePos(result);

  await db.execute({
    sql: `
      INSERT INTO words (word, pronunciation, definitions, examples, synonyms, pos)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(word) DO UPDATE SET
        pronunciation=excluded.pronunciation,
        definitions=excluded.definitions,
        examples=excluded.examples,
        synonyms=excluded.synonyms,
        pos=excluded.pos
    `,
    args: [wordLower, pronunciation, definitions, examples, synonyms, pos],
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: tsx scripts/batch-import.ts <word-list-file> [--truncate]');
    process.exit(1);
  }
  const file = path.resolve(args[0]);
  const truncate = args.includes('--truncate');

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set in environment or .env.local');
    process.exit(1);
  }

  const content = fs.readFileSync(file, 'utf-8');
  const words = content
    .split(/\r?\n/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);

  if (words.length === 0) {
    console.log('No words found in file.');
    process.exit(0);
  }

  await ensurePosColumn();

  if (truncate) {
    console.log('Truncating table words...');
    await db.execute('DELETE FROM words');
  }

  console.log(`Importing ${words.length} words...`);
  for (const [index, word] of words.entries()) {
    try {
      console.log(`[${index + 1}/${words.length}] Analyzing: ${word}`);
      const result = await analyzeWord(word);
      await upsertWord(result);
    } catch (err) {
      console.error(`Failed to import '${word}':`, err);
    }
  }

  console.log('Done.');
  process.exit(0);
}

main();


