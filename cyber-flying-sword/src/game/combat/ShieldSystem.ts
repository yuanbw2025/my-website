import { GestureType } from '../input/GestureDetector';
import {
  PERFECT_BLOCK_WINDOW,
  RAGE_ON_PERFECT_BLOCK,
  RAGE_ON_DAMAGED,
} from '../../utils/Constants';

/**
 * 格挡结果
 */
export interface BlockResult {
  /** 最终造成的伤害 */
  damageDealt: number;
  /** 消耗的护盾值 */
  shieldCost: number;
  /** 获得的怒气 */
  rageGain: number;
  /** 是否为精防 */
  isPerfectBlock: boolean;
}

/**
 * ShieldSystem — 护盾 / 精防系统
 * 
 * 精防机制：在敌人攻击命中前 100ms 内握拳
 * → 不消耗护盾值 + 获得大量怒气（25点）
 * 
 * 普通格挡：消耗护盾吸收伤害
 * 护盾耗尽后继续格挡 → 伤害穿透到血量（减伤50%）
 */
export class ShieldSystem {
  /** 上次进入握拳状态的时间戳 */
  private _fistActivateTime: number = 0;

  /**
   * 当手势发生变化时调用
   */
  onGestureChange(newGesture: GestureType): void {
    if (newGesture === 'FIST') {
      this._fistActivateTime = performance.now();
    }
  }

  /**
   * 当玩家受到攻击时调用
   * @param damage 来袭伤害
   * @param currentShield 当前护盾值
   * @param currentGesture 当前手势
   * @returns 格挡结果
   */
  processIncomingDamage(
    damage: number,
    currentShield: number,
    currentGesture: GestureType
  ): BlockResult {
    const now = performance.now();

    // ========== 精防判定 ==========
    if (currentGesture === 'FIST') {
      const timeSinceFist = now - this._fistActivateTime;

      if (timeSinceFist <= PERFECT_BLOCK_WINDOW) {
        // 精防成功！
        return {
          damageDealt: 0,
          shieldCost: 0,
          rageGain: RAGE_ON_PERFECT_BLOCK,
          isPerfectBlock: true,
        };
      }

      // ========== 普通格挡 ==========
      const shieldAbsorb = Math.min(currentShield, damage);
      const remainingDamage = damage - shieldAbsorb;
      // 穿透伤害减半
      const penetrationDamage = remainingDamage * 0.5;

      return {
        damageDealt: penetrationDamage,
        shieldCost: shieldAbsorb,
        rageGain: RAGE_ON_DAMAGED,
        isPerfectBlock: false,
      };
    }

    // ========== 无防御 ==========
    return {
      damageDealt: damage,
      shieldCost: 0,
      rageGain: RAGE_ON_DAMAGED,
      isPerfectBlock: false,
    };
  }

  /** 重置 */
  reset(): void {
    this._fistActivateTime = 0;
  }
}
