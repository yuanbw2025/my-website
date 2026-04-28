import { TimeManager } from '../TimeManager';

/**
 * HitStop — 打击停顿效果
 * 
 * 当命中敌人或精防时触发短暂的时间冻结，
 * 增强打击感。
 * 
 * - 鞭击命中: 20ms 冻结
 * - 精防: 50ms 冻结 + 屏幕震动
 * - 大招: 500ms 冻结
 */
export class HitStop {
  private _timeManager: TimeManager;
  private _screenShake: number = 0; // 屏幕震动强度

  constructor(timeManager: TimeManager) {
    this._timeManager = timeManager;
  }

  /** 当前屏幕震动强度 [0, 1] */
  get screenShake(): number {
    return this._screenShake;
  }

  /** 鞭击命中 — 轻微停顿 */
  onWhipHit(): void {
    this._timeManager.freeze(20);
    this._screenShake = 0.2;
  }

  /** 精防 — 中等停顿 + 震动 */
  onPerfectBlock(): void {
    this._timeManager.freeze(50);
    this._screenShake = 0.6;
  }

  /** 大招 — 长时间冻结 */
  onUltimate(): void {
    this._timeManager.freeze(500);
    this._screenShake = 1.0;
  }

  /** 每帧更新（衰减震动） */
  update(dt: number): void {
    if (this._screenShake > 0) {
      this._screenShake *= Math.max(0, 1 - dt * 8); // 快速衰减
      if (this._screenShake < 0.01) {
        this._screenShake = 0;
      }
    }
  }

  /** 获取当前帧的相机偏移（用于震屏） */
  getCameraOffset(): { x: number; y: number } {
    if (this._screenShake <= 0) return { x: 0, y: 0 };
    const intensity = this._screenShake * 8; // 最大偏移 8 pixels
    return {
      x: (Math.random() - 0.5) * 2 * intensity,
      y: (Math.random() - 0.5) * 2 * intensity,
    };
  }
}
