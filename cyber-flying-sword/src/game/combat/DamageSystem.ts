import {
  D_BASE,
  V_MIN,
  AIRFLOW_D_BASE,
  AIRFLOW_SPEED,
  WHIP_SEGMENTS,
} from '../../utils/Constants';

/**
 * DamageSystem — 伤害计算
 * 
 * 鞭击伤害公式：D_base × max(0, V_segment - V_MIN) × (i / N)
 * - 尾端伤害最高（位置权重 = 1.0）
 * - 根部伤害最低（位置权重 → 0）
 * - 低于最小速度不造成伤害
 * 
 * 气流罩撞击伤害：AIRFLOW_D_BASE × (playerSpeed - AIRFLOW_SPEED)
 */
export class DamageSystem {
  /**
   * 计算鞭击伤害
   * @param segmentIndex 命中的鞭子节点索引
   * @param segmentVelocity 该节点的速度
   * @returns 伤害值
   */
  calculateWhipDamage(segmentIndex: number, segmentVelocity: number): number {
    const positionWeight = segmentIndex / WHIP_SEGMENTS;
    const speedDamage = D_BASE * Math.max(0, segmentVelocity - V_MIN);
    return speedDamage * positionWeight;
  }

  /**
   * 计算气流罩撞击伤害
   * @param playerSpeed 角色当前速度
   * @returns 伤害值
   */
  calculateAirflowDamage(playerSpeed: number): number {
    if (playerSpeed <= AIRFLOW_SPEED) return 0;
    return AIRFLOW_D_BASE * (playerSpeed - AIRFLOW_SPEED);
  }
}
