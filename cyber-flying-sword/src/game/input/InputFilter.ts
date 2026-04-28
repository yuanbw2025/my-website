import * as THREE from 'three';
import { EMA_ALPHA } from '../../utils/Constants';

/**
 * InputFilter — EMA 指数移动平均滤波器
 * 
 * 平滑 MediaPipe 输出的抖动。
 * EMA 公式：filtered = α × raw + (1 - α) × filtered_prev
 * 
 * α 越大 → 响应越快但越抖
 * α 越小 → 越平滑但延迟越大
 */
export class InputFilter {
  private _filtered = new THREE.Vector3();
  private _initialized = false;
  private _alpha: number;

  constructor(alpha: number = EMA_ALPHA) {
    this._alpha = alpha;
  }

  /**
   * 更新滤波器
   * @param raw 原始输入位置
   * @returns 平滑后的位置（复用对象，勿存引用）
   */
  update(raw: THREE.Vector3): THREE.Vector3 {
    if (!this._initialized) {
      // 第一帧直接使用原始值，避免从 (0,0,0) 插值
      this._filtered.copy(raw);
      this._initialized = true;
      return this._filtered;
    }

    this._filtered.x = this._alpha * raw.x + (1 - this._alpha) * this._filtered.x;
    this._filtered.y = this._alpha * raw.y + (1 - this._alpha) * this._filtered.y;
    this._filtered.z = this._alpha * raw.z + (1 - this._alpha) * this._filtered.z;

    return this._filtered;
  }

  /** 获取当前滤波后的值 */
  get value(): THREE.Vector3 {
    return this._filtered;
  }

  /** 重置滤波器 */
  reset(): void {
    this._filtered.set(0, 0, 0);
    this._initialized = false;
  }
}
