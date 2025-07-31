import { NextRequest, NextResponse } from 'next/server';
import { saveWord, saveIdiom, isWordSaved, isIdiomSaved } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mode, data } = body;

    if (!mode || !data) {
      return NextResponse.json(
        { error: 'Missing required fields: mode and data' },
        { status: 400 }
      );
    }

    let savedItem;
    let isAlreadySaved = false;

    if (mode === 'vocabulary') {
      const { word, pronunciation, definitions, examples, persianTranslations } = data;
      
      if (!word || !pronunciation || !definitions || !examples || !persianTranslations) {
        return NextResponse.json(
          { error: 'Missing required vocabulary fields' },
          { status: 400 }
        );
      }

      isAlreadySaved = await isWordSaved(word);
      savedItem = await saveWord({
        word,
        pronunciation,
        definitions,
        examples,
        persianTranslations,
        mode: 'vocabulary'
      });
    } else if (mode === 'idiom') {
      const { idiom, meaning, examples, persianTranslations } = data;
      
      if (!idiom || !meaning || !examples || !persianTranslations) {
        return NextResponse.json(
          { error: 'Missing required idiom fields' },
          { status: 400 }
        );
      }

      isAlreadySaved = await isIdiomSaved(idiom);
      savedItem = await saveIdiom({
        idiom,
        meaning,
        examples,
        persianTranslations,
        mode: 'idiom'
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid mode. Must be "vocabulary" or "idiom"' },
        { status: 400 }
      );
    }

    // If savedItem is null, it means the word/idiom already existed and wasn't saved again
    if (savedItem === null) {
      return NextResponse.json({
        success: true,
        data: null,
        isAlreadySaved: true,
        message: 'Word already exists in database'
      });
    }

    return NextResponse.json({
      success: true,
      data: savedItem,
      isAlreadySaved,
      message: isAlreadySaved ? 'Word updated successfully' : 'Word saved successfully'
    });

  } catch (error) {
    console.error('Error saving word:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const word = searchParams.get('word');
    const mode = searchParams.get('mode');

    if (!word || !mode) {
      return NextResponse.json(
        { error: 'Missing required parameters: word and mode' },
        { status: 400 }
      );
    }

    let isSaved = false;
    if (mode === 'vocabulary') {
      isSaved = await isWordSaved(word);
    } else if (mode === 'idiom') {
      isSaved = await isIdiomSaved(word);
    } else {
      return NextResponse.json(
        { error: 'Invalid mode. Must be "vocabulary" or "idiom"' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      isSaved,
      word,
      mode
    });

  } catch (error) {
    console.error('Error checking saved status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 