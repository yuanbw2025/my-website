

interface HUDProps {
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  rage: number;
  maxRage: number;
  gesture: string;
  wave: number;
  enemiesLeft: number;
}

/**
 * HUD — 战斗界面
 * 
 * 显示：
 * - HP 条（红色）
 * - 护盾条（蓝色）
 * - 怒气条（金色，满时闪烁）
 * - 手势状态
 * - 波次信息
 */
export function HUD({
  hp, maxHp, shield, maxShield, rage, maxRage,
  gesture, wave, enemiesLeft
}: HUDProps) {
  const rageFull = rage >= maxRage;

  return (
    <div style={styles.container}>
      {/* HP 条 */}
      <div style={styles.barRow}>
        <span style={styles.barLabel}>HP</span>
        <div style={styles.barBg}>
          <div style={{
            ...styles.barFill,
            width: `${(hp / maxHp) * 100}%`,
            background: `linear-gradient(90deg, #ff3333, #ff6644)`,
          }} />
        </div>
        <span style={styles.barValue}>{Math.ceil(hp)}</span>
      </div>

      {/* 护盾条 */}
      <div style={styles.barRow}>
        <span style={styles.barLabel}>🛡</span>
        <div style={styles.barBg}>
          <div style={{
            ...styles.barFill,
            width: `${(shield / maxShield) * 100}%`,
            background: `linear-gradient(90deg, #3366ff, #66aaff)`,
          }} />
        </div>
        <span style={styles.barValue}>{Math.ceil(shield)}</span>
      </div>

      {/* 怒气条 */}
      <div style={styles.barRow}>
        <span style={styles.barLabel}>⚡</span>
        <div style={styles.barBg}>
          <div style={{
            ...styles.barFill,
            width: `${(rage / maxRage) * 100}%`,
            background: rageFull
              ? `linear-gradient(90deg, #ffaa00, #ffdd44, #ffaa00)`
              : `linear-gradient(90deg, #ff8800, #ffaa00)`,
            boxShadow: rageFull ? '0 0 12px #ffaa00' : 'none',
            animation: rageFull ? 'ragePulse 0.6s ease-in-out infinite' : 'none',
          }} />
        </div>
        <span style={{
          ...styles.barValue,
          color: rageFull ? '#ffdd44' : '#aaa',
          fontWeight: rageFull ? 'bold' : 'normal',
        }}>
          {rageFull ? '⚔ MAX' : Math.ceil(rage)}
        </span>
      </div>

      {/* 手势状态 */}
      <div style={styles.gestureRow}>
        <span style={styles.gestureIcon}>
          {gesture === 'WHIP' && '🌊'}
          {gesture === 'FIST' && '✊'}
          {gesture === 'ULTIMATE' && '👆'}
          {gesture === 'NONE' && '🖐️'}
        </span>
        <span style={styles.gestureText}>
          {gesture === 'WHIP' && '挥鞭'}
          {gesture === 'FIST' && '格挡'}
          {gesture === 'ULTIMATE' && '一指定江山'}
          {gesture === 'NONE' && '等待手势...'}
        </span>
      </div>

      {/* 波次信息 */}
      <div style={styles.waveInfo}>
        第 {wave} 波 · 剩余 {enemiesLeft} 敌
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    top: 16,
    left: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    pointerEvents: 'none',
    zIndex: 10,
    fontFamily: "'Noto Sans SC', system-ui, sans-serif",
  },
  barRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  barLabel: {
    fontSize: 14,
    width: 20,
    textAlign: 'center' as const,
  },
  barBg: {
    width: 180,
    height: 12,
    background: 'rgba(255,255,255,0.08)',
    borderRadius: 6,
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
    transition: 'width 0.15s ease-out',
  },
  barValue: {
    fontSize: 12,
    color: '#aaa',
    minWidth: 36,
  },
  gestureRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    padding: '4px 10px',
    background: 'rgba(0,255,255,0.05)',
    borderRadius: 8,
    border: '1px solid rgba(0,255,255,0.15)',
  },
  gestureIcon: {
    fontSize: 18,
  },
  gestureText: {
    fontSize: 13,
    color: '#00ffff',
    letterSpacing: '0.05em',
  },
  waveInfo: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    letterSpacing: '0.05em',
  },
};
