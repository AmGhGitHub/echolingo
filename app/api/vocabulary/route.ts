import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Retry helpers for flaky API responses
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 600;

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

export async function POST(request: NextRequest) {
  try {
    const { word, mode } = await request.json();

    if (!word || word.trim().length === 0) {
      return NextResponse.json(
        { error: 'Word is required' },
        { status: 400 }
      );
    }

    let prompt = '';
    let expectIdiom = false;
    if (mode === 'idiom') {
      expectIdiom = true;
      prompt = `Analyze the English idiom or phrase "${word.trim()}" and provide detailed information.

Return a JSON object with this exact structure:
{
  "idiom": "the idiom or phrase exactly as provided",
  "meaning": [
    "meaning 1 - most common meaning",
    "meaning 2 - if significantly different meaning exists"
  ],
  "examples": [
    "example sentence 1 using the idiom in context 1",
    "example sentence 2 using the idiom in context 2"
  ],
  "persianTranslations": [
    "Persian translation 1",
    "Persian translation 2"
  ]
}

Guidelines:
- Include 1-2 meanings if the idiom has multiple important meanings
- Provide 2-3 example sentences showing different uses/contexts
- Include 1-3 Persian/Farsi translations that cover the different meanings
- Use clear, educational language
- Focus on the most common and useful meanings
- Each meaning should be concise but complete`;
    } else {
      prompt = `Analyze the English word "${word.trim()}" and provide detailed information, including multiple parts of speech if relevant.

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
    // include up to 2-3 entries for other common parts of speech, if applicable
  ],
  // Also include aggregated lists across all entries (unique/merged) for backward compatibility:
  "definitions": ["...merged unique definitions across entries..."],
  "examples": ["...merged unique examples across entries..."],
  "persianTranslations": ["...merged unique translations across entries..."]
}

Guidelines:
- If the word functions as multiple parts of speech commonly (e.g., "run" as noun and verb), include separate entries for each (max 2-3)
- Keep examples natural (CEFR B1-B2) and make sure they match the respective partOfSpeech
- The aggregated arrays must be present and deduplicated across all entries
- Use clear, educational language`;
    }

    const completion = await withRetry(
      () => openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: expectIdiom
              ? "You are an English-Persian idiom and phrase teacher. Always respond with valid JSON. Provide accurate translations and educational content. Include multiple meanings, examples, and translations when the idiom has different uses."
              : "You are an English-Persian dictionary and language teacher. Always respond with valid JSON. Provide multiple entries when the word has more than one common part of speech. Ensure definitions/examples match each entry's part of speech and also include aggregated arrays across entries."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      }),
      `openai:${word}:${mode}`
    );

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content received from OpenAI');
    }

    // Parse the JSON response (defensive against fenced output)
    const raw = String(content).trim();
    let jsonText = raw;
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    }
    let resultData: {
      word?: string;
      idiom?: string;
      entries?: Array<{ partOfSpeech: string; definitions: string[]; examples?: string[]; persianTranslations: string[] }>;
      definitions?: string[];
      examples?: string[];
      persianTranslations?: string[];
      [key: string]: unknown;
    };
    try {
      resultData = JSON.parse(jsonText);
    } catch {
      const match = jsonText.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error('Failed to parse JSON from OpenAI response');
      }
      resultData = JSON.parse(match[0]);
    }

    // Validate the response structure
    if (expectIdiom) {
      if (!resultData.idiom || !resultData.meaning || !resultData.persianTranslations) {
        throw new Error('Invalid idiom response format from OpenAI');
      }
    } else {
      if (!resultData.word) {
        throw new Error('Invalid vocabulary response format from OpenAI: missing word');
      }
      // entries is preferred; if missing, we still allow top-level arrays for backward compatibility
      const hasEntries = Array.isArray(resultData.entries) && resultData.entries.length > 0;
      const hasTopLevel = Array.isArray(resultData.definitions) && Array.isArray(resultData.persianTranslations);
      if (!hasEntries && !hasTopLevel) {
        throw new Error('Invalid vocabulary response format from OpenAI: missing entries and top-level arrays');
      }

      // If entries exist but aggregated arrays are missing, build them
      if (hasEntries) {
        const mergedDefinitions = new Set<string>();
        const mergedExamples = new Set<string>();
        const mergedTranslations = new Set<string>();
        for (const entry of (resultData.entries || [])) {
          if (!entry.partOfSpeech || !Array.isArray(entry.definitions) || !Array.isArray(entry.persianTranslations)) {
            throw new Error('Invalid entry format from OpenAI');
          }
          const pos = String(entry.partOfSpeech).toLowerCase();
          (entry.definitions || []).forEach((d: string) => mergedDefinitions.add(`[${pos}] ${d}`));
          (entry.examples || []).forEach((e: string) => mergedExamples.add(`[${pos}] ${e}`));
          (entry.persianTranslations || []).forEach((t: string) => mergedTranslations.add(`[${pos}] ${t}`));
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
    }

    return NextResponse.json(resultData);
  } catch (error) {
    console.error('Error generating vocabulary/idiom:', error);
    return NextResponse.json(
      { error: 'Failed to generate vocabulary or idiom information' },
      { status: 500 }
    );
  }
} 