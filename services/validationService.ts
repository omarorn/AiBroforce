
import { z } from 'zod';

export const CharacterProfileSchema = z.object({
  id: z.number().optional(), // ID is often added locally, so optional from API
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  weaponType: z.string().min(1, "Weapon Type is required"),
  specialAbility: z.string().min(1, "Special Ability is required"),
  movementAbility: z.string().min(1, "Movement Ability is required"),
  catchphrase: z.string().min(1, "Catchphrase is required"),
  imageUrl: z.string().optional(),
  videoUrl: z.string().optional(),
});

export const GeneratedCharactersSchema = z.object({
  heroes: z.array(CharacterProfileSchema).min(1, "At least one hero is required"),
  villains: z.array(CharacterProfileSchema).min(1, "At least one villain is required"),
  missionBriefing: z.string().optional(),
});

export const validateGeneratedCharacters = (data: unknown) => {
  try {
    return GeneratedCharactersSchema.parse(data);
  } catch (error) {
    console.error("Validation Error:", error);
    throw new Error("Received invalid data format from AI.");
  }
};
