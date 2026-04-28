/**
 * AudioManager — Web Audio API 上下文管理
 * 
 * 必须在用户交互后初始化（浏览器安全策略）。
 * 所有音效通过 OscillatorNode 实时合成，零音频文件。
 */
export class AudioManager {
  private _ctx: AudioContext | null = null;
  private _masterGain: GainNode | null = null;
  private _volume: number = 0.5;

  /** 是否已初始化 */
  get ready(): boolean {
    return this._ctx !== null && this._ctx.state === 'running';
  }

  /** AudioContext */
  get ctx(): AudioContext | null {
    return this._ctx;
  }

  /**
   * 初始化（必须在用户交互事件中调用）
   */
  async init(): Promise<void> {
    if (this._ctx) return;

    this._ctx = new AudioContext();
    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = this._volume;
    this._masterGain.connect(this._ctx.destination);

    // 确保 AudioContext 处于运行状态
    if (this._ctx.state === 'suspended') {
      await this._ctx.resume();
    }
  }

  /** 设置主音量 [0, 1] */
  setVolume(v: number): void {
    this._volume = Math.max(0, Math.min(1, v));
    if (this._masterGain) {
      this._masterGain.gain.value = this._volume;
    }
  }

  /** 获取主音量 */
  get volume(): number {
    return this._volume;
  }

  /**
   * 播放一段临时合成的音效
   * @param setup 配置 OscillatorNode 和 GainNode 的函数
   */
  play(setup: (ctx: AudioContext, dest: AudioNode) => void): void {
    if (!this._ctx || !this._masterGain) return;
    try {
      setup(this._ctx, this._masterGain);
    } catch {
      // 静默失败，不影响游戏逻辑
    }
  }

  /** 销毁 */
  dispose(): void {
    if (this._ctx) {
      this._ctx.close();
      this._ctx = null;
      this._masterGain = null;
    }
  }
}
