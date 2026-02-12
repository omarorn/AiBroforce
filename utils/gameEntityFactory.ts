
import * as C from '../constants';
import type { Player, Enemy, Crate, RescueCage, Explosion, CharacterProfile, Bullet, Turret, EnemyBehavior, PowerUp, PowerUpType } from '../types';

// We use a closure or class to manage ID generation to keep it simple in usage
export class GameEntityFactory {
  private static idCounter = Date.now();

  private static nextId() {
    return this.idCounter++;
  }

  static createPlayer(hero: CharacterProfile, lives: number): Player {
    return {
      id: this.nextId(),
      type: 'player',
      x: C.GAME_WIDTH / 2 - C.PLAYER_WIDTH / 2,
      y: C.GAME_HEIGHT - C.PLAYER_HEIGHT - 100,
      width: C.PLAYER_WIDTH,
      height: C.PLAYER_HEIGHT,
      hero,
      health: C.PLAYER_MAX_HEALTH,
      maxHealth: C.PLAYER_MAX_HEALTH,
      direction: 'right',
      lives,
      specialAbilityCooldown: 0,
      isInvincible: false,
      invincibilityTimer: 0,
      damageFlash: 0,
      hasDoubleJumped: false,
      isWallSliding: false,
      dashTimer: 0,
      activePowerUp: undefined,
      powerUpTimer: 0,
    };
  }

  static createEnemy(
    base: Partial<Enemy> & { x: number; y: number; width: number; height: number; direction: 'left' | 'right'; moveSpeed: number; shootCooldown: number; isBoss: boolean; maxHealth?: number, aiBehavior?: EnemyBehavior },
    villain: CharacterProfile
  ): Enemy {
    const maxHealth = base.maxHealth || (base.isBoss ? C.BOSS_MAX_HEALTH : C.ENEMY_MAX_HEALTH);
    const health = base.health || maxHealth;
    
    return {
      id: this.nextId(),
      type: 'enemy',
      villain,
      health,
      maxHealth,
      damageFlash: 0,
      aiBehavior: base.aiBehavior || (base.isBoss ? 'boss' : 'stationary'), // Default behavior
      ...base,
    } as Enemy;
  }

  static createCrate(x: number, y: number, width: number, height: number): Crate {
    return {
      id: this.nextId(),
      type: 'crate',
      x,
      y,
      width,
      height,
      health: 20,
    };
  }

  static createCage(x: number, y: number, width: number, height: number): RescueCage {
    return {
      id: this.nextId(),
      type: 'rescue_cage',
      x,
      y,
      width,
      height,
      health: C.CAGE_HEALTH,
    };
  }

  static createExplosion(x: number, y: number, width: number, height: number): Explosion {
    return {
      id: this.nextId(),
      type: 'explosion',
      x,
      y,
      width,
      height,
      life: 15,
    };
  }

  static createBullet(
    x: number, 
    y: number, 
    owner: 'player' | 'enemy' | 'turret', 
    weaponType: string, 
    vx: number, 
    vy: number,
    damage: number = 10
  ): Bullet {
    return {
      id: this.nextId(),
      type: 'bullet',
      x,
      y,
      width: C.BULLET_WIDTH,
      height: C.BULLET_HEIGHT,
      owner,
      weaponType,
      vx,
      vy,
      damage
    };
  }

  static createTurret(x: number, y: number, direction: 'left' | 'right'): Turret {
    return {
        id: this.nextId(),
        type: 'turret',
        x,
        y,
        width: C.PLAYER_WIDTH,
        height: C.PLAYER_HEIGHT,
        life: C.TURRET_LIFESPAN,
        shootCooldown: 0,
        direction
    };
  }

  static createPowerUp(x: number, y: number, powerUpType: PowerUpType): PowerUp {
      return {
          id: this.nextId(),
          type: 'power_up',
          x,
          y,
          width: C.POWERUP_WIDTH,
          height: C.POWERUP_HEIGHT,
          powerUpType
      };
  }
}
