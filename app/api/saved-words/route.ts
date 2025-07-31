import { NextRequest, NextResponse } from 'next/server';
import { getSavedWords, getSavedIdioms, SavedWord, SavedIdiom } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'words', 'idioms', or 'all'

    let words: SavedWord[] = [];
    let idioms: SavedIdiom[] = [];

    if (!type || type === 'all') {
      words = await getSavedWords();
      idioms = await getSavedIdioms();
    } else if (type === 'words') {
      words = await getSavedWords();
    } else if (type === 'idioms') {
      idioms = await getSavedIdioms();
    } else {
      return NextResponse.json(
        { error: 'Invalid type parameter. Must be "words", "idioms", or "all"' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        words,
        idioms,
        totalWords: words.length,
        totalIdioms: idioms.length
      }
    });

  } catch (error) {
    console.error('Error retrieving saved words:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 