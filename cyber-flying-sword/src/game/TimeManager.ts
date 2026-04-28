/**
 * TimeManager — 全局时间缩放管理
 * 
 * 用于 hit-stop 效果：将 timeScale 设为接近 0 的值实现时间冻结，
 * 然后平滑恢复到 1.0。
 * 
 * 使用方式：
 *   timeManager.freeze(50);  // 冻结 50ms
 *   const scaledDt = timeManager.getScaledDelta(rawDt);
 */
export class TimeManager {
  private _timeScale: number = 1.0;
  private _freezeEndTime: number = 0;
  private _slowmoEndTime: number = 0;
  private _slowmoScale: number = 1.0;

  /** 当前时间缩放因子 */
  get timeScale(): number {
    return this._timeScale;
  }

  /**
   * 冻结时间（hit-stop）
   * @param durationMs 冻结持续时间（毫秒）
   */
  freeze(durationMs: number): void {
    this._freezeEndTime = performance.now() + durationMs;
    this._timeScale = 0.0;
  }

  /**
   * 慢动作
   * @param scale 时间缩放（0.05 = 20倍慢放）
   * @param durationMs 持续时间
   */
  slowmo(scale: number, durationMs: number): void {
    this._slowmoScale = scale;
    this._slowmoEndTime = performance.now() + durationMs;
  }

  /**
   * 每帧调用，更新时间缩放状态
   */
  update(): void {
    const now = performance.now();

    if (now < this._freezeEndTime) {
      // 仍在冻结中
      this._timeScale = 0.0;
    } else if (now < this._slowmoEndTime) {
      // 慢动作中
      this._timeScale = this._slowmoScale;
    } else {
      // 正常速度
      this._timeScale = 1.0;
    }
  }

  /**
   * 获取经过时间缩放的 delta time
   * @param rawDt 原始 delta time（秒）
   * @returns 缩放后的 delta time
   */
  getScaledDelta(rawDt: number): number {
    return rawDt * this._timeScale;
  }

  /** 重置到正常状态 */
  reset(): void {
    this._timeScale = 1.0;
    this._freezeEndTime = 0;
    this._slowmoEndTime = 0;
    this._slowmoScale = 1.0;
  }
}
