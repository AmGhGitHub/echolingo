import sqlite3 from 'sqlite3';
import path from 'path';

// Type for SQLite row results
interface SQLiteRow {
  [key: string]: string | number | null;
}

interface CountRow {
  count: number;
}

export interface SavedWord {
  id: string;
  word: string;
  pronunciation: string;
  definitions: string;
  examples: string;
  persianTranslations: string;
  mode: 'vocabulary' | 'idiom';
  savedAt: string;
}

export interface SavedIdiom {
  id: string;
  idiom: string;
  meaning: string;
  examples: string;
  persianTranslations: string;
  mode: 'vocabulary' | 'idiom';
  savedAt: string;
}

const DB_PATH = path.join(process.cwd(), 'data', 'echolingo.db');

// Initialize database and create tables
const initDB = (): Promise<sqlite3.Database> => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }

      // Create words table
      db.run(`
        CREATE TABLE IF NOT EXISTS words (
          id TEXT PRIMARY KEY,
          word TEXT UNIQUE NOT NULL,
          pronunciation TEXT NOT NULL,
          definitions TEXT NOT NULL,
          examples TEXT NOT NULL,
          persianTranslations TEXT NOT NULL,
          mode TEXT NOT NULL,
          savedAt TEXT NOT NULL
        )
      `, (err) => {
        if (err) {
          reject(err);
          return;
        }

        // Create idioms table
        db.run(`
          CREATE TABLE IF NOT EXISTS idioms (
            id TEXT PRIMARY KEY,
            idiom TEXT UNIQUE NOT NULL,
            meaning TEXT NOT NULL,
            examples TEXT NOT NULL,
            persianTranslations TEXT NOT NULL,
            mode TEXT NOT NULL,
            savedAt TEXT NOT NULL
          )
        `, (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(db);
        });
      });
    });
  });
};

// Helper function to get database instance
const getDB = async (): Promise<sqlite3.Database> => {
  return await initDB();
};

// Save a word (only if it doesn't exist)
export const saveWord = async (wordData: Omit<SavedWord, 'id' | 'savedAt'>): Promise<SavedWord | null> => {
  const db = await getDB();
  
  return new Promise((resolve, reject) => {
    // Check if word already exists
    db.get(
      'SELECT * FROM words WHERE LOWER(word) = LOWER(?)',
      [wordData.word],
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        // If word already exists, return null (don't save duplicate)
        if (row) {
          resolve(null);
          return;
        }

        // Save new word
        const newWord: SavedWord = {
          ...wordData,
          id: `${wordData.word}-${Date.now()}`,
          savedAt: new Date().toISOString(),
          definitions: JSON.stringify(wordData.definitions),
          examples: JSON.stringify(wordData.examples),
          persianTranslations: JSON.stringify(wordData.persianTranslations)
        };

        db.run(
          'INSERT INTO words (id, word, pronunciation, definitions, examples, persianTranslations, mode, savedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [newWord.id, newWord.word, newWord.pronunciation, newWord.definitions, newWord.examples, newWord.persianTranslations, newWord.mode, newWord.savedAt],
          function(err) {
            if (err) {
              reject(err);
              return;
            }
            
            // Return the word with parsed arrays
            resolve({
              ...newWord,
              definitions: wordData.definitions,
              examples: wordData.examples,
              persianTranslations: wordData.persianTranslations
            });
          }
        );
      }
    );
  });
};

// Save an idiom (only if it doesn't exist)
export const saveIdiom = async (idiomData: Omit<SavedIdiom, 'id' | 'savedAt'>): Promise<SavedIdiom | null> => {
  const db = await getDB();
  
  return new Promise((resolve, reject) => {
    // Check if idiom already exists
    db.get(
      'SELECT * FROM idioms WHERE LOWER(idiom) = LOWER(?)',
      [idiomData.idiom],
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        // If idiom already exists, return null (don't save duplicate)
        if (row) {
          resolve(null);
          return;
        }

        // Save new idiom
        const newIdiom: SavedIdiom = {
          ...idiomData,
          id: `${idiomData.idiom}-${Date.now()}`,
          savedAt: new Date().toISOString(),
          meaning: JSON.stringify(idiomData.meaning),
          examples: JSON.stringify(idiomData.examples),
          persianTranslations: JSON.stringify(idiomData.persianTranslations)
        };

        db.run(
          'INSERT INTO idioms (id, idiom, meaning, examples, persianTranslations, mode, savedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [newIdiom.id, newIdiom.idiom, newIdiom.meaning, newIdiom.examples, newIdiom.persianTranslations, newIdiom.mode, newIdiom.savedAt],
          function(err) {
            if (err) {
              reject(err);
              return;
            }
            
            // Return the idiom with parsed arrays
            resolve({
              ...newIdiom,
              meaning: idiomData.meaning,
              examples: idiomData.examples,
              persianTranslations: idiomData.persianTranslations
            });
          }
        );
      }
    );
  });
};

// Get all saved words
export const getSavedWords = async (): Promise<SavedWord[]> => {
  const db = await getDB();
  
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM words ORDER BY savedAt DESC',
      [],
      (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const words = (rows as SQLiteRow[]).map((row) => ({
          ...row,
          definitions: JSON.parse(row.definitions as string),
          examples: JSON.parse(row.examples as string),
          persianTranslations: JSON.parse(row.persianTranslations as string)
        })) as SavedWord[];

        resolve(words);
      }
    );
  });
};

// Get all saved idioms
export const getSavedIdioms = async (): Promise<SavedIdiom[]> => {
  const db = await getDB();
  
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM idioms ORDER BY savedAt DESC',
      [],
      (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const idioms = (rows as SQLiteRow[]).map((row) => ({
          ...row,
          meaning: JSON.parse(row.meaning as string),
          examples: JSON.parse(row.examples as string),
          persianTranslations: JSON.parse(row.persianTranslations as string)
        })) as SavedIdiom[];

        resolve(idioms);
      }
    );
  });
};

// Check if word is saved
export const isWordSaved = async (word: string): Promise<boolean> => {
  const db = await getDB();
  
  return new Promise((resolve, reject) => {
            db.get(
          'SELECT COUNT(*) as count FROM words WHERE LOWER(word) = LOWER(?)',
          [word],
          (err, row) => {
            if (err) {
              reject(err);
              return;
            }
            resolve((row as CountRow).count > 0);
          }
        );
  });
};

// Check if idiom is saved
export const isIdiomSaved = async (idiom: string): Promise<boolean> => {
  const db = await getDB();
  
  return new Promise((resolve, reject) => {
            db.get(
          'SELECT COUNT(*) as count FROM idioms WHERE LOWER(idiom) = LOWER(?)',
          [idiom],
          (err, row) => {
            if (err) {
              reject(err);
              return;
            }
            resolve((row as CountRow).count > 0);
          }
        );
  });
};

// Delete a saved word
export const deleteSavedWord = async (word: string): Promise<boolean> => {
  const db = await getDB();
  
  return new Promise((resolve, reject) => {
    db.run(
      'DELETE FROM words WHERE LOWER(word) = LOWER(?)',
      [word],
      function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.changes > 0);
      }
    );
  });
};

// Delete a saved idiom
export const deleteSavedIdiom = async (idiom: string): Promise<boolean> => {
  const db = await getDB();
  
  return new Promise((resolve, reject) => {
    db.run(
      'DELETE FROM idioms WHERE LOWER(idiom) = LOWER(?)',
      [idiom],
      function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.changes > 0);
      }
    );
  });
}; 