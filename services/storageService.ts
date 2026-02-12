
import type { GeneratedCharacters, SavedCast, HighScore, CharacterProfile } from '../types';

const DB_NAME = 'AI_Broforce_DB';
const DB_VERSION = 1;
const STORE_CASTS = 'casts';
const STORE_SCORES = 'scores';
const STORE_HEROES = 'hero_pool';
const STORE_VILLAINS = 'villain_pool';

class StorageService {
  private dbPromise: Promise<IDBDatabase>;

  constructor() {
    this.dbPromise = this.initDB();
  }

  private initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => {
          console.error("IndexedDB initialization error:", request.error);
          reject(request.error);
      };

      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Casts: key = name
        if (!db.objectStoreNames.contains(STORE_CASTS)) {
          db.createObjectStore(STORE_CASTS, { keyPath: 'name' });
        }
        // Scores: key = id
        if (!db.objectStoreNames.contains(STORE_SCORES)) {
          db.createObjectStore(STORE_SCORES, { keyPath: 'id' });
        }
        // Pools: key = id
        if (!db.objectStoreNames.contains(STORE_HEROES)) {
          db.createObjectStore(STORE_HEROES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_VILLAINS)) {
          db.createObjectStore(STORE_VILLAINS, { keyPath: 'id' });
        }
      };
    });
  }

  private async getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    const db = await this.dbPromise;
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  // --- Casts ---

  public async saveCast(name: string, characters: GeneratedCharacters): Promise<void> {
    if (!name.trim()) {
        console.error("Cast name cannot be empty.");
        return;
    }
    try {
        const store = await this.getStore(STORE_CASTS, 'readwrite');
        const newCast: SavedCast = { name: name.trim(), characters, createdAt: Date.now() };
        return new Promise((resolve, reject) => {
            const req = store.put(newCast);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.error("Failed to save cast:", e);
    }
  }

  public async loadCasts(): Promise<SavedCast[]> {
    try {
        const store = await this.getStore(STORE_CASTS);
        return new Promise((resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = () => {
                const result = req.result as SavedCast[];
                // Sort by newest first
                result.sort((a, b) => b.createdAt - a.createdAt);
                resolve(result);
            };
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.error("Failed to load casts:", e);
        return [];
    }
  }

  public async deleteCast(name: string): Promise<void> {
    try {
        const store = await this.getStore(STORE_CASTS, 'readwrite');
        return new Promise((resolve, reject) => {
            const req = store.delete(name);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.error("Failed to delete cast:", e);
    }
  }

  // --- Pools ---

  public async saveToPool(characters: CharacterProfile[], type: 'hero' | 'villain'): Promise<void> {
    try {
        const storeName = type === 'hero' ? STORE_HEROES : STORE_VILLAINS;
        const store = await this.getStore(storeName, 'readwrite');
        
        return new Promise((resolve, reject) => {
            // We can't reuse the transaction object easily for multiple puts in strict mode wrapper logic usually,
            // but here we opened it just now.
            // However, Promise wrappers around single operations is safer.
            // Ideally we use a transaction loop.
            const transaction = store.transaction;
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            
            // Re-get store from transaction to be safe
            const txStore = transaction.objectStore(storeName);
            characters.forEach(char => txStore.put(char));
        });
    } catch (e) {
        console.error(`Failed to save to ${type} pool:`, e);
    }
  }

  public async loadPool(type: 'hero' | 'villain'): Promise<CharacterProfile[]> {
    try {
        const storeName = type === 'hero' ? STORE_HEROES : STORE_VILLAINS;
        const store = await this.getStore(storeName);
        return new Promise((resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = () => {
                const res = req.result as CharacterProfile[];
                // Sort by ID (timestamp) desc
                res.sort((a, b) => b.id - a.id);
                resolve(res);
            };
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.error(`Failed to load ${type} pool:`, e);
        return [];
    }
  }

  public async getRandomVillainsFromPool(count: number): Promise<CharacterProfile[]> {
    const pool = await this.loadPool('villain');
    if (pool.length === 0) return [];
    return pool.sort(() => 0.5 - Math.random()).slice(0, count);
  }

  public async deleteCharacterFromPool(id: number, type: 'hero' | 'villain'): Promise<void> {
    try {
        const storeName = type === 'hero' ? STORE_HEROES : STORE_VILLAINS;
        const store = await this.getStore(storeName, 'readwrite');
        return new Promise((resolve, reject) => {
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.error(`Failed to delete from ${type} pool:`, e);
    }
  }

  // --- High Scores ---

  public async saveHighScore(score: Omit<HighScore, 'id'>): Promise<void> {
    try {
        const store = await this.getStore(STORE_SCORES, 'readwrite');
        const newScore: HighScore = { ...score, id: Date.now().toString() };
        return new Promise((resolve, reject) => {
            const req = store.put(newScore);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.error("Failed to save high score:", e);
    }
  }

  public async getHighScores(): Promise<HighScore[]> {
    try {
        const store = await this.getStore(STORE_SCORES);
        return new Promise((resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = () => {
                const scores = req.result as HighScore[];
                scores.sort((a, b) => b.score - a.score);
                resolve(scores.slice(0, 50)); // Top 50
            };
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.error("Failed to load high scores:", e);
        return [];
    }
  }

  // --- Utilities ---

  public async getAllCharacterImages(): Promise<string[]> {
    try {
        const [casts, heroes, villains] = await Promise.all([
            this.loadCasts(),
            this.loadPool('hero'),
            this.loadPool('villain')
        ]);
        
        const images: string[] = [];
        
        casts.forEach(cast => {
            cast.characters.heroes.forEach(h => { if(h.imageUrl) images.push(h.imageUrl); });
            cast.characters.villains.forEach(v => { if(v.imageUrl) images.push(v.imageUrl); });
        });

        heroes.forEach(h => { if(h.imageUrl) images.push(h.imageUrl); });
        villains.forEach(v => { if(v.imageUrl) images.push(v.imageUrl); });

        const uniqueImages = Array.from(new Set(images));
        return uniqueImages.sort(() => 0.5 - Math.random());
    } catch (error) {
        console.error("Error retrieving images:", error);
        return [];
    }
  }
}

export const storageService = new StorageService();
