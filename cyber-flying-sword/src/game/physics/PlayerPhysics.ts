import * as THREE from 'three';
import {
  DETACH_THRESHOLD,
  GRAVITY,
  AIR_DRAG,
  BOUNCE_FACTOR,
  REATTACH_SPEED,
  AIRFLOW_SPEED,
  PLAYER_ATTACH_NODE,
  WORLD_WIDTH,
  WORLD_HEIGHT,
} from '../../utils/Constants';

/**
 * 角色状态
 * - ATTACHED: 挂在鞭子上，跟随移动
 * - LAUNCHED: 弹射飞行中
 * - SHIELDING: 握拳防御，位置固定
 */
export type PlayerMoveState = 'ATTACHED' | 'LAUNCHED' | 'SHIELDING';

/**
 * PlayerPhysics — 角色挂载/弹射/反弹物理
 * 
 * 角色不是操控主体，是鞭子的附属物理对象：
 * - 跟随态：挂在鞭子链的某个中前段节点
 * - 弹射态：当鞭子甩动加速度超阈值，角色脱离，惯性飞行
 * - 防御态：握拳时位置固定悬浮
 */
export class PlayerPhysics {
  /** 角色位置 */
  readonly position = new THREE.Vector3(0, 0, 0);

  /** 角色速度 */
  readonly velocity = new THREE.Vector3(0, 0, 0);

  /** 当前移动状态 */
  state: PlayerMoveState = 'ATTACHED';

  /** 是否有气流罩 */
  hasAirflow: boolean = false;

  /** 角色朝向（-1 左, 1 右） */
  facing: number = 1;

  // 内部临时变量
  private _prevAttachPos = new THREE.Vector3();
  private _attachVelocity = new THREE.Vector3();

  /**
   * 每帧更新
   * @param whipNodes 鞭子节点位置数组
   * @param dt delta time（秒）
   * @param isShielding 是否在握拳防御
   */
  update(whipNodes: THREE.Vector3[], dt: number, isShielding: boolean): void {
    if (dt <= 0) return;

    if (isShielding) {
      this._updateShielding();
      return;
    }

    switch (this.state) {
      case 'ATTACHED':
        this._updateAttached(whipNodes, dt);
        break;
      case 'LAUNCHED':
        this._updateLaunched(dt);
        break;
      case 'SHIELDING':
        // 从防御切换到其他状态时，先回到 ATTACHED
        this.state = 'ATTACHED';
        this._updateAttached(whipNodes, dt);
        break;
    }

    // 更新朝向
    if (Math.abs(this.velocity.x) > 0.5) {
      this.facing = this.velocity.x > 0 ? 1 : -1;
    }
  }

  /** 重置到初始位置 */
  reset(pos: THREE.Vector3): void {
    this.position.copy(pos);
    this.velocity.set(0, 0, 0);
    this.state = 'ATTACHED';
    this.hasAirflow = false;
    this.facing = 1;
  }

  // ===================== 内部方法 =====================

  /**
   * 挂载跟随态
   * 角色位置 = 挂载节点位置 + 重力偏移
   * 如果加速度超过阈值 → 脱离弹射
   */
  private _updateAttached(whipNodes: THREE.Vector3[], dt: number): void {
    const attachNode = whipNodes[PLAYER_ATTACH_NODE];
    if (!attachNode) return;

    // 计算挂载点速度
    this._attachVelocity.subVectors(attachNode, this._prevAttachPos).divideScalar(dt);
    this._prevAttachPos.copy(attachNode);

    // 计算加速度（速度变化率）
    const accel = this._attachVelocity.length() / dt;

    if (accel > DETACH_THRESHOLD) {
      // 加速度超过阈值 → 弹射！
      this.state = 'LAUNCHED';
      this.velocity.copy(this._attachVelocity);
      this.position.copy(attachNode);
      return;
    }

    // 正常跟随
    this.position.x = attachNode.x;
    this.position.y = attachNode.y - 5; // 重力偏移，角色略低于挂载点
    this.position.z = attachNode.z;
    this.velocity.set(0, 0, 0);
    this.hasAirflow = false;
  }

  /**
   * 弹射飞行态
   * 惯性运动 + 重力 + 空气阻力 + 边界反弹
   */
  private _updateLaunched(dt: number): void {
    // 重力
    this.velocity.y += GRAVITY * dt;

    // 空气阻力
    this.velocity.multiplyScalar(AIR_DRAG);

    // 位移
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    // 气流罩判定
    const speed = this.velocity.length();
    this.hasAirflow = speed > AIRFLOW_SPEED;

    // 边界反弹
    this._bounceAtBounds();

    // 速度低于阈值 → 磁吸回鞭
    if (speed < REATTACH_SPEED) {
      this.state = 'ATTACHED';
      this.hasAirflow = false;
    }
  }

  /**
   * 防御态：位置固定
   */
  private _updateShielding(): void {
    this.state = 'SHIELDING';
    this.velocity.set(0, 0, 0);
    this.hasAirflow = false;
    // 位置不变，悬浮在原地
  }

  /**
   * 画面边界反弹
   */
  private _bounceAtBounds(): void {
    // 左右边界
    if (this.position.x < -WORLD_WIDTH) {
      this.position.x = -WORLD_WIDTH;
      this.velocity.x = Math.abs(this.velocity.x) * BOUNCE_FACTOR;
    } else if (this.position.x > WORLD_WIDTH) {
      this.position.x = WORLD_WIDTH;
      this.velocity.x = -Math.abs(this.velocity.x) * BOUNCE_FACTOR;
    }

    // 上下边界
    if (this.position.y < -WORLD_HEIGHT) {
      this.position.y = -WORLD_HEIGHT;
      this.velocity.y = Math.abs(this.velocity.y) * BOUNCE_FACTOR;
    } else if (this.position.y > WORLD_HEIGHT) {
      this.position.y = WORLD_HEIGHT;
      this.velocity.y = -Math.abs(this.velocity.y) * BOUNCE_FACTOR;
    }
  }
}
