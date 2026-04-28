
import { Collidable } from '../physics/CollisionSystem';

/**
 * 敌人 AI 状态
 */
export type EnemyAIState = 'IDLE' | 'CHASE' | 'ATTACK' | 'HIT' | 'DEAD';

/**
 * 敌人攻击信息
 */
export interface EnemyAttack {
  /** 攻击中心相对于敌人的偏移 */
  offsetX: number;
  offsetY: number;
  /** 攻击半径 */
  radius: number;
  /** 伤害值 */
  damage: number;
  /** 当前是否在攻击判定中 */
  active: boolean;
}

/**
 * Enemy — 敌人基类
 * 
 * 敌人是动态的：能移动、能主动攻击、能释放技能。
 * 不是靶子。
 */
export class Enemy implements Collidable {
  // ===== 基础属性 =====
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;

  // ===== 位置 =====
  x: number = 0;
  y: number = 0;
  radius: number = 12;

  // ===== 状态 =====
  alive: boolean = true;
  aiState: EnemyAIState = 'IDLE';
  facing: number = -1; // -1 面朝左（面向玩家）

  // ===== 攻击 =====
  attackRange: number;
  attackCooldown: number; // ms
  private _lastAttackTime: number = 0;
  private _attackTimer: number = 0;
  private _attackDuration: number = 500; // 攻击前摇+判定时间 (ms)

  /** 当前攻击区域 */
  readonly attack: EnemyAttack = {
    offsetX: 0,
    offsetY: 0,
    radius: 15,
    damage: 0,
    active: false,
  };

  // ===== 受击 =====
  private _hitTimer: number = 0;
  private _hitDuration: number = 300; // 受击硬直时间 (ms)

  // ===== 视觉 =====
  /** 受击闪烁 */
  flashTimer: number = 0;

  constructor(
    hp: number,
    speed: number,
    damage: number,
    attackRange: number,
    attackCooldown: number,
  ) {
    this.hp = hp;
    this.maxHp = hp;
    this.speed = speed;
    this.damage = damage;
    this.attackRange = attackRange;
    this.attackCooldown = attackCooldown;
    this.attack.damage = damage;
  }

  /**
   * AI 行为更新
   * @param playerX 玩家 X 坐标
   * @param playerY 玩家 Y 坐标
   * @param dt delta time（秒）
   */
  updateAI(playerX: number, playerY: number, dt: number): void {
    if (!this.alive) return;

    const dtMs = dt * 1000;

    // 受击硬直
    if (this.aiState === 'HIT') {
      this._hitTimer -= dtMs;
      if (this._hitTimer <= 0) {
        this.aiState = 'CHASE';
      }
      this.attack.active = false;
      return;
    }

    // 更新朝向
    this.facing = playerX < this.x ? -1 : 1;

    // 计算与玩家的距离
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 攻击冷却
    const now = performance.now();
    const canAttack = (now - this._lastAttackTime) >= this.attackCooldown;

    if (this.aiState === 'ATTACK') {
      // 攻击动画进行中
      this._attackTimer -= dtMs;
      
      // 攻击前摇 50% 后开始判定
      if (this._attackTimer < this._attackDuration * 0.5) {
        this.attack.active = true;
        this.attack.offsetX = this.facing * this.attackRange * 0.5;
        this.attack.offsetY = 0;
      }

      if (this._attackTimer <= 0) {
        // 攻击结束
        this.attack.active = false;
        this.aiState = 'CHASE';
        this._lastAttackTime = now;
      }
      return;
    }

    // ===== CHASE / IDLE =====
    this.attack.active = false;

    if (dist <= this.attackRange && canAttack) {
      // 进入攻击范围且冷却好了 → 发起攻击
      this.aiState = 'ATTACK';
      this._attackTimer = this._attackDuration;
    } else {
      // 追击玩家
      this.aiState = 'CHASE';
      if (dist > this.attackRange * 0.8) {
        // 向玩家移动
        const moveX = (dx / dist) * this.speed * dt;
        const moveY = (dy / dist) * this.speed * dt;
        this.x += moveX;
        this.y += moveY;
      }
    }

    // 闪烁衰减
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
    }
  }

  /**
   * 受到伤害
   */
  takeDamage(damage: number): void {
    if (!this.alive) return;

    this.hp -= damage;
    this.flashTimer = 0.15; // 受击闪烁 150ms

    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.aiState = 'DEAD';
      this.attack.active = false;
    } else {
      // 进入受击硬直
      this.aiState = 'HIT';
      this._hitTimer = this._hitDuration;
      this.attack.active = false;
    }
  }

  /**
   * 获取攻击区域世界坐标
   */
  getAttackWorldPos(): { x: number; y: number; radius: number } {
    return {
      x: this.x + this.attack.offsetX,
      y: this.y + this.attack.offsetY,
      radius: this.attack.radius,
    };
  }

  /**
   * 重置敌人
   */
  reset(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.hp = this.maxHp;
    this.alive = true;
    this.aiState = 'IDLE';
    this.attack.active = false;
    this.flashTimer = 0;
    this._lastAttackTime = 0;
    this._attackTimer = 0;
    this._hitTimer = 0;
  }
}
