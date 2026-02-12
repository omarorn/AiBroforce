
import { GameEntityFactory } from './gameEntityFactory';
import * as C from '../constants';
import type { CharacterProfile } from '../types';

// Mock Character Profile
const mockProfile: CharacterProfile = {
  id: 1,
  name: "Test Bro",
  description: "Test",
  weaponType: "Gun",
  specialAbility: "Boom",
  movementAbility: "Jump",
  catchphrase: "Yeah",
};

// Simple Test Suite (Console based as per environment limitations)
console.log("Running GameEntityFactory Tests...");

// Test Player Creation
const player = GameEntityFactory.createPlayer(mockProfile, 3);
if (player.type === 'player' && player.lives === 3 && player.health === C.PLAYER_MAX_HEALTH) {
    console.log("✅ Player creation passed");
} else {
    console.error("❌ Player creation failed", player);
}

// Test Enemy Creation
const enemy = GameEntityFactory.createEnemy({
    x: 0, y: 0, width: 50, height: 50, direction: 'left', moveSpeed: 1, shootCooldown: 10, isBoss: false
}, mockProfile);

if (enemy.type === 'enemy' && enemy.health === C.ENEMY_MAX_HEALTH && !enemy.isBoss) {
    console.log("✅ Enemy creation passed");
} else {
    console.error("❌ Enemy creation failed", enemy);
}

// Test Boss Creation
const boss = GameEntityFactory.createEnemy({
    x: 0, y: 0, width: 50, height: 50, direction: 'left', moveSpeed: 1, shootCooldown: 10, isBoss: true
}, mockProfile);

if (boss.isBoss && boss.health === C.BOSS_MAX_HEALTH) {
    console.log("✅ Boss creation passed");
} else {
    console.error("❌ Boss creation failed", boss);
}
