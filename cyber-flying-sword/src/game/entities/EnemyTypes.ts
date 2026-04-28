import { Enemy } from './Enemy';
import {
  MELEE_GRUNT_HP,
  MELEE_GRUNT_SPEED,
  MELEE_GRUNT_DAMAGE,
  MELEE_GRUNT_ATTACK_RANGE,
  MELEE_GRUNT_ATTACK_COOLDOWN,
} from '../../utils/Constants';

/**
 * 创建近战杂兵
 * 
 * 行为：缓慢靠近玩家 → 近身劈砍
 * 用途：练习鞭击手感的基础敌人
 */
export function createMeleeGrunt(x: number, y: number): Enemy {
  const enemy = new Enemy(
    MELEE_GRUNT_HP,
    MELEE_GRUNT_SPEED,
    MELEE_GRUNT_DAMAGE,
    MELEE_GRUNT_ATTACK_RANGE,
    MELEE_GRUNT_ATTACK_COOLDOWN,
  );
  enemy.x = x;
  enemy.y = y;
  enemy.radius = 10;
  return enemy;
}

/**
 * 生成一波敌人（MVP 简单波次）
 * @param wave 波次编号（越高越多）
 */
export function spawnWave(wave: number): Enemy[] {
  const enemies: Enemy[] = [];
  const count = Math.min(3 + wave, 8); // 3~8 个

  for (let i = 0; i < count; i++) {
    // 在屏幕右侧随机位置生成
    const x = 150 + Math.random() * 100;
    const y = (Math.random() - 0.5) * 200;
    enemies.push(createMeleeGrunt(x, y));
  }

  return enemies;
}
