
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { GeneratedCharacters, Player, Enemy, Bullet, Crate, Explosion, GameEntityType, CharacterProfile, RescueCage, Turret } from '../types';
import { useGameLoop } from '../hooks/useGameLoop';
import { levels } from '../levels';
import { audioService } from '../services/audioService';
import * as C from '../constants';

// --- DEVELOPMENT ---
const DEV_MODE_GOD_MODE = true; // Player cannot die
// ---

interface GameScreenProps {
  characters: GeneratedCharacters;
  startingHero: CharacterProfile;
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

const GameScreen: React.FC<GameScreenProps> = ({ characters, startingHero, onGameOver }) => {
  const nextObjectId = useRef(Date.now());
  
  function createPlayer(hero: CharacterProfile, lives: number): Player {
      return {
          id: nextObjectId.current++,
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
          // Movement
          hasDoubleJumped: false,
          isWallSliding: false,
          dashTimer: 0,
      }
  };
  
  const [player, setPlayer] = useState<Player>(() => createPlayer(startingHero, C.PLAYER_STARTING_LIVES));
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [cages, setCages] = useState<RescueCage[]>([]);
  const [crates, setCrates] = useState<Crate[]>([]);
  const [explosions, setExplosions] = useState<Explosion[]>([]);
  const [turrets, setTurrets] = useState<Turret[]>([]);
  const [score, setScore] = useState(0);
  const [levelIndex, setLevelIndex] = useState(0);
  const [bulletCooldown, setBulletCooldown] = useState(0);
  const [yVelocity, setYVelocity] = useState(0);
  const [screenShake, setScreenShake] = useState({ x: 0, y: 0, magnitude: 0 });

  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const coyoteTimeCounter = useRef(0);
  const jumpBufferCounter = useRef(0);
  const levelStartTime = useRef(0);
  const prevEnemiesCount = useRef(0);
  
  const createEnemy = useCallback((base: Omit<Enemy, 'id' | 'type' | 'villain' | 'health' | 'maxHealth' | 'damageFlash'>, villain: CharacterProfile): Enemy => {
    const health = base.isBoss ? C.BOSS_MAX_HEALTH : C.ENEMY_MAX_HEALTH;
    return {
      id: nextObjectId.current++, type: 'enemy', ...base, villain, health, maxHealth: health, damageFlash: 0
    };
  }, []);

  const createCrate = (x:number, y:number, width:number, height:number): Crate => ({
      id: nextObjectId.current++, type: 'crate', x, y, width, height, health: 20
  });
  
  const createCage = (x:number, y:number, width:number, height:number): RescueCage => ({
      id: nextObjectId.current++, type: 'rescue_cage', x, y, width, height, health: C.CAGE_HEALTH
  });

  const createExplosion = (x: number, y: number, width: number, height: number): Explosion => ({
    id: nextObjectId.current++, type: 'explosion', x, y, width, height, life: 15
  });

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
        onGameOver(score); // You win!
        return;
    }
    
    levelStartTime.current = Date.now();

    setBullets([]);
    setTurrets([]);
    
    const staticPlatforms = levelData.platforms.map(p => createCrate(p.x, p.y, p.width, p.height));
    const destructible = levelData.destructibleCrates.map(p => createCrate(p.x, p.y, p.width, p.height));
    setCrates([...staticPlatforms, ...destructible]);

    setCages(levelData.cages.map(c => createCage(c.x, c.y, c.width, c.height)));
    
    const newEnemies = levelData.enemies.map(e => createEnemy(e, characters.villains[Math.floor(Math.random() * characters.villains.length)]));
    if (levelData.boss) {
        newEnemies.push(createEnemy(levelData.boss, characters.villains[0]));
    }
    setEnemies(newEnemies);
  }, [createEnemy, characters.villains, onGameOver, score]);

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
    // --- TIMERS & COOLDOWNS ---
    coyoteTimeCounter.current = Math.max(0, coyoteTimeCounter.current - 1);
    jumpBufferCounter.current = Math.max(0, jumpBufferCounter.current - 1);
    setBulletCooldown(c => Math.max(0, c - 1));
    setPlayer(p => ({
        ...p,
        specialAbilityCooldown: Math.max(0, p.specialAbilityCooldown - 1),
        invincibilityTimer: Math.max(0, p.invincibilityTimer - 1),
        isInvincible: p.invincibilityTimer > 0,
        damageFlash: Math.max(0, p.damageFlash - 1),
        dashTimer: Math.max(0, p.dashTimer - 1),
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
        if (keysPressed.current['a'] || keysPressed.current['ArrowLeft']) { newX -= C.PLAYER_SPEED; setPlayer(p => ({...p, direction: 'left'})) }
        if (keysPressed.current['d'] || keysPressed.current['ArrowRight']) { newX += C.PLAYER_SPEED; setPlayer(p => ({...p, direction: 'right'})) }
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

    if (jumpBufferCounter.current > 0) {
        if (coyoteTimeCounter.current > 0) { // Ground jump
            newYVelocity = -C.PLAYER_JUMP_FORCE;
            didJump = true;
        } else if (isWallSliding) { // Wall jump
            const wallJumpDirection = player.direction === 'right' ? -1 : 1;
            setPlayer(p => ({...p, x: p.x + wallJumpDirection * C.PLAYER_SPEED, direction: wallJumpDirection === 1 ? 'right' : 'left' }));
            newYVelocity = -C.PLAYER_JUMP_FORCE * 1.1;
            didJump = true;
        } else if (movementAbility.includes('double') && !player.hasDoubleJumped) { // Double jump
            newYVelocity = -C.PLAYER_JUMP_FORCE;
            setPlayer(p => ({...p, hasDoubleJumped: true}));
            didJump = true;
        }
    }
    
    if (didJump) {
        audioService.playSound('jump');
        jumpBufferCounter.current = 0;
        coyoteTimeCounter.current = 0;
        setPlayer(p => ({...p, isWallSliding: false}));
    }

    setPlayer(p => ({...p, y: newPlayerY}));
    setYVelocity(newYVelocity);
    
    // --- SHOOTING (PLAYER) ---
    if (keysPressed.current[' '] && bulletCooldown === 0) {
      const weapon = player.hero.weaponType.toLowerCase();
      const newBullets: Bullet[] = [];
      const commonProps = {
        type: 'bullet' as const, owner: 'player' as const, weaponType: player.hero.weaponType,
        y: player.y + player.height / 2 - C.BULLET_HEIGHT / 2, width: C.BULLET_WIDTH, height: C.BULLET_HEIGHT,
      };

      if (weapon.includes('shotgun')) {
        audioService.playSound('shoot_shotgun');
        for (let i = 0; i < 5; i++) newBullets.push({ ...commonProps, id: nextObjectId.current++, x: player.x + (player.direction === 'right' ? player.width : -C.BULLET_WIDTH), vx: (player.direction === 'right' ? 1 : -1) * C.BULLET_SPEED * (0.8 + Math.random() * 0.4), vy: (i - 2) * 1.5 });
        setBulletCooldown(C.BULLET_COOLDOWN * 2.5);
      } else if (weapon.includes('grenade')) {
        audioService.playSound('shoot_grenade');
        newBullets.push({ ...commonProps, id: nextObjectId.current++, x: player.x + (player.direction === 'right' ? player.width / 2 : 0), vx: (player.direction === 'right' ? 1 : -1) * C.BULLET_SPEED * 0.7, vy: -10 });
        setBulletCooldown(C.BULLET_COOLDOWN * 3);
      } else { // Default to Rifle behavior
        audioService.playSound('shoot_rifle');
        newBullets.push({ ...commonProps, id: nextObjectId.current++, x: player.x + (player.direction === 'right' ? player.width : -C.BULLET_WIDTH), vx: (player.direction === 'right' ? 1 : -1) * C.BULLET_SPEED, vy: 0 });
        setBulletCooldown(C.BULLET_COOLDOWN);
      }
      setBullets(b => [...b, ...newBullets]);
    }

    // --- SPECIAL ABILITIES & MOVEMENT ABILITIES ---
    if (keysPressed.current['e'] && player.specialAbilityCooldown === 0) {
        setPlayer(p => ({...p, specialAbilityCooldown: C.SPECIAL_ABILITY_COOLDOWN}));
        const ability = player.hero.specialAbility.toLowerCase();
        if(ability.includes('turret')) {
            setTurrets(t => [...t, {id: nextObjectId.current++, type: 'turret', x: player.x, y: player.y, width: C.PLAYER_WIDTH, height: C.PLAYER_HEIGHT, life: C.TURRET_LIFESPAN, shootCooldown: 0, direction: player.direction}])
        } else if (ability.includes('invincib')) {
            setPlayer(p => ({...p, invincibilityTimer: C.INVINCIBILITY_DURATION}));
        } else if (ability.includes('cluster')) {
            for (let i = 0; i < 8; i++) {
                setBullets(b => [...b, {id: nextObjectId.current++, type: 'bullet', owner: 'player', weaponType: 'Grenade Launcher', x: player.x, y: player.y, width: C.BULLET_WIDTH, height: C.BULLET_HEIGHT, vx: (Math.random() - 0.5) * C.BULLET_SPEED, vy: -Math.random() * 12}])
            }
        }
        // Combined special + movement for dash strike for backwards compatibility
        if (ability.includes('dash')) {
             setPlayer(p => ({...p, dashTimer: 20, invincibilityTimer: 20}));
             audioService.playSound('dash');
        }
    }
    
    // Air Dash
    if (keysPressed.current['shift'] && movementAbility.includes('dash') && player.dashTimer <=0 && !onGround) {
        setPlayer(p => ({...p, dashTimer: 20, invincibilityTimer: 20}));
        audioService.playSound('dash');
    }


    // --- ENEMY & TURRET AI ---
    const allTargets = [player]; // Future: add other targets
    const createEnemyBullet = (shooter: Enemy | Turret, target: Player) => {
        const dirToPlayer = target.x > shooter.x ? 1 : -1;
        audioService.playSound('shoot_rifle');
        const ownerType = shooter.type === 'turret' ? 'turret' : 'enemy';
        const weaponType = shooter.type === 'enemy' ? shooter.villain.weaponType : 'Rifle';
        setBullets(b => [...b, { id: nextObjectId.current++, type: 'bullet', owner: ownerType, weaponType: weaponType,
            x: shooter.x + (dirToPlayer === 1 ? shooter.width : -C.BULLET_WIDTH), y: shooter.y + shooter.height / 2, width: C.BULLET_WIDTH, height: C.BULLET_HEIGHT, vx: dirToPlayer * C.BULLET_SPEED * 0.8, vy: 0,
        }]);
    }

    setEnemies(es => es.map(enemy => {
        const target = allTargets[0];
        let newCooldown = enemy.shootCooldown - 1;
        let newX = enemy.x;
        if(enemy.isBoss) { // Boss follows player
            const dir = target.x > enemy.x ? 1 : -1;
            newX += dir * enemy.moveSpeed;
            enemy.direction = dir === 1 ? 'right' : 'left';
        }

        if (newCooldown <= 0 && Math.abs(target.y - enemy.y) < 250 && Math.abs(target.x - enemy.x) < 600) {
            createEnemyBullet(enemy, target);
            newCooldown = 90 + Math.random() * 60;
        }
        return { ...enemy, x: newX, shootCooldown: newCooldown }
    }));

    setTurrets(ts => {
        const updatedTurrets = ts.map(turret => {
            let newCooldown = turret.shootCooldown - 1;
            if (newCooldown <= 0 && enemies.length > 0) {
                // Find nearest enemy
                const nearestEnemy = enemies.reduce((closest, current) => {
                    const closestDist = Math.abs(closest.x - turret.x);
                    const currentDist = Math.abs(current.x - turret.x);
                    return currentDist < closestDist ? current : closest;
                }, enemies[0]);
                
                if (Math.abs(nearestEnemy.x - turret.x) < 500) {
                     createEnemyBullet(turret, nearestEnemy as any); // hack to reuse bullet logic
                     newCooldown = C.TURRET_SHOOT_COOLDOWN;
                }
            }
            return {...turret, life: turret.life -1, shootCooldown: newCooldown}
        });
        return updatedTurrets.filter(t => t.life > 0)
    });

    // --- BULLET MOVEMENT ---
    setBullets(bs => bs.map(b => ({...b, x: b.x + b.vx, y: b.y + (b.weaponType.toLowerCase().includes('grenade') ? (b.vy += C.GRAVITY/1.5) : b.vy) }))
        .filter(b => b.x > -100 && b.x < C.GAME_WIDTH + 100 && b.y < C.GAME_HEIGHT + 100));

    // --- COLLISION DETECTION ---
    let newScore = score;
    const currentExplosions: Explosion[] = [];
    let remainingBullets: Bullet[] = [];

    for (const bullet of bullets) {
        let hit = false;
        
        const checkHit = (target: Player | Enemy | Crate | RescueCage, damage: number): Player | Enemy | Crate | RescueCage => {
            if (hit || !checkCollision(bullet, target)) {
                return target;
            }

            // Player bullet hits enemy, crate, or cage
            if (bullet.owner === 'player' && (target.type === 'enemy' || target.type === 'crate' || target.type === 'rescue_cage')) {
                hit = true;
                if (!bullet.weaponType.toLowerCase().includes('grenade')) {
                    currentExplosions.push(createExplosion(bullet.x, bullet.y, 20, 20));
                }
                const newHealth = target.health - damage;

                if (target.type === 'enemy') {
                    if (newHealth <= 0) {
                        newScore += target.isBoss ? 5000 : 100;
                        audioService.playSound('explosion');
                        triggerScreenShake(target.isBoss ? 15 : 5, 300);
                        currentExplosions.push(createExplosion(target.x, target.y, target.width * 1.5, target.height * 1.5));
                    }
                    return { ...target, health: newHealth, damageFlash: 5 };
                }
                
                if (target.type === 'rescue_cage') {
                    if (newHealth <= 0) {
                        audioService.playSound('rescue');
                        setPlayer(p => ({ ...p, lives: p.lives + 1 }));
                        swapHero();
                    }
                    return { ...target, health: newHealth };
                }
                
                // This is for target.type === 'crate'
                if(newHealth <= 0) {
                    audioService.playSound('explosion');
                    currentExplosions.push(createExplosion(target.x + target.width/2, target.y + target.height/2, target.width, target.height));
                }
                return { ...target, health: newHealth };
            }

            // Enemy bullet hits player
            if ((bullet.owner === 'enemy' || bullet.owner === 'turret') && target.type === 'player' && !target.isInvincible) {
                if (DEV_MODE_GOD_MODE) return target; // GOD MODE
                hit = true;
                audioService.playSound('hurt');
                triggerScreenShake(3, 150);
                return { ...target, health: target.health - damage, damageFlash: 5 };
            }

            return target;
        };

        // Check hits
        setPlayer(p => checkHit(p, 10) as Player);
        
        const remainingEnemies: Enemy[] = [];
        enemies.forEach(e => {
            const newE = checkHit(e, 20) as Enemy;
            if (newE.health > 0) remainingEnemies.push(newE);
        });
        setEnemies(remainingEnemies);

        const remainingCrates: Crate[] = [];
        crates.forEach(c => {
            const newC = checkHit(c, 20) as Crate;
            if(newC.health > 0) remainingCrates.push(newC);
        });
        setCrates(remainingCrates);

        const remainingCages: RescueCage[] = [];
        cages.forEach(c => {
            const newC = checkHit(c, 20) as RescueCage;
            if(newC.health > 0) remainingCages.push(newC);
        });
        setCages(remainingCages);

        if (bullet.weaponType.toLowerCase().includes('grenade') && bullet.y >= C.GAME_HEIGHT - 50 - bullet.height) {
            hit = true;
            audioService.playSound('explosion');
            triggerScreenShake(8, 200);
            currentExplosions.push(createExplosion(bullet.x, bullet.y, 80, 80));
        }

        if (!hit) remainingBullets.push(bullet);
    }
    setBullets(remainingBullets);

    setScore(newScore);
    setExplosions(prev => [...prev, ...currentExplosions]);
    setExplosions(ex => ex.map(e => ({...e, life: e.life - 1})).filter(e => e.life > 0));

    // --- GAME STATE ---
    if (player.health <= 0) {
        if(player.lives > 0) {
            setPlayer(p => createPlayer(p.hero, p.lives - 1));
            swapHero();
        } else {
            onGameOver(score);
        }
    }
    
    // Level complete check
    if (levelStartTime.current > 0 && Date.now() - levelStartTime.current > 1000 && enemies.length === 0 && prevEnemiesCount.current > 0 && explosions.length === 0) {
        setLevelIndex(l => l + 1);
        setPlayer(p => ({...p, health: Math.min(p.maxHealth, p.health + 25)}));
    }
    prevEnemiesCount.current = enemies.length;
  }, [player, yVelocity, bulletCooldown, bullets, enemies, crates, cages, score, levelIndex, characters, swapHero, onGameOver, screenShake.magnitude]);

  useGameLoop(gameLoop);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true;
      if (e.key === 'w' || e.key === 'ArrowUp') {
        jumpBufferCounter.current = 6;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => { keysPressed.current[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
  
  const PlayerSprite = () => {
    let classes = 'bg-transparent';
    if(player.isInvincible && !player.dashTimer) classes += ' opacity-50';
    if(player.damageFlash > 0) classes += ' flash-damage';
    if(player.dashTimer > 0) classes += ' opacity-75';
    if(player.isWallSliding) classes += ' border-4 border-cyan-400';

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
        </div>
      </div>
    </div>
  );
};

export default GameScreen;
