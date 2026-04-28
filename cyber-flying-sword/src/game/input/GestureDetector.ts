import { ULTIMATE_HOLD_TIME } from '../../utils/Constants';

/**
 * 三种核心手势类型
 * - WHIP: 自然手型，挥鞭操控（默认）
 * - FIST: 握拳，护盾/格挡
 * - ULTIMATE: 一指定江山，怒气大招
 * - NONE: 无手部检测
 */
export type GestureType = 'WHIP' | 'FIST' | 'ULTIMATE' | 'NONE';

/** MediaPipe 归一化关键点 */
interface Landmark {
  x: number;
  y: number;
  z: number;
}

/**
 * GestureDetector — 手势识别
 * 
 * 基于 MediaPipe Hands 的 21 个关键点判断当前手势。
 * 
 * 关键点索引：
 * - 0: 手腕
 * - 4: 拇指尖  (3: 拇指 IP)
 * - 8: 食指尖  (6: 食指 PIP)
 * - 12: 中指尖 (10: 中指 PIP)
 * - 16: 无名指尖 (14: 无名指 PIP)
 * - 20: 小指尖 (18: 小指 PIP)
 */
export class GestureDetector {
  private _ultimateHoldStart: number = 0;
  private _currentGesture: GestureType = 'NONE';
  private _prevGesture: GestureType = 'NONE';
  private _gestureChangeTime: number = 0;

  /** 当前手势 */
  get gesture(): GestureType {
    return this._currentGesture;
  }

  /** 上一帧的手势 */
  get prevGesture(): GestureType {
    return this._prevGesture;
  }

  /** 手势最后切换的时间戳 (performance.now) */
  get gestureChangeTime(): number {
    return this._gestureChangeTime;
  }

  /** 手势是否刚刚发生了切换（本帧） */
  get justChanged(): boolean {
    return this._currentGesture !== this._prevGesture;
  }

  /**
   * 检测手势
   * @param landmarks 21 个归一化关键点
   * @returns 当前手势类型
   */
  detect(landmarks: Landmark[]): GestureType {
    this._prevGesture = this._currentGesture;

    const wrist = landmarks[0];

    // 计算各手指伸展状态
    const isThumbUp = this._dist(wrist, landmarks[4]) > this._dist(wrist, landmarks[3]);
    const isIndexUp = this._dist(wrist, landmarks[8]) > this._dist(wrist, landmarks[6]);
    const isMiddleUp = this._dist(wrist, landmarks[12]) > this._dist(wrist, landmarks[10]);
    const isRingUp = this._dist(wrist, landmarks[16]) > this._dist(wrist, landmarks[14]);
    const isPinkyUp = this._dist(wrist, landmarks[20]) > this._dist(wrist, landmarks[18]);

    // === 一指定江山检测 ===
    // 拇指+食指伸展呈 90°，其余三指弯曲
    if (isThumbUp && isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
      const angle = this._calcThumbIndexAngle(landmarks);
      if (angle >= 70 && angle <= 110) {
        // 需要保持 300ms 以上
        if (this._ultimateHoldStart === 0) {
          this._ultimateHoldStart = performance.now();
        }
        if (performance.now() - this._ultimateHoldStart >= ULTIMATE_HOLD_TIME) {
          this._setGesture('ULTIMATE');
          return this._currentGesture;
        }
      } else {
        this._ultimateHoldStart = 0;
      }
    } else {
      this._ultimateHoldStart = 0;
    }

    // === 握拳检测 ===
    const extendedCount = [isThumbUp, isIndexUp, isMiddleUp, isRingUp, isPinkyUp]
      .filter(Boolean).length;
    if (extendedCount <= 1 && !isIndexUp && !isMiddleUp) {
      this._setGesture('FIST');
      return this._currentGesture;
    }

    // === 默认：挥鞭 ===
    this._setGesture('WHIP');
    return this._currentGesture;
  }

  /** 清除手部数据时调用 */
  clearHand(): void {
    this._prevGesture = this._currentGesture;
    this._setGesture('NONE');
    this._ultimateHoldStart = 0;
  }

  /** 重置 */
  reset(): void {
    this._currentGesture = 'NONE';
    this._prevGesture = 'NONE';
    this._ultimateHoldStart = 0;
    this._gestureChangeTime = 0;
  }

  // ============ 内部方法 ============

  private _setGesture(gesture: GestureType): void {
    if (this._currentGesture !== gesture) {
      this._gestureChangeTime = performance.now();
    }
    this._currentGesture = gesture;
  }

  /** 计算两个 landmark 之间的距离 */
  private _dist(a: Landmark, b: Landmark): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * 计算拇指方向和食指方向的夹角（度）
   * 拇指方向：landmark 2 → landmark 4
   * 食指方向：landmark 5 → landmark 8
   */
  private _calcThumbIndexAngle(lm: Landmark[]): number {
    // 拇指方向向量
    const thumbDx = lm[4].x - lm[2].x;
    const thumbDy = lm[4].y - lm[2].y;
    const thumbDz = lm[4].z - lm[2].z;

    // 食指方向向量
    const indexDx = lm[8].x - lm[5].x;
    const indexDy = lm[8].y - lm[5].y;
    const indexDz = lm[8].z - lm[5].z;

    // 点积
    const dot = thumbDx * indexDx + thumbDy * indexDy + thumbDz * indexDz;

    // 模长
    const thumbLen = Math.sqrt(thumbDx * thumbDx + thumbDy * thumbDy + thumbDz * thumbDz);
    const indexLen = Math.sqrt(indexDx * indexDx + indexDy * indexDy + indexDz * indexDz);

    if (thumbLen === 0 || indexLen === 0) return 0;

    // 夹角（弧度 → 度）
    const cosAngle = dot / (thumbLen * indexLen);
    const clampedCos = Math.max(-1, Math.min(1, cosAngle));
    return Math.acos(clampedCos) * (180 / Math.PI);
  }
}
