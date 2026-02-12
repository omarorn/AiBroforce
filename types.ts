
export enum GameState {
  MENU,
  PLAYING,
  GAME_OVER,
}

export type Difficulty = 'EASY' | 'NORMAL' | 'HARD';

export interface CharacterProfile {
  id: number;
  name: string;
  description: string;
  weaponType: string;
  specialAbility: string;
  movementAbility: string;
  catchphrase: string;
  imageUrl?: string;
  videoUrl?: string;
}

export interface GeneratedCharacters {
  heroes: CharacterProfile[];
  villains: CharacterProfile[];
  missionBriefing?: string;
}

export interface SavedCast {
  name: string;
  characters: GeneratedCharacters;
  createdAt: number;
}

export interface HighScore {
  id: string;
  score: number;
  heroName: string;
  castName: string;
  difficulty: Difficulty;
  date: number;
}

export interface GameObject {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'player' | 'enemy' | 'bullet' | 'crate' | 'explosion' | 'rescue_cage' | 'turret' | 'power_up';
}

export type PowerUpType = 'rapid_fire' | 'spread_shot' | 'damage_boost';

export interface PowerUp extends GameObject {
  type: 'power_up';
  powerUpType: PowerUpType;
}

export interface Player extends GameObject {
  type: 'player';
  hero: CharacterProfile;
  health: number;
  maxHealth: number;
  direction: 'left' | 'right';
  lives: number;
  specialAbilityCooldown: number;
  isInvincible: boolean;
  invincibilityTimer: number;
  damageFlash: number;
  // Movement ability state
  hasDoubleJumped: boolean;
  isWallSliding: boolean;
  dashTimer: number;
  // Upgrade state
  activePowerUp?: PowerUpType;
  powerUpTimer: number;
}

export type EnemyBehavior = 'patrol' | 'chase' | 'stationary' | 'boss';

export interface Enemy extends GameObject {
  type: 'enemy';
  villain: CharacterProfile;
  health: number;
  maxHealth: number;
  direction: 'left' | 'right';
  moveSpeed: number;
  shootCooldown: number;
  isBoss: boolean;
  damageFlash: number;
  aiBehavior: EnemyBehavior;
}

export interface Bullet extends GameObject {
  type: 'bullet';
  owner: 'player' | 'enemy' | 'turret';
  vx: number;
  vy: number;
  weaponType: CharacterProfile['weaponType'];
  damage: number;
}

export interface Crate extends GameObject {
    type: 'crate';
    health: number;
}

export interface Explosion extends GameObject {
    type: 'explosion';
    life: number;
}

export interface RescueCage extends GameObject {
    type: 'rescue_cage';
    health: number;
}

export interface Turret extends GameObject {
    type: 'turret';
    life: number;
    shootCooldown: number;
    direction: 'left' | 'right';
}

export type GameEntityType = Player | Enemy | Bullet | Crate | Explosion | RescueCage | Turret | PowerUp;

export interface LevelData {
    platforms: Array<Omit<Crate, 'id' | 'type' | 'health'>>;
    destructibleCrates: Array<Omit<Crate, 'id' | 'type' | 'health'>>;
    // Updated to exclude aiBehavior from requirement in levels.ts
    enemies: Array<Omit<Enemy, 'id'| 'type' | 'villain' | 'health' | 'maxHealth' | 'damageFlash' | 'aiBehavior'>>;
    cages: Array<Omit<RescueCage, 'id'|'type'|'health'>>;
    boss?: Omit<Enemy, 'id'| 'type' | 'villain' | 'health'| 'maxHealth' | 'damageFlash' | 'aiBehavior'>;
}
