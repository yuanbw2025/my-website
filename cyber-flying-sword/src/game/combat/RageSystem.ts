import {
  MAX_RAGE,
  RAGE_ON_HIT,
  RAGE_ON_DAMAGED,
  RAGE_ON_PERFECT_BLOCK,
} from '../../utils/Constants';
import { clamp } from '../../utils/MathUtils';

/**
 * RageSystem — 怒气系统
 * 
 * 怒气获取方式：
 * - 鞭击命中敌人: +2
 * - 被敌人攻击: +5
 * - 精防: +25（核心获取手段）
 * 
 * 怒气不会自然衰减
 * 释放大招时消耗全部怒气
 */
export class RageSystem {
  private _rage: number = 0;

  /** 当前怒气值 */
  get rage(): number {
    return this._rage;
  }

  /** 怒气是否满 */
  get isFull(): boolean {
    return this._rage >= MAX_RAGE;
  }

  /** 怒气百分比 [0, 1] */
  get percent(): number {
    return this._rage / MAX_RAGE;
  }

  /** 鞭击命中敌人时调用 */
  onWhipHit(): void {
    this._rage = clamp(this._rage + RAGE_ON_HIT, 0, MAX_RAGE);
  }

  /** 被敌人攻击时调用 */
  onDamaged(): void {
    this._rage = clamp(this._rage + RAGE_ON_DAMAGED, 0, MAX_RAGE);
  }

  /** 精防成功时调用 */
  onPerfectBlock(): void {
    this._rage = clamp(this._rage + RAGE_ON_PERFECT_BLOCK, 0, MAX_RAGE);
  }

  /** 增加指定量怒气 */
  add(amount: number): void {
    this._rage = clamp(this._rage + amount, 0, MAX_RAGE);
  }

  /**
   * 尝试释放大招
   * @returns true 如果怒气已满并成功消耗
   */
  tryConsumeForUltimate(): boolean {
    if (this._rage >= MAX_RAGE) {
      this._rage = 0;
      return true;
    }
    return false;
  }

  /** 重置 */
  reset(): void {
    this._rage = 0;
  }
}
