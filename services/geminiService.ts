
import { GoogleGenAI, Type } from "@google/genai";
import type { GeneratedCharacters, CharacterProfile } from '../types';
import { validateGeneratedCharacters } from './validationService';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Retry wrapper for API calls to handle transient network errors (Code 6 / 500 / 503)
async function retryOperation<T>(operation: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
    try {
        return await operation();
    } catch (error: any) {
        const msg = error.message || JSON.stringify(error);
        
        // Check for specific XHR, RPC, or HTTP status errors that indicate temporary failure
        const isNetworkError = 
            msg.includes('xhr error') || 
            msg.includes('fetch failed') ||
            msg.includes('503') ||
            error.code === 500 || 
            error.code === 503 ||
            error.status === 503 || // Check status property often present in API errors
            error.code === 6;

        // Fail fast on quota errors (429 / Resource Exhausted) - Do not retry these
        if (error.status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
             throw new Error("API Quota Exceeded. Please try again later.");
        }

        if (isNetworkError && retries > 0) {
            console.warn(`API Error (${msg}). Retrying in ${delay}ms... Attempts left: ${retries}`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return retryOperation(operation, retries - 1, delay * 2);
        }
        throw error;
    }
}

const characterSchema = {
  type: Type.OBJECT,
  properties: {
    name: {
      type: Type.STRING,
      description: "The character's cool action-hero or villain name."
    },
    description: {
      type: Type.STRING,
      description: "A short, punchy, one-sentence description of the character's theme."
    },
    weaponType: {
        type: Type.STRING,
        description: "The character's primary weapon. Be creative and specific (e.g., 'Plasma Rifle', 'Dual-Wielding Pistols', 'BFG 9000', 'Laser Katana')."
    },
    specialAbility: {
        type: Type.STRING,
        description: "A brief (2-4 word) description of a unique special ability, e.g., 'Temporary Invincibility', 'Deployable Turret', 'Cluster Grenade'."
    },
    movementAbility: {
        type: Type.STRING,
        description: "A unique movement ability. Examples: 'Double Jump', 'Air Dash', 'Wall Slide'."
    },
    catchphrase: {
        type: Type.STRING,
        description: "A cheesy, memorable one-liner or catchphrase for the character. e.g., 'Hasta la vista, baddie.'"
    }
  }
};


export async function generateCharacters(theme: string, count: number = 5): Promise<GeneratedCharacters> {
  const generationSchema = {
    type: Type.OBJECT,
    properties: {
      heroes: {
        type: Type.ARRAY,
        description: `A list of ${count} unique and compelling action heroes.`,
        items: characterSchema
      },
      villains: {
        type: Type.ARRAY,
        description: `A list of ${count} unique and menacing villains for the heroes to fight.`,
        items: characterSchema
      }
    }
  };

  const prompt = `Generate a list of ${count} action movie heroes and ${count} villains based on the theme: "${theme}".
  These should be funny, over-the-top parodies of famous action movie characters.
  For example, if the theme is '80s action heroes', a character like Rambo could become 'Bro-bo' and Terminator could be 'The Brominator'.
  Be creative with the names and descriptions to capture the cheesy, explosive spirit of these films.
  Assign a creative weaponType, a unique specialAbility, a unique movementAbility, and a cool catchphrase to each character.`;

  const attemptGeneration = async (modelName: string) => {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: generationSchema,
          temperature: 0.9,
        }
      });

      const jsonText = response.text?.trim();
      if (!jsonText) throw new Error("Empty response from AI");

      let data;
      try {
        data = JSON.parse(jsonText);
      } catch (e) {
          throw new Error("Failed to parse JSON response from AI");
      }
      
      const validatedData = validateGeneratedCharacters(data);
      
      let idCounter = Date.now();
      const heroes = validatedData.heroes.map((h: any) => ({...h, id: idCounter++}));
      const villains = validatedData.villains.map((v: any) => ({...v, id: idCounter++}));

      return { heroes, villains } as GeneratedCharacters;
  };

  try {
      // Primary Attempt: Gemini 3 Flash
      return await retryOperation(() => attemptGeneration("gemini-3-flash-preview"));
  } catch (error: any) {
      const isOverloaded = error.code === 503 || error.status === 503 || error.message?.includes('503');
      
      if (isOverloaded) {
          console.warn("Primary model overloaded (503). Attempting fallback to Gemini Flash Lite...");
          try {
              // Fallback Attempt: Gemini Flash Lite
              return await retryOperation(() => attemptGeneration("gemini-flash-lite-latest"));
          } catch (fallbackError) {
              console.error("Fallback model also failed:", fallbackError);
              // Fall through to hardcoded backup
          }
      } else {
          console.error("Error generating characters with Gemini:", error);
      }

      // Hardcoded Fallback
      return {
        heroes: [
            { id: 1, name: "Bro-bo", description: "A one-man army with an explosive temper and a bigger bandana.", weaponType: "Explosive-Tip Bow", specialAbility: "Screaming Rage", movementAbility: "Wall Slide", catchphrase: "They drew first blood, not me!" },
            { id: 2, name: "The Brominator", description: "Cybernetic organism. Living tissue over metal endoskeleton. He'll be back.", weaponType: "Lever-Action Shotgun", specialAbility: "Temporary Invincibility", movementAbility: "Double Jump", catchphrase: "I need your boots, your clothes, and your motorcycle." },
            { id: 3, name: "Bro Hard", description: "Wrong guy, wrong place, wrong time. Yippee-ki-yay.", weaponType: "Standard Issue Pistol", specialAbility: "Dash Strike", movementAbility: "Air Dash", catchphrase: "Welcome to the party, pal!" },
            { id: 4, name: "Indiana Brones", description: "It belongs in a museum! And so do these bad guys.", weaponType: "Trusty Whip", specialAbility: "Whip Crack", movementAbility: "Double Jump", catchphrase: "Snakes. Why'd it have to be snakes?" },
        ],
        villains: [
            { id: 101, name: "Colonel Ludmilla", description: "A ruthless commander with an eyepatch and a deep-seated grudge.", weaponType: "AK-47", specialAbility: "Airstrike", movementAbility: "Air Dash", catchphrase: "For the motherland... of evil!" },
            { id: 102, name: "CEO Evilman", description: "He's not just evil, he's corporately evil. His hostile takeovers are literal.", weaponType: "Golden Gun", specialAbility: "Summon Minions", movementAbility: "Double Jump", catchphrase: "Consider this your final notice." },
            { id: 103, name: "Dr. No-Good", description: "A maniacal scientist with a doomsday device and terrible fashion sense.", weaponType: "Acid Sprayer", specialAbility: "Gas Cloud", movementAbility: "Wall Slide", catchphrase: "The world will tremble before my genius!" },
            { id: 104, name: "Cyber Commando", description: "Half man, half machine, all bad attitude.", weaponType: "Laser Minigun", specialAbility: "EMP Blast", movementAbility: "Air Dash", catchphrase: "You are obsolete." },
        ],
      };
  }
}

export async function generateCharacterImage(character: CharacterProfile): Promise<string> {
    const prompt = `Full body portrait of an action hero. Description: "${character.description}". Wielding a ${character.weaponType}. 8-bit pixel art style, vibrant colors, action pose, side-scroller game character, transparent PNG background.`;
    
    return retryOperation(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [{ text: prompt }]
            },
            config: {
                imageConfig: {
                    aspectRatio: '1:1',
                },
            },
        });

        const candidates = response.candidates;
        if (candidates && candidates.length > 0 && candidates[0].content?.parts) {
            for (const part of candidates[0].content.parts) {
                if (part.inlineData) {
                    const base64EncodeString = part.inlineData.data;
                    return `data:image/png;base64,${base64EncodeString}`;
                }
            }
        }

        throw new Error("No image was generated by the API.");
    }).catch(error => {
        console.error(`Failed to generate image for ${character.name} after retries:`, error);
        throw error;
    });
}


export async function generateMissionBriefing(characters: GeneratedCharacters): Promise<string> {
  const heroNames = characters.heroes.map(h => h.name).join(', ');
  const villainNames = characters.villains.map(v => v.name).join(', ');

  const prompt = `Generate a short, over-the-top, action-movie-style mission briefing.
The team of heroes are: ${heroNames}.
The villains they must face are: ${villainNames}.
The briefing should set up a simple, classic action movie plot. For example, a villain has stolen a super-weapon, a hero has been captured, or the villains are about to unleash a doomsday device.
Keep it under 50 words. Make it punchy and exciting.`;

  return retryOperation(async () => {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          temperature: 0.8,
        }
      });
      return response.text || "Mission briefing classified.";
  }).catch(error => {
      console.error("Error generating mission briefing after retries:", error);
      return `Listen up, team! The villains, led by ${villainNames}, have captured one of our own. Your mission is to get in there, rescue the hostage, and neutralize the threat. Good luck.`;
  });
}

export async function generateCharacterVideo(imageBase64: string, prompt: string): Promise<string> {
  // 1. Check for API Key Selection (Mandatory for Veo)
  if (typeof window !== 'undefined' && (window as any).aistudio) {
    const hasKey = await (window as any).aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await (window as any).aistudio.openSelectKey();
    }
  }

  // 2. Initialize new AI instance to ensure fresh API key from environment if it was updated
  const veoAi = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // 3. Prepare Image Data (Strip Data URL prefix if present)
  const base64Data = imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

  return retryOperation(async () => {
    let operation = await veoAi.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      image: {
        imageBytes: base64Data,
        mimeType: 'image/png', 
      },
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '9:16' // Portrait aspect ratio preferred for character cards
      }
    });

    // 4. Poll for completion
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5 seconds
      operation = await veoAi.operations.getVideosOperation({ operation: operation });
    }

    // 5. Retrieve Video URL
    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Video generation failed: No URI returned.");
    
    // Append API key for restricted download access
    return `${downloadLink}&key=${process.env.API_KEY}`;
  });
}

export async function generateDrillSergeantMessage(userMessage: string, context: string): Promise<string> {
    const prompt = `You are Sergeant Stone, an 8-bit, angry, tough-love Drill Sergeant in an action video game. 
    Context: ${context}. 
    User asks: "${userMessage}".
    Answer in character. Be loud (use CAPS sparsely for emphasis), keep it under 25 words, and be helpful but grumpy. 
    Do not use emojis. End with a mild insult like 'maggot' or 'recruit'.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                temperature: 0.8,
            }
        });
        return response.text || "DROPPED AND GIVE ME TWENTY! I CAN'T HEAR YOU!";
    } catch (e) {
        console.error("Sergeant is AWOL:", e);
        return "COMMUNICATIONS DOWN! FIGURE IT OUT YOURSELF, SOLDIER!";
    }
}
