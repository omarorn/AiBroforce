
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { GeneratedCharacters, Player, Enemy, Bullet, Crate, Explosion, GameEntityType, CharacterProfile, RescueCage, Turret, Difficulty, EnemyBehavior, PowerUp, PowerUpType } from '../types';
import { useGameLoop } from '../hooks/useGameLoop';
import { useInput } from '../hooks/useInput';
import { levels } from '../levels';
import { audioService } from '../services/audioService';
import { GameEntityFactory } from '../utils/gameEntityFactory';
import * as C from '../constants';
import { IoFlash, IoScanCircle, IoFlame, IoWarning } from 'react-icons/io5';

// --- DEVELOPMENT ---
const DEV_MODE_GOD_MODE = true; // Player cannot die
// ---

interface GameScreenProps {
  characters: GeneratedCharacters;
  startingHero: CharacterProfile;
  difficulty: Difficulty;
  onGameOver: (score: number) => void;
}

interface SpriteProps {
  entity: GameEntityType;
  color: string;
  children?: React.ReactNode;
  extraClasses?: string;
}

const Sprite: React.FC<SpriteProps> = ({ entity, color, children, extraClasses='' }) => (
  <div className={`absolute overflow-hidden ${color} ${extraClasses}`} style={{left:entity.x, top:entity.y, width:entity.width, height:entity.height, transform: (entity.type === 'player' || entity.type === 'enemy') && entity.direction === 'left' ? 'scaleX(-1)' : 'scaleX(1)'}}>
    {children}
  </div>
);

const GameScreen: React.FC<GameScreenProps> = ({ characters, startingHero, difficulty, onGameOver }) => {
  const [player, setPlayer] = useState<Player>(() => GameEntityFactory.createPlayer(startingHero, C.PLAYER_STARTING_LIVES));
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [cages, setCages] = useState<RescueCage[]>([]);
  const [crates, setCrates] = useState<Crate[]>([]);
  const [explosions, setExplosions] = useState<Explosion[]>([]);
  const [turrets, setTurrets] = useState<Turret[]>([]);
  const [powerUps, setPowerUps] = useState<PowerUp[]>([]);
  const [score, setScore] = useState(0);
  const [levelIndex, setLevelIndex] = useState(0);
  const [bulletCooldown, setBulletCooldown] = useState(0);
  const [yVelocity, setYVelocity] = useState(0);
  const [screenShake, setScreenShake] = useState({ x: 0, y: 0, magnitude: 0 });
  const [showReinforcementWarning, setShowReinforcementWarning] = useState(false);

  // Input Hook
  const getInputs = useInput();

  const coyoteTimeCounter = useRef(0);
  const jumpBufferCounter = useRef(0); // Kept for logic separation, but derived from hook
  const levelStartTime = useRef(0);
  const reinforcementTimer = useRef(0);
  const prevEnemiesCount = useRef(0);
  const scoreRef = useRef(0);

  // Keep score ref in sync to use in callbacks without dependency
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  const triggerScreenShake = (magnitude: number, duration: number) => {
    setScreenShake({ x: 0, y: 0, magnitude });
    setTimeout(() => setScreenShake({ x: 0, y: 0, magnitude: 0 }), duration);
  };

  const checkCollision = (a: GameEntityType, b: GameEntityType) => {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  };
  
  const spawnLevel = useCallback((lvlIdx: number) => {
    const levelData = levels[lvlIdx];
    if (!levelData) {
        onGameOver(scoreRef.current); // Use ref to avoid dependency on 'score'
        return;
    }
    
    levelStartTime.current = Date.now();
    
    // Reset reinforcement timer based on difficulty
    reinforcementTimer.current = {
        'EASY': 1200,
        'NORMAL': 600,
        'HARD': 300
    }[difficulty];

    setBullets([]);
    setTurrets([]);
    setPowerUps([]);
    setShowReinforcementWarning(false);
    
    // Difficulty Scaling
    const diffMods = {
        'EASY': { hp: 0.7, speed: 0.8, cooldown: 1.5, chaseChance: 0.1, patrolChance: 0.4 },
        'NORMAL': { hp: 1, speed: 1, cooldown: 1, chaseChance: 0.3, patrolChance: 0.5 },
        'HARD': { hp: 1.5, speed: 1.2, cooldown: 0.7, chaseChance: 0.6, patrolChance: 0.3 }
    }[difficulty];
    
    const staticPlatforms = levelData.platforms.map(p => GameEntityFactory.createCrate(p.x, p.y, p.width, p.height));
    const destructible = levelData.destructibleCrates.map(p => GameEntityFactory.createCrate(p.x, p.y, p.width, p.height));
    setCrates([...staticPlatforms, ...destructible]);

    setCages(levelData.cages.map(c => GameEntityFactory.createCage(c.x, c.y, c.width, c.height)));
    
    const newEnemies = levelData.enemies.map(e => {
        // Dynamic Behavior Assignment
        let behavior: EnemyBehavior = 'stationary';
        const rand = Math.random();
        if (rand < diffMods.chaseChance) behavior = 'chase';
        else if (rand < diffMods.chaseChance + diffMods.patrolChance) behavior = 'patrol';

        return GameEntityFactory.createEnemy({
            ...e,
            maxHealth: Math.ceil((C.ENEMY_MAX_HEALTH) * diffMods.hp),
            moveSpeed: e.moveSpeed * diffMods.speed,
            shootCooldown: e.shootCooldown * diffMods.cooldown,
            aiBehavior: behavior
        }, characters.villains[Math.floor(Math.random() * characters.villains.length)]);
    });
    
    if (levelData.boss) {
        newEnemies.push(GameEntityFactory.createEnemy({
            ...levelData.boss,
            maxHealth: Math.ceil(C.BOSS_MAX_HEALTH * diffMods.hp),
            moveSpeed: levelData.boss.moveSpeed * diffMods.speed,
            shootCooldown: levelData.boss.shootCooldown * diffMods.cooldown,
            aiBehavior: 'boss'
        }, characters.villains[0]));
    }
    setEnemies(newEnemies);
  }, [characters.villains, onGameOver, difficulty]);

  useEffect(() => {
    audioService.playMusic('music_game');
    spawnLevel(levelIndex);
  }, [levelIndex, spawnLevel]);

  const swapHero = useCallback(() => {
    const availableHeroes = characters.heroes.filter(h => h.id !== player.hero.id);
    const nextHero = availableHeroes.length > 0 ? availableHeroes[Math.floor(Math.random() * availableHeroes.length)] : characters.heroes[0];
    
    setPlayer(p => ({
        ...p,
        hero: nextHero,
        health: p.maxHealth, // Full heal on swap
        specialAbilityCooldown: 0,
        isInvincible: true, // brief invincibility on swap
        invincibilityTimer: 120,
    }));
  }, [characters.heroes, player.hero.id]);

  const gameLoop = useCallback(() => {
    const inputs = getInputs();

    // --- TIMERS & COOLDOWNS ---
    coyoteTimeCounter.current = Math.max(0, coyoteTimeCounter.current - 1);
    
    setBulletCooldown(c => Math.max(0, c - 1));
    setPlayer(p => ({
        ...p,
        specialAbilityCooldown: Math.max(0, p.specialAbilityCooldown - 1),
        invincibilityTimer: Math.max(0, p.invincibilityTimer - 1),
        isInvincible: p.invincibilityTimer > 0,
        damageFlash: Math.max(0, p.damageFlash - 1),
        dashTimer: Math.max(0, p.dashTimer - 1),
        powerUpTimer: Math.max(0, p.powerUpTimer - 1),
        activePowerUp: p.powerUpTimer - 1 <= 0 ? undefined : p.activePowerUp
    }));
    setEnemies(es => es.map(e => ({...e, damageFlash: Math.max(0, e.damageFlash - 1) })));

    if(screenShake.magnitude > 0) {
        setScreenShake(s => ({...s, x: (Math.random() - 0.5) * s.magnitude, y: (Math.random() - 0.5) * s.magnitude }));
    }

    // --- PLAYER MOVEMENT & PHYSICS ---
    let newX = player.x;
    let newYVelocity = yVelocity;

    // Handle Dash
    if (player.dashTimer > 0) {
        newX += player.direction === 'right' ? C.PLAYER_SPEED * 2.5 : -C.PLAYER_SPEED * 2.5;
        newYVelocity = 0; // Dash is horizontal
    } else {
        if (inputs.left) { newX -= C.PLAYER_SPEED; setPlayer(p => ({...p, direction: 'left'})) }
        if (inputs.right) { newX += C.PLAYER_SPEED; setPlayer(p => ({...p, direction: 'right'})) }
    }
    
    const allPlatforms = [...crates, {id: -1, type: 'crate' as const, x: 0, y: C.GAME_HEIGHT - 50, width: C.GAME_WIDTH, height: 50, health: 999}];
    
    // Horizontal collision
    let horizontalCollision = false;
    for(const platform of crates) {
        if(checkCollision({...player, x:newX}, platform)) {
            newX = player.x;
            horizontalCollision = true;
            break;
        }
    }
    setPlayer(p => ({...p, x: Math.max(0, Math.min(C.GAME_WIDTH - C.PLAYER_WIDTH, newX))}));

    // Vertical physics
    newYVelocity += C.GRAVITY;
    let newPlayerY = player.y + newYVelocity;
    
    let onGround = false;
    for (const platform of allPlatforms) {
      if (player.x + player.width > platform.x && player.x < platform.x + platform.width) {
        if (player.y + player.height <= platform.y && newPlayerY + player.height >= platform.y) {
          newPlayerY = platform.y - player.height;
          newYVelocity = 0;
          onGround = true;
          setPlayer(p => ({...p, hasDoubleJumped: false, isWallSliding: false}));
          break;
        }
      }
    }
    
    // Wall Slide
    let isWallSliding = false;
    if (horizontalCollision && !onGround && yVelocity > 0) {
        isWallSliding = true;
        newYVelocity = Math.min(newYVelocity, 2); // Wall friction
    }
    setPlayer(p => ({...p, isWallSliding}));
    
    if (onGround) coyoteTimeCounter.current = 5;

    // Jumping Logic
    let didJump = false;
    const movementAbility = player.hero.movementAbility.toLowerCase();

    if (inputs.jumpCmd) {
        if (coyoteTimeCounter.current > 0) { // Ground jump
            newYVelocity = -C.PLAYER_JUMP_FORCE;
            didJump = true;
            inputs.consumeJump();
        } else if (isWallSliding) { // Wall jump
            const wallJumpDirection = player.direction === 'right' ? -1 : 1;
            setPlayer(p => ({...p, x: p.x + wallJumpDirection * C.PLAYER_SPEED, direction: wallJumpDirection === 1 ? 'right' : 'left' }));
            newYVelocity = -C.PLAYER_JUMP_FORCE * 1.1;
            didJump = true;
            inputs.consumeJump();
        } else if (movementAbility.includes('double') && !player.hasDoubleJumped) { // Double jump
            newYVelocity = -C.PLAYER_JUMP_FORCE;
            setPlayer(p => ({...p, hasDoubleJumped: true}));
            didJump = true;
            inputs.consumeJump();
        }
    }
    
    if (didJump) {
        audioService.playSound('jump');
        coyoteTimeCounter.current = 0;
        setPlayer(p => ({...p, isWallSliding: false}));
    }

    setPlayer(p => ({...p, y: newPlayerY}));
    setYVelocity(newYVelocity);
    
    // --- SHOOTING (PLAYER) ---
    const newBullets: Bullet[] = [];
    if (inputs.shoot && bulletCooldown === 0) {
      const weapon = player.hero.weaponType.toLowerCase();
      const baseY = player.y + player.height / 2 - C.BULLET_HEIGHT / 2;
      
      let damage = 20; // Base damage
      let cooldown = C.BULLET_COOLDOWN;
      
      // Apply Powerups
      if (player.activePowerUp === 'damage_boost') damage *= 2;
      if (player.activePowerUp === 'rapid_fire') cooldown /= 2;
      
      if (player.activePowerUp === 'spread_shot') {
          audioService.playSound('shoot_shotgun');
          [-15, 0, 15].forEach(angle => {
              const rad = angle * (Math.PI / 180);
              const dir = player.direction === 'right' ? 1 : -1;
              const vx = Math.cos(rad) * dir * C.BULLET_SPEED;
              const vy = Math.sin(rad) * C.BULLET_SPEED;
              newBullets.push(GameEntityFactory.createBullet(
                  player.x + (player.direction === 'right' ? player.width : -C.BULLET_WIDTH),
                  baseY,
                  'player',
                  player.hero.weaponType,
                  vx,
                  vy,
                  damage
              ));
          });
      } else if (weapon.includes('shotgun')) {
        audioService.playSound('shoot_shotgun');
        for (let i = 0; i < 5; i++) {
            newBullets.push(GameEntityFactory.createBullet(
                player.x + (player.direction === 'right' ? player.width : -C.BULLET_WIDTH),
                baseY,
                'player',
                player.hero.weaponType,
                (player.direction === 'right' ? 1 : -1) * C.BULLET_SPEED * (0.8 + Math.random() * 0.4),
                (i - 2) * 1.5,
                damage
            ));
        }
        setBulletCooldown(cooldown * 2.5);
      } else if (weapon.includes('grenade')) {
        audioService.playSound('shoot_grenade');
        newBullets.push(GameEntityFactory.createBullet(
            player.x + (player.direction === 'right' ? player.width / 2 : 0),
            baseY,
            'player',
            player.hero.weaponType,
            (player.direction === 'right' ? 1 : -1) * C.BULLET_SPEED * 0.7,
            -10,
            damage * 1.5
        ));
        setBulletCooldown(cooldown * 3);
      } else { // Default Rifle
        audioService.playSound('shoot_rifle');
        newBullets.push(GameEntityFactory.createBullet(
            player.x + (player.direction === 'right' ? player.width : -C.BULLET_WIDTH),
            baseY,
            'player',
            player.hero.weaponType,
            (player.direction === 'right' ? 1 : -1) * C.BULLET_SPEED,
            0,
            damage
        ));
        setBulletCooldown(cooldown);
      }
      
      if(!weapon.includes('shotgun') && !weapon.includes('grenade') && !player.activePowerUp) {
          setBulletCooldown(cooldown);
      }
    }

    // --- SPECIAL ABILITIES ---
    if (inputs.special && player.specialAbilityCooldown === 0) {
        setPlayer(p => ({...p, specialAbilityCooldown: C.SPECIAL_ABILITY_COOLDOWN}));
        const ability = player.hero.specialAbility.toLowerCase();
        if(ability.includes('turret')) {
            setTurrets(t => [...t, GameEntityFactory.createTurret(player.x, player.y, player.direction)]);
        } else if (ability.includes('invincib')) {
            setPlayer(p => ({...p, invincibilityTimer: C.INVINCIBILITY_DURATION}));
        } else if (ability.includes('cluster')) {
            for (let i = 0; i < 8; i++) {
                newBullets.push(GameEntityFactory.createBullet(
                    player.x, 
                    player.y, 
                    'player', 
                    'Grenade Launcher', 
                    (Math.random() - 0.5) * C.BULLET_SPEED, 
                    -Math.random() * 12,
                    20
                ));
            }
        }
        if (ability.includes('dash')) {
             setPlayer(p => ({...p, dashTimer: 20, invincibilityTimer: 20}));
             audioService.playSound('dash');
        }
    }
    
    if (inputs.dash && movementAbility.includes('dash') && player.dashTimer <=0 && !onGround) {
        setPlayer(p => ({...p, dashTimer: 20, invincibilityTimer: 20}));
        audioService.playSound('dash');
    }

    // --- DYNAMIC REINFORCEMENTS ---
    const diffSettings = {
        'EASY': { max: 3, rate: 900 },   // Spawn every 15s
        'NORMAL': { max: 6, rate: 600 }, // Spawn every 10s
        'HARD': { max: 10, rate: 300 }   // Spawn every 5s
    }[difficulty];

    const currentBoss = enemies.find(e => e.isBoss);

    if (Date.now() - levelStartTime.current > 2000 && (!currentBoss || difficulty === 'HARD')) {
         if (enemies.length < diffSettings.max) {
             reinforcementTimer.current -= 1;
             
             if (reinforcementTimer.current <= 0) {
                 reinforcementTimer.current = diffSettings.rate;
                 setShowReinforcementWarning(true);
                 setTimeout(() => setShowReinforcementWarning(false), 2000);
                 const diffMods = {
                    'EASY': { hp: 0.7, speed: 0.8, cooldown: 1.5, chaseChance: 0.2, patrolChance: 0.4 },
                    'NORMAL': { hp: 1, speed: 1, cooldown: 1, chaseChance: 0.4, patrolChance: 0.4 },
                    'HARD': { hp: 1.5, speed: 1.2, cooldown: 0.7, chaseChance: 0.7, patrolChance: 0.2 }
                 }[difficulty];

                 const spawnSide = Math.random() > 0.5 ? 'left' : 'right';
                 const x = spawnSide === 'left' ? 10 : C.GAME_WIDTH - C.ENEMY_WIDTH - 10;
                 const y = C.GAME_HEIGHT - 50 - C.ENEMY_HEIGHT; 

                 let behavior: EnemyBehavior = 'chase';
                 const rand = Math.random();
                 if (rand < diffMods.chaseChance) behavior = 'chase';
                 else if (rand < diffMods.chaseChance + diffMods.patrolChance) behavior = 'patrol';
                 else behavior = 'stationary';

                 const villain = characters.villains[Math.floor(Math.random() * characters.villains.length)];

                 const newEnemy = GameEntityFactory.createEnemy({
                    x, y,
                    width: C.ENEMY_WIDTH,
                    height: C.ENEMY_HEIGHT,
                    direction: spawnSide === 'left' ? 'right' : 'left',
                    moveSpeed: 1.5 * diffMods.speed, 
                    shootCooldown: 60 * diffMods.cooldown,
                    isBoss: false,
                    maxHealth: Math.ceil(C.ENEMY_MAX_HEALTH * diffMods.hp),
                    aiBehavior: behavior
                 }, villain);
                 
                 newEnemy.damageFlash = 10; 
                 audioService.playTone(150, 'sawtooth', 0.5, 0, 50);

                 setEnemies(prev => [...prev, newEnemy]);
             }
         }
    }

    // --- ENEMY & TURRET AI + BULLETS ---
    const allTargets = [player]; 
    const createEnemyBullet = (shooter: Enemy | Turret, target: Player) => {
        const dirToPlayer = target.x > shooter.x ? 1 : -1;
        audioService.playSound('shoot_rifle');
        const ownerType = shooter.type === 'turret' ? 'turret' : 'enemy';
        const weaponType = shooter.type === 'enemy' ? shooter.villain.weaponType : 'Rifle';
        
        newBullets.push(GameEntityFactory.createBullet(
            shooter.x + (dirToPlayer === 1 ? shooter.width : -C.BULLET_WIDTH),
            shooter.y + shooter.height / 2,
            ownerType,
            weaponType,
            dirToPlayer * C.BULLET_SPEED * 0.8,
            0,
            10
        ));

        if (difficulty === 'HARD' && shooter.type === 'enemy') {
            newBullets.push(GameEntityFactory.createBullet(
                shooter.x + (dirToPlayer === 1 ? shooter.width : -C.BULLET_WIDTH),
                shooter.y + shooter.height / 2,
                ownerType,
                weaponType,
                dirToPlayer * C.BULLET_SPEED * 0.8,
                2,
                10
            ));
             newBullets.push(GameEntityFactory.createBullet(
                shooter.x + (dirToPlayer === 1 ? shooter.width : -C.BULLET_WIDTH),
                shooter.y + shooter.height / 2,
                ownerType,
                weaponType,
                dirToPlayer * C.BULLET_SPEED * 0.8,
                -2,
                10
            ));
        }
    }

    setEnemies(es => es.map(enemy => {
        const target = allTargets[0];
        let newCooldown = enemy.shootCooldown - 1;
        let newX = enemy.x;
        let newDirection = enemy.direction;

        let shouldShoot = false;
        const distToPlayer = Math.abs(target.x - enemy.x);
        const yDistToPlayer = Math.abs(target.y - enemy.y);

        if (enemy.aiBehavior === 'boss') {
            const dir = target.x > enemy.x ? 1 : -1;
            newX += dir * enemy.moveSpeed;
            newDirection = dir === 1 ? 'right' : 'left';
            shouldShoot = distToPlayer < 600 && yDistToPlayer < 250;
        } else if (enemy.aiBehavior === 'chase') {
             if (distToPlayer < 400 && yDistToPlayer < 100) {
                 const dir = target.x > enemy.x ? 1 : -1;
                 newX += dir * enemy.moveSpeed;
                 newDirection = dir === 1 ? 'right' : 'left';
                 shouldShoot = distToPlayer < 300;
             } else {
                 shouldShoot = false;
             }
        } else if (enemy.aiBehavior === 'patrol') {
             const move = (enemy.direction === 'right' ? 1 : -1) * enemy.moveSpeed;
             newX += move;
             shouldShoot = distToPlayer < 400 && yDistToPlayer < 50 && ((enemy.direction === 'right' && target.x > enemy.x) || (enemy.direction === 'left' && target.x < enemy.x));
        } else {
            shouldShoot = distToPlayer < 500 && yDistToPlayer < 50;
             if(shouldShoot) {
                 newDirection = target.x > enemy.x ? 'right' : 'left';
             }
        }

        if (newX !== enemy.x) {
             let collided = false;
             if (newX < 0 || newX > C.GAME_WIDTH - enemy.width) collided = true;
             
             if(!collided) {
                 const tempEnemy = { ...enemy, x: newX };
                 for (const crate of crates) {
                     if (checkCollision(tempEnemy, crate)) {
                         collided = true;
                         break;
                     }
                 }
             }

             if (collided) {
                 newX = enemy.x;
                 if (enemy.aiBehavior === 'patrol') {
                     newDirection = enemy.direction === 'right' ? 'left' : 'right';
                 }
             }
        }

        if (shouldShoot && newCooldown <= 0) {
            createEnemyBullet(enemy, target);
            newCooldown = 90 + Math.random() * 60;
        }

        return { ...enemy, x: newX, direction: newDirection, shootCooldown: newCooldown }
    }));

    setTurrets(ts => {
        const updatedTurrets = ts.map(turret => {
            let newCooldown = turret.shootCooldown - 1;
            if (newCooldown <= 0 && enemies.length > 0) {
                const nearestEnemy = enemies.reduce((closest, current) => {
                    const closestDist = Math.abs(closest.x - turret.x);
                    const currentDist = Math.abs(current.x - turret.x);
                    return currentDist < closestDist ? current : closest;
                }, enemies[0]);
                
                if (Math.abs(nearestEnemy.x - turret.x) < 500) {
                     createEnemyBullet(turret, nearestEnemy as any); 
                     newCooldown = C.TURRET_SHOOT_COOLDOWN;
                }
            }
            return {...turret, life: turret.life -1, shootCooldown: newCooldown}
        });
        return updatedTurrets.filter(t => t.life > 0)
    });

    // --- BULLET MOVEMENT & COLLISION (Unified) ---
    // 1. Move bullets
    const movedBullets = bullets.map(b => ({
        ...b, 
        x: b.x + b.vx, 
        y: b.y + (b.weaponType.toLowerCase().includes('grenade') ? (b.vy + C.GRAVITY/1.5) : b.vy),
        vy: b.weaponType.toLowerCase().includes('grenade') ? b.vy + C.GRAVITY/1.5 : b.vy
    })).filter(b => b.x > -100 && b.x < C.GAME_WIDTH + 100 && b.y < C.GAME_HEIGHT + 100);

    const bulletsToRemove = new Set<number>();
    const explosionsToAdd: Explosion[] = [];
    const powerUpsToAdd: PowerUp[] = [];
    let scoreToAdd = 0;
    
    // We will build a list of damage events to apply to prevent state overwrite race conditions
    const damageEvents: { type: 'player' | 'enemy' | 'crate' | 'cage', id: number, amount: number }[] = [];

    movedBullets.forEach(bullet => {
        if (bulletsToRemove.has(bullet.id)) return;
        let hit = false;

        // Player Collision
        if (bullet.owner !== 'player' && !player.isInvincible && checkCollision(bullet, player)) {
            if (!DEV_MODE_GOD_MODE) {
                damageEvents.push({ type: 'player', id: player.id, amount: bullet.damage });
                hit = true;
                audioService.playSound('hurt');
                triggerScreenShake(3, 150);
            }
        }

        // Enemy Collision
        if (bullet.owner === 'player' && !hit) {
            for (const enemy of enemies) {
                if (checkCollision(bullet, enemy)) {
                    damageEvents.push({ type: 'enemy', id: enemy.id, amount: bullet.damage });
                    hit = true;
                    if (!bullet.weaponType.toLowerCase().includes('grenade')) {
                        explosionsToAdd.push(GameEntityFactory.createExplosion(bullet.x, bullet.y, 20, 20));
                    }
                    break; 
                }
            }
        }
        
        // Crate Collision
        if (bullet.owner === 'player' && !hit) {
            for (const crate of crates) {
                 if (checkCollision(bullet, crate)) {
                     damageEvents.push({ type: 'crate', id: crate.id, amount: bullet.damage });
                     hit = true;
                     if (!bullet.weaponType.toLowerCase().includes('grenade')) {
                        explosionsToAdd.push(GameEntityFactory.createExplosion(bullet.x, bullet.y, 20, 20));
                     }
                     break;
                 }
            }
        }

        // Cage Collision
        if (bullet.owner === 'player' && !hit) {
             for (const cage of cages) {
                 if (checkCollision(bullet, cage)) {
                     damageEvents.push({ type: 'cage', id: cage.id, amount: bullet.damage });
                     hit = true;
                     break;
                 }
             }
        }
        
        // Floor/Grenade logic
        if (!hit && bullet.weaponType.toLowerCase().includes('grenade') && bullet.y >= C.GAME_HEIGHT - 50 - bullet.height) {
            hit = true;
            audioService.playSound('explosion');
            triggerScreenShake(8, 200);
            explosionsToAdd.push(GameEntityFactory.createExplosion(bullet.x, bullet.y, 80, 80));
        }

        if (hit) {
            bulletsToRemove.add(bullet.id);
        }
    });

    // Apply accumulated damage and side effects
    if (damageEvents.length > 0) {
        // Player
        const playerHits = damageEvents.filter(e => e.type === 'player');
        if (playerHits.length > 0) {
            const totalDamage = playerHits.reduce((sum, e) => sum + e.amount, 0);
            setPlayer(p => ({ ...p, health: p.health - totalDamage, damageFlash: 5 }));
        }
        
        // Enemies
        setEnemies(prev => prev.map(e => {
            const hits = damageEvents.filter(d => d.type === 'enemy' && d.id === e.id);
            if (hits.length === 0) return e;
            const damage = hits.reduce((sum, h) => sum + h.amount, 0);
            const remainingHealth = e.health - damage;
            
            if (remainingHealth <= 0 && e.health > 0) { // Died this frame
                 scoreToAdd += e.isBoss ? 5000 : 100;
                 audioService.playSound('explosion');
                 triggerScreenShake(e.isBoss ? 15 : 5, 300);
                 explosionsToAdd.push(GameEntityFactory.createExplosion(e.x, e.y, e.width * 1.5, e.height * 1.5));
                 if (!e.isBoss && Math.random() < 0.05) {
                    const types: PowerUpType[] = ['rapid_fire', 'spread_shot', 'damage_boost'];
                    powerUpsToAdd.push(GameEntityFactory.createPowerUp(e.x, e.y, types[Math.floor(Math.random() * types.length)]));
                 }
            }
            return { ...e, health: remainingHealth, damageFlash: 5 };
        })); // Dead enemies filtered next render implicitly by UI mapping or explicit check? 
             // We should filter them out from state to stop them acting.
        
        // Crates
        setCrates(prev => prev.map(c => {
             const hits = damageEvents.filter(d => d.type === 'crate' && d.id === c.id);
             if (hits.length === 0) return c;
             const damage = hits.reduce((sum, h) => sum + h.amount, 0);
             if (c.health - damage <= 0 && c.health > 0) {
                 audioService.playSound('explosion');
                 explosionsToAdd.push(GameEntityFactory.createExplosion(c.x + c.width/2, c.y + c.height/2, c.width, c.height));
                 if (Math.random() < 0.25) {
                      const types: PowerUpType[] = ['rapid_fire', 'spread_shot', 'damage_boost'];
                      powerUpsToAdd.push(GameEntityFactory.createPowerUp(c.x, c.y, types[Math.floor(Math.random() * types.length)]));
                 }
             }
             return { ...c, health: c.health - damage };
        }).filter(c => c.health > 0));

        // Cages
        setCages(prev => prev.map(c => {
            const hits = damageEvents.filter(d => d.type === 'cage' && d.id === c.id);
            if (hits.length === 0) return c;
            const damage = hits.reduce((sum, h) => sum + h.amount, 0);
            if (c.health - damage <= 0 && c.health > 0) {
                audioService.playSound('rescue');
                setPlayer(p => ({ ...p, lives: p.lives + 1 }));
                swapHero();
            }
            return { ...c, health: c.health - damage };
        }));
    }
    
    // Explicitly filter dead enemies after damage application
    if (damageEvents.some(d => d.type === 'enemy')) {
        setEnemies(prev => prev.filter(e => e.health > 0));
    }

    if (scoreToAdd > 0) setScore(s => s + scoreToAdd);
    if (explosionsToAdd.length > 0) setExplosions(prev => [...prev, ...explosionsToAdd]);
    if (powerUpsToAdd.length > 0) setPowerUps(prev => [...prev, ...powerUpsToAdd]);

    // Finally update bullets state: Survived moved bullets + New bullets
    const finalBullets = [...movedBullets.filter(b => !bulletsToRemove.has(b.id)), ...newBullets];
    setBullets(finalBullets);

    setExplosions(ex => ex.map(e => ({...e, life: e.life - 1})).filter(e => e.life > 0));

    // --- POWERUP LOGIC ---
    // Move
    setPowerUps(ps => ps.map(p => {
        let newY = p.y + 2; // Gravity
        for(const crate of crates) {
             if(checkCollision({...p, y: newY}, crate)) {
                 newY = crate.y - p.height;
             }
        }
        if(newY > C.GAME_HEIGHT - 50 - p.height) newY = C.GAME_HEIGHT - 50 - p.height;
        return { ...p, y: newY };
    }));

    // Collect
    const remainingPowerUps: PowerUp[] = [];
    for(const p of powerUps) {
        if(checkCollision(player, p)) {
            audioService.playSound('powerup');
            setPlayer(prev => ({
                ...prev,
                activePowerUp: p.powerUpType,
                powerUpTimer: C.POWERUP_DURATION
            }));
        } else {
            remainingPowerUps.push(p);
        }
    }
    setPowerUps(remainingPowerUps);

    // --- GAME STATE ---
    if (player.health <= 0) {
        if(player.lives > 0) {
            setPlayer(p => GameEntityFactory.createPlayer(p.hero, p.lives - 1));
            swapHero();
        } else {
            onGameOver(scoreRef.current);
        }
    }
    
    // Level complete check
    if (levelStartTime.current > 0 && Date.now() - levelStartTime.current > 1000 && enemies.length === 0 && prevEnemiesCount.current > 0 && explosions.length === 0) {
        setLevelIndex(l => l + 1);
        setPlayer(p => ({...p, health: Math.min(p.maxHealth, p.health + 25)}));
    }
    prevEnemiesCount.current = enemies.length;
  }, [player, yVelocity, bulletCooldown, bullets, enemies, crates, cages, score, levelIndex, characters, swapHero, onGameOver, screenShake.magnitude, getInputs, difficulty, powerUps]);

  useGameLoop(gameLoop);

  const PlayerSprite = () => {
    let classes = 'bg-transparent transition-all duration-200';
    if(player.isInvincible && !player.dashTimer) classes += ' opacity-50';
    if(player.damageFlash > 0) classes += ' flash-damage';
    if(player.dashTimer > 0) classes += ' opacity-75';
    if(player.isWallSliding) classes += ' border-4 border-cyan-400';
    
    // Visual indicators for active power-ups
    if (player.activePowerUp === 'damage_boost') classes += ' shadow-[0_0_15px_#ef4444] border-2 border-red-500';
    if (player.activePowerUp === 'rapid_fire') classes += ' shadow-[0_0_15px_#eab308] border-2 border-yellow-400';
    if (player.activePowerUp === 'spread_shot') classes += ' shadow-[0_0_15px_#a855f7] border-2 border-purple-500';

    return (
        <Sprite entity={player} color={classes} >
          {player.hero.imageUrl && <img src={player.hero.imageUrl} alt={player.hero.name} className="w-full h-full object-contain" style={{imageRendering: 'pixelated', transform: player.isWallSliding ? (player.direction === 'left' ? 'scaleX(1)' : 'scaleX(-1)') : ''}} />}
          <div className="absolute -top-4 text-xs text-white whitespace-nowrap" style={{transform: player.direction === 'left' ? 'scaleX(-1)' : 'scaleX(1)'}}>{player.hero.name}</div>
        </Sprite>
    );
  }

  const boss = enemies.find(e => e.isBoss);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black">
      <div style={{ width: C.GAME_WIDTH, height: C.GAME_HEIGHT, transform: `translate(${screenShake.x}px, ${screenShake.y}px)` }} className="relative bg-gradient-to-t from-gray-700 to-gray-800 overflow-hidden border-4 border-gray-600 transition-transform duration-75">
        {crates.map(c => <Sprite key={c.id} entity={c} color="bg-dirt-pattern border-2 border-yellow-900" />)}
        {cages.map(c => <Sprite key={c.id} entity={c} color="bg-gray-500/50 border-4 border-gray-400 flex items-center justify-center text-3xl text-white">?</Sprite>)}
        {powerUps.map(p => {
            let color = 'bg-gray-200';
            let icon = null;
            if(p.powerUpType === 'damage_boost') { color = 'bg-red-500'; icon = <IoFlame /> }
            if(p.powerUpType === 'rapid_fire') { color = 'bg-yellow-400'; icon = <IoFlash /> }
            if(p.powerUpType === 'spread_shot') { color = 'bg-purple-500'; icon = <IoScanCircle /> }
            return (
                <Sprite key={p.id} entity={p} color={`${color} border-2 border-white flex items-center justify-center text-black animate-bounce`}>
                    {icon}
                </Sprite>
            )
        })}
        
        <PlayerSprite />

        {enemies.map(e => <Sprite key={e.id} entity={e} color={e.isBoss ? 'bg-transparent' : 'bg-transparent'} extraClasses={e.damageFlash > 0 ? 'flash-damage' : ''}>
            {e.villain.imageUrl && <img src={e.villain.imageUrl} alt={e.villain.name} className="w-full h-full object-contain" style={{imageRendering: 'pixelated'}}/>}
            <div className="absolute w-full -top-4">
                <div className="h-2 bg-gray-800"><div className="h-full bg-red-500" style={{width: `${(e.health/e.maxHealth)*100}%`}}></div></div>
            </div>
        </Sprite>)}

        {turrets.map(t => <Sprite key={t.id} entity={t} color="bg-metal-pattern border-2 border-gray-400" />)}

        {bullets.map(b => <Sprite key={b.id} entity={b} color={b.owner === 'player' ? 'bg-yellow-400 rounded-full' : 'bg-pink-500 rounded-full'} />)}
        
        {explosions.map(e => <div key={e.id} className="absolute bg-orange-500 rounded-full explosion-anim" style={{left:e.x - e.width/2, top:e.y-e.height/2, width:e.width, height:e.height}}></div>)}
        
        {showReinforcementWarning && (
            <div className="absolute top-24 left-1/2 transform -translate-x-1/2 flex items-center gap-2 text-red-500 animate-pulse z-30">
                <IoWarning className="text-4xl" />
                <span className="text-2xl font-bold uppercase tracking-widest bg-black/50 px-4 py-1">Reinforcements!</span>
                <IoWarning className="text-4xl" />
            </div>
        )}

        <div className="absolute bottom-0 left-0 w-full h-12 bg-gray-900/80 backdrop-blur-sm border-t-2 border-gray-600"></div>

        <div className="absolute top-2 left-2 text-white text-xl uppercase drop-shadow-md">Score: {score}</div>
        <div className="absolute top-2 right-2 text-white text-xl uppercase drop-shadow-md">Level: {levelIndex + 1} / {levels.length}</div>
        
        {boss && (
            <div className="absolute top-8 left-1/2 transform -translate-x-1/2 w-[60%] flex flex-col items-center z-20">
                <h3 className="text-red-500 font-bold uppercase text-lg mb-1 drop-shadow-md tracking-widest">{boss.villain.name}</h3>
                <div className="w-full h-4 bg-gray-900 border-2 border-gray-500 shadow-lg">
                    <div className="h-full bg-red-600 transition-all duration-100" style={{ width: `${Math.max(0, (boss.health / boss.maxHealth) * 100)}%` }}></div>
                </div>
            </div>
        )}

        <div className="absolute bottom-2 left-2 text-white flex items-center gap-4 z-10">
            <div>
                <div className="text-lg uppercase drop-shadow-md">{player.hero.name} <span className='text-sm text-yellow-300'>x{player.lives}</span></div>
                <div className="w-48 h-4 bg-gray-700 border-2 border-gray-400">
                    <div className="h-full bg-green-500 transition-all duration-200" style={{width: `${(player.health/player.maxHealth)*100}%`}}></div>
                </div>
            </div>
            <div className="text-center">
                <div className="text-sm uppercase drop-shadow-md">Special (E)</div>
                 <div className="w-24 h-4 bg-gray-700 border-2 border-gray-400">
                    <div className="h-full bg-purple-500" style={{width: `${100 - (player.specialAbilityCooldown/C.SPECIAL_ABILITY_COOLDOWN)*100}%`}}></div>
                </div>
            </div>
            
            {player.activePowerUp && (
                <div className="flex flex-col items-center ml-4 animate-pulse">
                     <div className="flex items-center gap-2 mb-1">
                        {player.activePowerUp === 'damage_boost' && <IoFlame className="text-red-500" />}
                        {player.activePowerUp === 'rapid_fire' && <IoFlash className="text-yellow-400" />}
                        {player.activePowerUp === 'spread_shot' && <IoScanCircle className="text-purple-500" />}
                        <span className="text-xs uppercase font-bold text-white">{player.activePowerUp.replace('_', ' ')}</span>
                     </div>
                     <div className="w-24 h-2 bg-gray-700 border border-gray-500">
                        <div className="h-full bg-white transition-all duration-75" style={{width: `${(player.powerUpTimer / C.POWERUP_DURATION) * 100}%`}}></div>
                     </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default GameScreen;
