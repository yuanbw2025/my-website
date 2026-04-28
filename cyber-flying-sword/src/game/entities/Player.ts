import * as THREE from 'three';
import { MAX_HP, MAX_SHIELD, SHIELD_REGEN_RATE } from '../../utils/Constants';
import { clamp } from '../../utils/MathUtils';
import { PlayerPhysics, PlayerMoveState } from '../physics/PlayerPhysics';
import { GestureType } from '../input/GestureDetector';

/**
 * Player — 玩家实体
 * 
 * 管理玩家的所有数据：
 * - 资源：HP / Shield / Rage
 * - 物理：位置 / 速度 / 状态（通过 PlayerPhysics）
 * - 手势状态
 */
export class Player {
  // ===== 资源 =====
  hp: number = MAX_HP;
  maxHp: number = MAX_HP;
  shield: number = MAX_SHIELD;
  maxShield: number = MAX_SHIELD;

  // ===== 物理 =====
  readonly physics: PlayerPhysics;

  // ===== 状态 =====
  gesture: GestureType = 'NONE';
  alive: boolean = true;

  // ===== 碰撞体 =====
  readonly collisionRadius: number = 8;

  constructor() {
    this.physics = new PlayerPhysics();
  }

  /** 位置快捷访问 */
  get position(): THREE.Vector3 {
    return this.physics.position;
  }

  get x(): number { return this.physics.position.x; }
  get y(): number { return this.physics.position.y; }

  /** 移动状态 */
  get moveState(): PlayerMoveState {
    return this.physics.state;
  }

  /** 是否在防御中 */
  get isShielding(): boolean {
    return this.gesture === 'FIST';
  }

  /** HP 百分比 [0, 1] */
  get hpPercent(): number {
    return this.hp / this.maxHp;
  }

  /** 护盾百分比 [0, 1] */
  get shieldPercent(): number {
    return this.shield / this.maxShield;
  }

  /**
   * 受到伤害
   * @param damage 伤害值
   */
  takeDamage(damage: number): void {
    this.hp = clamp(this.hp - damage, 0, this.maxHp);
    if (this.hp <= 0) {
      this.alive = false;
    }
  }

  /**
   * 消耗护盾
   * @param cost 消耗值
   */
  consumeShield(cost: number): void {
    this.shield = clamp(this.shield - cost, 0, this.maxShield);
  }

  /**
   * 护盾自然回复（每帧调用）
   */
  regenShield(dt: number): void {
    if (this.gesture !== 'FIST') {
      // 非防御状态下缓慢回复
      this.shield = clamp(this.shield + SHIELD_REGEN_RATE * dt, 0, this.maxShield);
    }
  }

  /**
   * 回复 HP
   */
  heal(amount: number): void {
    this.hp = clamp(this.hp + amount, 0, this.maxHp);
  }

  /**
   * 重置到初始状态
   */
  reset(position?: THREE.Vector3): void {
    this.hp = this.maxHp;
    this.shield = this.maxShield;
    this.gesture = 'NONE';
    this.alive = true;
    if (position) {
      this.physics.reset(position);
    }
  }
}
