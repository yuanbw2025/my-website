import { TimeManager } from './TimeManager';

export type LoopCallback = (rawDt: number, scaledDt: number, elapsed: number) => void;

/**
 * GameLoop — requestAnimationFrame 主循环
 * 
 * 职责：
 * 1. 驱动 requestAnimationFrame
 * 2. 计算 deltaTime（秒）
 * 3. 应用 TimeManager 时间缩放
 * 4. 调用注册的回调
 */
export class GameLoop {
  private _running: boolean = false;
  private _rafId: number = 0;
  private _lastTime: number = 0;
  private _elapsed: number = 0;
  private _callback: LoopCallback | null = null;
  private _timeManager: TimeManager;

  // deltaTime 上限，避免切窗口回来后的巨大跳帧
  private readonly MAX_DT = 1 / 15; // 最大 ~66ms

  constructor(timeManager: TimeManager) {
    this._timeManager = timeManager;
  }

  /** 注册每帧回调 */
  onTick(callback: LoopCallback): void {
    this._callback = callback;
  }

  /** 启动循环 */
  start(): void {
    if (this._running) return;
    this._running = true;
    this._lastTime = performance.now();
    this._elapsed = 0;
    this._tick();
  }

  /** 停止循环 */
  stop(): void {
    this._running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = 0;
    }
  }

  /** 是否正在运行 */
  get running(): boolean {
    return this._running;
  }

  /** 总运行时间（秒） */
  get elapsed(): number {
    return this._elapsed;
  }

  private _tick = (): void => {
    if (!this._running) return;

    const now = performance.now();
    let rawDt = (now - this._lastTime) / 1000; // 转换为秒
    this._lastTime = now;

    // 限制最大 deltaTime
    if (rawDt > this.MAX_DT) {
      rawDt = this.MAX_DT;
    }

    // 更新时间管理器
    this._timeManager.update();
    const scaledDt = this._timeManager.getScaledDelta(rawDt);

    this._elapsed += scaledDt;

    // 调用游戏逻辑回调
    if (this._callback) {
      this._callback(rawDt, scaledDt, this._elapsed);
    }

    this._rafId = requestAnimationFrame(this._tick);
  };
}
