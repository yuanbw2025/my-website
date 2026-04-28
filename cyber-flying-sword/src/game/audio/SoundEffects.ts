import { AudioManager } from './AudioManager';

/**
 * SoundEffects — 程序化音效合成
 * 
 * 通过 OscillatorNode / BufferSource 实时合成所有音效，
 * 不依赖任何音频文件。
 */
export class SoundEffects {
  private _audio: AudioManager;

  constructor(audioManager: AudioManager) {
    this._audio = audioManager;
  }

  /** 鞭击命中音：锯齿波 200→800Hz, 快速频率扫描 */
  whipHit(): void {
    this._audio.play((ctx, dest) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.05);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.connect(gain).connect(dest);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    });
  }

  /** 普通格挡音：方波 100Hz + 低频衰减 */
  block(): void {
    this._audio.play((ctx, dest) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(100, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain).connect(dest);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    });
  }

  /** 精防音：清脆金属音 + 回响（正弦波 600Hz + 混响） */
  perfectBlock(): void {
    this._audio.play((ctx, dest) => {
      // 主音（高频正弦波）
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.02);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      // 简单回响（延迟节点）
      const delay = ctx.createDelay();
      delay.delayTime.value = 0.08;
      const delayGain = ctx.createGain();
      delayGain.gain.value = 0.3;

      osc.connect(gain).connect(dest);
      gain.connect(delay).connect(delayGain).connect(dest);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    });
  }

  /** 雷电音：白噪声 + 低通 800→50Hz, 2s */
  thunder(): void {
    this._audio.play((ctx, dest) => {
      // 白噪声
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 1.5);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 2);

      source.connect(filter).connect(gain).connect(dest);
      source.start(ctx.currentTime);
      source.stop(ctx.currentTime + 2);
    });
  }

  /** 大招触发音：多层复合音效 */
  ultimate(): void {
    this._audio.play((ctx, dest) => {
      // 第 1 层：上升剑鸣
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(200, ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.5);
      gain1.gain.setValueAtTime(0.3, ctx.currentTime);
      gain1.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.3);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.0);
      osc1.connect(gain1).connect(dest);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 1.0);

      // 第 2 层：低频冲击
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(60, ctx.currentTime + 0.5);
      gain2.gain.setValueAtTime(0, ctx.currentTime);
      gain2.gain.setValueAtTime(0.4, ctx.currentTime + 0.5);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);
      osc2.connect(gain2).connect(dest);
      osc2.start(ctx.currentTime + 0.5);
      osc2.stop(ctx.currentTime + 1.5);
    });
  }

  /** 敌人受伤音 */
  enemyHit(): void {
    this._audio.play((ctx, dest) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain).connect(dest);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    });
  }

  /** 玩家受伤音 */
  playerHit(): void {
    this._audio.play((ctx, dest) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain).connect(dest);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    });
  }
}
