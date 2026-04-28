import * as THREE from 'three';
// Collision system uses dynamic node arrays, not fixed segment count
import { segmentCircleCollide, circleOverlap } from '../../utils/MathUtils';

/**
 * 碰撞结果
 */
export interface WhipHitResult {
  /** 命中的鞭子节点索引 */
  segmentIndex: number;
  /** 该节点的速度 */
  segmentVelocity: number;
}

export interface CollisionResult {
  /** 是否发生碰撞 */
  hit: boolean;
  /** 碰撞法向量（归一化, 从 A 指向 B） */
  normal?: THREE.Vector2;
}

/**
 * 可碰撞的实体接口
 */
export interface Collidable {
  /** 中心 X */
  x: number;
  /** 中心 Y */
  y: number;
  /** 碰撞半径 */
  radius: number;
  /** 是否存活（死亡实体不参与碰撞） */
  alive: boolean;
}

/**
 * CollisionSystem — 碰撞检测
 * 
 * 每帧检测顺序（按 TDD 定义）：
 * 1. 鞭子线段 vs 敌人 → 鞭击伤害
 * 2. 角色圆 vs 敌人攻击 → 玩家受伤
 * 3. 角色圆 vs 敌人 → 接触伤害 / 气流罩伤害
 * 4. 角色圆 vs 场景边界 → 反弹（在 PlayerPhysics 中处理）
 */
export class CollisionSystem {
  // 复用法向量
  private _normal = new THREE.Vector2();

  /**
   * 鞭子 vs 敌人碰撞检测
   * 检测所有鞭子线段和敌人的碰撞
   * 
   * @param whipNodes 鞭子节点位置数组
   * @param whipVelocities 获取节点速度的函数
   * @param enemy 敌人碰撞体
   * @returns 命中结果，null 表示未命中
   */
  whipVsEnemy(
    whipNodes: THREE.Vector3[],
    getVelocity: (i: number) => number,
    enemy: Collidable
  ): WhipHitResult | null {
    if (!enemy.alive) return null;

    // 遍历所有线段（相邻节点对）
    for (let i = 0; i < whipNodes.length - 1; i++) {
      const a = whipNodes[i];
      const b = whipNodes[i + 1];

      if (segmentCircleCollide(a.x, a.y, b.x, b.y, enemy.x, enemy.y, enemy.radius)) {
        return {
          segmentIndex: i,
          segmentVelocity: getVelocity(i),
        };
      }
    }

    return null;
  }

  /**
   * 角色 vs 敌人碰撞检测
   * @returns 碰撞结果，包含法向量
   */
  playerVsEnemy(
    playerX: number, playerY: number, playerRadius: number,
    enemy: Collidable
  ): CollisionResult {
    if (!enemy.alive) return { hit: false };

    const hit = circleOverlap(
      playerX, playerY, playerRadius,
      enemy.x, enemy.y, enemy.radius
    );

    if (hit) {
      // 计算碰撞法向量
      const dx = enemy.x - playerX;
      const dy = enemy.y - playerY;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        this._normal.set(dx / len, dy / len);
      } else {
        this._normal.set(1, 0);
      }
      return { hit: true, normal: this._normal };
    }

    return { hit: false };
  }

  /**
   * 角色 vs 攻击区域碰撞
   * @param attackX 攻击中心 X
   * @param attackY 攻击中心 Y
   * @param attackRadius 攻击半径
   */
  playerVsAttack(
    playerX: number, playerY: number, playerRadius: number,
    attackX: number, attackY: number, attackRadius: number
  ): boolean {
    return circleOverlap(
      playerX, playerY, playerRadius,
      attackX, attackY, attackRadius
    );
  }
}
