import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

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

// In-memory storage for serverless environments
let inMemoryWords: SavedWord[] = [];
let inMemoryIdioms: SavedIdiom[] = [];
let useInMemory = false;

const DB_PATH = path.join(process.cwd(), 'data', 'echolingo.db');

// Check if we can use SQLite (not in serverless environment)
const canUseSQLite = (): boolean => {
  try {
    // Check if we're in a serverless environment
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      console.log('Detected serverless/production environment, using in-memory storage');
      return false;
    }
    
    // Check if data directory exists and is writable
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Test if we can write to the directory
    const testFile = path.join(dataDir, 'test.txt');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    
    console.log('SQLite database available, using persistent storage');
    return true;
  } catch (error) {
    console.log('SQLite not available, using in-memory storage:', error);
    return false;
  }
};

// Initialize database and create tables
const initDB = (): Promise<sqlite3.Database> => {
  return new Promise((resolve, reject) => {
    if (!canUseSQLite()) {
      useInMemory = true;
      reject(new Error('SQLite not available in this environment'));
      return;
    }

    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        useInMemory = true;
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
          useInMemory = true;
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
            useInMemory = true;
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
  if (useInMemory) {
    throw new Error('Using in-memory storage');
  }
  return await initDB();
};

// In-memory helper functions
const findWordInMemory = (word: string): SavedWord | undefined => {
  return inMemoryWords.find(w => w.word.toLowerCase() === word.toLowerCase());
};

const findIdiomInMemory = (idiom: string): SavedIdiom | undefined => {
  return inMemoryIdioms.find(i => i.idiom.toLowerCase() === idiom.toLowerCase());
};

// Save a word (only if it doesn't exist)
export const saveWord = async (wordData: Omit<SavedWord, 'id' | 'savedAt'>): Promise<SavedWord | null> => {
  try {
    if (useInMemory) {
      // Check if word already exists in memory
      const existing = findWordInMemory(wordData.word);
      if (existing) {
        return null; // Word already exists
      }

      // Save new word to memory
      const newWord: SavedWord = {
        ...wordData,
        id: `${wordData.word}-${Date.now()}`,
        savedAt: new Date().toISOString()
      };

      inMemoryWords.push(newWord);
      inMemoryWords.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
      
      return newWord;
    }

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
  } catch (error) {
    console.error('Error saving word:', error);
    throw error;
  }
};

// Save an idiom (only if it doesn't exist)
export const saveIdiom = async (idiomData: Omit<SavedIdiom, 'id' | 'savedAt'>): Promise<SavedIdiom | null> => {
  try {
    if (useInMemory) {
      // Check if idiom already exists in memory
      const existing = findIdiomInMemory(idiomData.idiom);
      if (existing) {
        return null; // Idiom already exists
      }

      // Save new idiom to memory
      const newIdiom: SavedIdiom = {
        ...idiomData,
        id: `${idiomData.idiom}-${Date.now()}`,
        savedAt: new Date().toISOString()
      };

      inMemoryIdioms.push(newIdiom);
      inMemoryIdioms.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
      
      return newIdiom;
    }

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
  } catch (error) {
    console.error('Error saving idiom:', error);
    throw error;
  }
};

// Get all saved words
export const getSavedWords = async (): Promise<SavedWord[]> => {
  try {
    if (useInMemory) {
      return inMemoryWords;
    }

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
  } catch (error) {
    console.error('Error getting saved words:', error);
    return [];
  }
};

// Get all saved idioms
export const getSavedIdioms = async (): Promise<SavedIdiom[]> => {
  try {
    if (useInMemory) {
      return inMemoryIdioms;
    }

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
  } catch (error) {
    console.error('Error getting saved idioms:', error);
    return [];
  }
};

// Check if word is saved
export const isWordSaved = async (word: string): Promise<boolean> => {
  try {
    if (useInMemory) {
      return findWordInMemory(word) !== undefined;
    }

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
  } catch (error) {
    console.error('Error checking if word is saved:', error);
    return false;
  }
};

// Check if idiom is saved
export const isIdiomSaved = async (idiom: string): Promise<boolean> => {
  try {
    if (useInMemory) {
      return findIdiomInMemory(idiom) !== undefined;
    }

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
  } catch (error) {
    console.error('Error checking if idiom is saved:', error);
    return false;
  }
};

// Delete a saved word
export const deleteSavedWord = async (word: string): Promise<boolean> => {
  try {
    if (useInMemory) {
      const initialLength = inMemoryWords.length;
      inMemoryWords = inMemoryWords.filter(w => w.word.toLowerCase() !== word.toLowerCase());
      return inMemoryWords.length !== initialLength;
    }

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
  } catch (error) {
    console.error('Error deleting saved word:', error);
    return false;
  }
};

// Delete a saved idiom
export const deleteSavedIdiom = async (idiom: string): Promise<boolean> => {
  try {
    if (useInMemory) {
      const initialLength = inMemoryIdioms.length;
      inMemoryIdioms = inMemoryIdioms.filter(i => i.idiom.toLowerCase() !== idiom.toLowerCase());
      return inMemoryIdioms.length !== initialLength;
    }

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
  } catch (error) {
    console.error('Error deleting saved idiom:', error);
    return false;
  }
}; 