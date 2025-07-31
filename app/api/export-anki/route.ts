import { NextRequest, NextResponse } from 'next/server';
import { getSavedWords, getSavedIdioms } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    // Fixed to export last 7 days
    const daysAgo = 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysAgo);

    // Get all saved words and idioms
    const words = await getSavedWords();
    const idioms = await getSavedIdioms();

    // Filter items saved within the specified days
    const filteredWords = words.filter(word => 
      new Date(word.savedAt) >= cutoffDate
    );
    const filteredIdioms = idioms.filter(idiom => 
      new Date(idiom.savedAt) >= cutoffDate
    );

    // Convert to Anki CSV format
    const csvRows: string[] = [];
    
    // Process words
    filteredWords.forEach(word => {
      const wordField = word.word;
      const pronunciationField = word.pronunciation || '';
      const definitionField = formatMultiEntry(word.definitions);
      const exampleField = formatMultiEntry(word.examples);
      const persianField = formatMultiEntry(word.persianTranslations);
      const tags = `echolingo vocabulary ${word.mode}`;
      
      csvRows.push(`"${escapeCsvField(wordField)}","${escapeCsvField(pronunciationField)}","${escapeCsvField(definitionField)}","${escapeCsvField(exampleField)}","${escapeCsvField(persianField)}","${tags}"`);
    });

    // Process idioms
    filteredIdioms.forEach(idiom => {
      const wordField = idiom.idiom;
      const pronunciationField = ''; // Idioms don't have pronunciation
      const definitionField = formatMultiEntry(idiom.meaning);
      const exampleField = formatMultiEntry(idiom.examples);
      const persianField = formatMultiEntry(idiom.persianTranslations);
      const tags = `echolingo idiom ${idiom.mode}`;
      
      csvRows.push(`"${escapeCsvField(wordField)}","${escapeCsvField(pronunciationField)}","${escapeCsvField(definitionField)}","${escapeCsvField(exampleField)}","${escapeCsvField(persianField)}","${tags}"`);
    });

    const csvContent = csvRows.join('\n');

    // Create response with CSV file
    const response = new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="echolingo_anki_7_days.csv"`,
      },
    });

    return response;

  } catch (error) {
    console.error('Error exporting Anki CSV:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to format multi-entry fields with bullet points
function formatMultiEntry(items: string[] | string): string {
  if (!items) return '';
  
  // Handle case where items might be a JSON string
  let array: string[];
  if (typeof items === 'string') {
    try {
      array = JSON.parse(items);
    } catch {
      return items; // Return as-is if not valid JSON
    }
  } else {
    array = items;
  }
  
  if (!Array.isArray(array) || array.length === 0) return '';
  
  // Format with bullet points
  return array.map(item => `• ${item}`).join('\n');
}

// Helper function to escape CSV fields
function escapeCsvField(field: string): string {
  return field.replace(/"/g, '""').replace(/\n/g, '<br>');
} 