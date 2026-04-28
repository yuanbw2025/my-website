interface MainMenuProps {
  onStart: () => void;
  loading: boolean;
}

/**
 * MainMenu — 赛博风主菜单
 */
export function MainMenu({ onStart, loading }: MainMenuProps) {
  return (
    <div style={styles.overlay}>
      <div style={styles.content}>
        {/* 标题 */}
        <h1 style={styles.title}>
          <span style={styles.titleCn}>赛博飞剑</span>
          <span style={styles.titleEn}>CYBER FLYING SWORD</span>
        </h1>

        {/* 副标题 */}
        <p style={styles.subtitle}>
          手势操控飞剑鞭子的 2.5D 横版动作游戏
        </p>

        {/* 操作说明 */}
        <div style={styles.instructions}>
          <div style={styles.instructionItem}>
            <span style={styles.gestureIcon}>🖐️</span>
            <span>挥鞭攻击 · 移动</span>
          </div>
          <div style={styles.instructionItem}>
            <span style={styles.gestureIcon}>✊</span>
            <span>握拳格挡 · 精防</span>
          </div>
          <div style={styles.instructionItem}>
            <span style={styles.gestureIcon}>👆</span>
            <span>一指定江山 · 大招</span>
          </div>
        </div>

        {/* 提示 */}
        <p style={styles.hint}>
          需要摄像头权限 · 右手操控 · 手肘撑桌
        </p>

        {/* 开始按钮 */}
        <button
          id="start-game-btn"
          style={{
            ...styles.startButton,
            opacity: loading ? 0.5 : 1,
            cursor: loading ? 'wait' : 'pointer',
          }}
          onClick={onStart}
          disabled={loading}
        >
          {loading ? '正在加载 MediaPipe...' : '⚔️ 开始修炼'}
        </button>

        {/* 版本信息 */}
        <p style={styles.version}>v0.1.0 MVP · 2026</p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'radial-gradient(ellipse at center, #0a0a1f 0%, #000000 100%)',
    zIndex: 100,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 20,
    padding: 40,
  },
  title: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    margin: 0,
  },
  titleCn: {
    fontSize: '3.5rem',
    fontWeight: 900,
    color: '#00ffff',
    letterSpacing: '0.3em',
    textShadow: '0 0 30px rgba(0,255,255,0.5), 0 0 60px rgba(0,255,255,0.2)',
  },
  titleEn: {
    fontSize: '1rem',
    fontWeight: 300,
    color: 'rgba(0,255,255,0.4)',
    letterSpacing: '0.5em',
  },
  subtitle: {
    fontSize: '1.1rem',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: '0.1em',
    margin: 0,
  },
  instructions: {
    display: 'flex',
    gap: 24,
    marginTop: 16,
    padding: '16px 24px',
    background: 'rgba(0,255,255,0.03)',
    borderRadius: 12,
    border: '1px solid rgba(0,255,255,0.1)',
  },
  instructionItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  gestureIcon: {
    fontSize: 28,
  },
  hint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.25)',
    margin: 0,
  },
  startButton: {
    marginTop: 16,
    padding: '14px 48px',
    fontSize: '1.2rem',
    fontWeight: 700,
    color: '#0a0a0f',
    background: 'linear-gradient(135deg, #00ffff, #00cccc)',
    border: 'none',
    borderRadius: 8,
    letterSpacing: '0.15em',
    transition: 'all 0.2s ease',
    boxShadow: '0 0 20px rgba(0,255,255,0.3)',
  },
  version: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.15)',
    margin: 0,
    marginTop: 8,
  },
};
