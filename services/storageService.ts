
import type { GeneratedCharacters, SavedCast } from '../types';

const CASTS_STORAGE_KEY = 'ai-broforce-casts';

class StorageService {
  public saveCast(name: string, characters: GeneratedCharacters): void {
    try {
      if (!name.trim()) {
        console.error("Cast name cannot be empty.");
        return;
      }
      const casts = this.loadCasts();
      // Overwrite if name exists, otherwise add new
      const existingIndex = casts.findIndex(c => c.name.toLowerCase() === name.toLowerCase());
      const newCast: SavedCast = { name, characters, createdAt: Date.now() };

      if (existingIndex > -1) {
        casts[existingIndex] = newCast;
      } else {
        casts.unshift(newCast);
      }
      localStorage.setItem(CASTS_STORAGE_KEY, JSON.stringify(casts));
    } catch (error) {
      console.error("Error saving cast to local storage:", error);
    }
  }

  public loadCasts(): SavedCast[] {
    try {
      const data = localStorage.getItem(CASTS_STORAGE_KEY);
      const casts = data ? (JSON.parse(data) as SavedCast[]) : [];
      // Sort by creation date, newest first
      return casts.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error("Error loading casts from local storage:", error);
      return [];
    }
  }

  public deleteCast(name: string): void {
    try {
      const casts = this.loadCasts().filter(c => c.name !== name);
      localStorage.setItem(CASTS_STORAGE_KEY, JSON.stringify(casts));
    } catch (error) {
      console.error("Error deleting cast from local storage:", error);
    }
  }

  public getAllCharacterImages(): string[] {
    try {
        const casts = this.loadCasts();
        const images: string[] = [];
        casts.forEach(cast => {
            cast.characters.heroes.forEach(h => { if(h.imageUrl) images.push(h.imageUrl); });
            cast.characters.villains.forEach(v => { if(v.imageUrl) images.push(v.imageUrl); });
        });
        // Shuffle images for better variety
        return images.sort(() => 0.5 - Math.random());
    } catch (error) {
        console.error("Error retrieving images:", error);
        return [];
    }
  }
}

export const storageService = new StorageService();
