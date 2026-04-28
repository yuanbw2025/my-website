import * as THREE from 'three';
import {
  WHIP_SEGMENTS,
  HEAD_LERP,
  TAIL_LERP,
  UPWARD_DRIFT,
} from '../../utils/Constants';

/**
 * WhipPhysics — 飞剑鞭子 lerp 链物理
 * 
 * 鞭子是 N 个节点组成的弹簧-阻尼绳体：
 * - 节点 0（握柄端）紧跟手指位置（高 lerp）
 * - 节点 N（鞭尾端）大幅延迟（低 lerp），产生甩鞭效果
 * - 每个节点有轻微上漂力（仙气效果）
 * 
 * 核心原理：复用现有 demo 的 fingerHistory lerp 链，
 * 语义从"手指轨迹"变成"鞭子绳体"。
 */
export class WhipPhysics {
  /** 鞭子节点位置数组 */
  readonly nodes: THREE.Vector3[];

  /** 上一帧的节点位置（用于计算速度） */
  private _prevNodes: THREE.Vector3[];

  /** 每个节点的速度缓存（标量，每帧更新） */
  private _velocities: Float32Array;

  /** 节点数量 */
  readonly segmentCount: number;

  constructor(segmentCount: number = WHIP_SEGMENTS) {
    this.segmentCount = segmentCount;
    this.nodes = [];
    this._prevNodes = [];
    this._velocities = new Float32Array(segmentCount);

    for (let i = 0; i < segmentCount; i++) {
      this.nodes.push(new THREE.Vector3(0, 0, 0));
      this._prevNodes.push(new THREE.Vector3(0, 0, 0));
    }
  }

  /**
   * 每帧更新鞭子物理
   * @param fingerPos 手指位置（游戏世界坐标）
   * @param dt delta time（秒）
   */
  update(fingerPos: THREE.Vector3, dt: number): void {
    if (dt <= 0) return;

    const invDt = 1 / dt;

    // 保存上一帧位置用于速度计算
    for (let i = 0; i < this.segmentCount; i++) {
      this._prevNodes[i].copy(this.nodes[i]);
    }

    // 节点 0：直接跟随手指
    this.nodes[0].lerp(fingerPos, HEAD_LERP);

    // 后续节点：依次跟随前一节点
    for (let i = 1; i < this.segmentCount; i++) {
      // lerp 系数从 HEAD_LERP 线性衰减到 TAIL_LERP
      const t = i / this.segmentCount;
      const lerpFactor = HEAD_LERP - (HEAD_LERP - TAIL_LERP) * t;

      // 目标位置 = 前一节点 + 上漂力
      const target = this.nodes[i - 1];
      const targetX = target.x;
      const targetY = target.y + UPWARD_DRIFT;
      const targetZ = target.z;

      // lerp 到目标
      this.nodes[i].x += (targetX - this.nodes[i].x) * lerpFactor;
      this.nodes[i].y += (targetY - this.nodes[i].y) * lerpFactor;
      this.nodes[i].z += (targetZ - this.nodes[i].z) * lerpFactor;
    }

    // 计算每个节点的速度（标量）
    for (let i = 0; i < this.segmentCount; i++) {
      const dx = this.nodes[i].x - this._prevNodes[i].x;
      const dy = this.nodes[i].y - this._prevNodes[i].y;
      const dz = this.nodes[i].z - this._prevNodes[i].z;
      this._velocities[i] = Math.sqrt(dx * dx + dy * dy + dz * dz) * invDt;
    }
  }

  /**
   * 获取指定节点的速度（标量，单位/秒）
   */
  getSegmentVelocity(index: number): number {
    if (index < 0 || index >= this.segmentCount) return 0;
    return this._velocities[index];
  }

  /**
   * 获取鞭尾速度（最后一个节点）
   */
  getTailVelocity(): number {
    return this._velocities[this.segmentCount - 1];
  }

  /**
   * 获取鞭子的平均速度
   */
  getAverageVelocity(): number {
    let sum = 0;
    for (let i = 0; i < this.segmentCount; i++) {
      sum += this._velocities[i];
    }
    return sum / this.segmentCount;
  }

  /**
   * 重置所有节点到指定位置
   */
  resetTo(pos: THREE.Vector3): void {
    for (let i = 0; i < this.segmentCount; i++) {
      this.nodes[i].copy(pos);
      this._prevNodes[i].copy(pos);
      this._velocities[i] = 0;
    }
  }

  /**
   * 护盾模式：鞭子收回到指定中心点围绕旋转
   * @param center 角色位置
   * @param elapsed 已经过的时间（用于旋转角度）
   * @param radius 旋转半径
   */
  contractToShield(center: THREE.Vector3, elapsed: number, radius: number = 20): void {
    for (let i = 0; i < this.segmentCount; i++) {
      const angle = (i / this.segmentCount) * Math.PI * 2 + elapsed * 5;
      const targetX = center.x + Math.cos(angle) * radius;
      const targetY = center.y + Math.sin(angle) * radius;
      const targetZ = center.z;

      this.nodes[i].x += (targetX - this.nodes[i].x) * 0.15;
      this.nodes[i].y += (targetY - this.nodes[i].y) * 0.15;
      this.nodes[i].z += (targetZ - this.nodes[i].z) * 0.15;
    }
  }
}
