import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
      prompt = `Analyze the English word "${word.trim()}" and provide detailed information.

Return a JSON object with this exact structure:
{
  "word": "the word exactly as provided",
  "pronunciation": "phonetic pronunciation using IPA notation with slashes (e.g., /ˈwɜːrd/)",
  "definitions": [
    "definition 1 - most common meaning",
    "definition 2 - if significantly different meaning exists",
    "definition 3 - if another important meaning exists"
  ],
  "examples": [
    "example sentence 1 using the word in context 1",
    "example sentence 2 using the word in context 2",
    "example sentence 3 using the word in context 3"
  ],
  "persianTranslations": [
    "Persian translation 1",
    "Persian translation 2",
    "Persian translation 3"
  ]
}

Guidelines:
- Include 2-4 definitions if the word has multiple important meanings
- If the word has only one main meaning, provide just one definition
- Provide 2-4 example sentences showing different uses/contexts
- Include 2-4 Persian/Farsi translations that cover the different meanings
- Use clear, educational language
- Focus on the most common and useful meanings
- Each definition should be concise but complete`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: expectIdiom
            ? "You are an English-Persian idiom and phrase teacher. Always respond with valid JSON. Provide accurate translations and educational content. Include multiple meanings, examples, and translations when the idiom has different uses."
            : "You are an English-Persian dictionary and language teacher. Always respond with valid JSON. Provide accurate translations and educational content. Include multiple definitions, examples, and translations when the word has different meanings or uses."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 800,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content received from OpenAI');
    }

    // Parse the JSON response
    const resultData = JSON.parse(content);

    // Validate the response structure
    if (expectIdiom) {
      if (!resultData.idiom || !resultData.meaning || !resultData.persianTranslations) {
        throw new Error('Invalid idiom response format from OpenAI');
      }
    } else {
      if (!resultData.word || !resultData.definitions || !resultData.persianTranslations) {
        throw new Error('Invalid vocabulary response format from OpenAI');
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