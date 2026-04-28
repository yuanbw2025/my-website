import { useState, useRef, useEffect, useCallback } from 'react';
import { Game, GameStateSnapshot, GameScene } from './game/Game';
import { HUD } from './ui/HUD';
import { MainMenu } from './ui/MainMenu';
import { CameraPreview } from './ui/CameraPreview';

/**
 * App — 游戏根组件
 * 
 * 管理游戏生命周期：
 * - MENU → 显示主菜单
 * - PLAYING → 显示 HUD + 游戏画面
 * - GAME_OVER → 显示结算画面
 */
export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);

  const [scene, setScene] = useState<GameScene>('MENU');
  const [loading, setLoading] = useState(false);
  const [gameState, setGameState] = useState<GameStateSnapshot>({
    scene: 'MENU',
    hp: 100, maxHp: 100,
    shield: 50, maxShield: 50,
    rage: 0, maxRage: 100,
    gesture: 'NONE',
    wave: 0, enemiesLeft: 0,
  });
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);

  // 全局错误捕获日志
  const [errorLogs, setErrorLogs] = useState<string[]>([]);

  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      setErrorLogs(prev => [...prev, `[Error] ${e.message} at ${e.filename}:${e.lineno}`].slice(-10));
    };
    const handleRejection = (e: PromiseRejectionEvent) => {
      setErrorLogs(prev => [...prev, `[Promise] ${e.reason}`].slice(-10));
    };
    
    // 劫持 console.error 方便直接看到 ThreeJS 内部报错
    const originalError = console.error;
    console.error = (...args) => {
      setErrorLogs(prev => [...prev, `[Console.error] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`].slice(-10));
      originalError.apply(console, args);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
      console.error = originalError;
    };
  }, []);

  // 初始化游戏实例（仅一次）
  useEffect(() => {
    if (!containerRef.current) return;

    const game = new Game(containerRef.current);
    gameRef.current = game;

    game.onStateChange((state) => {
      setGameState(state);
      setScene(state.scene);
    });

    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, []);

  // 开始游戏
  const handleStart = useCallback(async () => {
    if (!gameRef.current || loading) return;

    setLoading(true);
    try {
      await gameRef.current.start();
      // 获取视频元素用于预览
      setVideoElement(gameRef.current.mediaPipe.videoElement);
    } catch (err) {
      console.error('游戏启动失败:', err);
      alert('启动失败，请确保摄像头权限已授予。');
    } finally {
      setLoading(false);
    }
  }, [loading]);

  // ESC 暂停/恢复
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && gameRef.current) {
        if (scene === 'PLAYING') {
          gameRef.current.pause();
        } else if (scene === 'PAUSED') {
          gameRef.current.resume();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [scene]);

  return (
    <div id="game-root" style={styles.root}>
      {/* Three.js 渲染容器 */}
      <div ref={containerRef} style={styles.canvas} />

      {/* 主菜单 */}
      {scene === 'MENU' && (
        <MainMenu onStart={handleStart} loading={loading} />
      )}

      {/* 游戏中 HUD */}
      {scene === 'PLAYING' && (
        <>
          <HUD
            hp={gameState.hp}
            maxHp={gameState.maxHp}
            shield={gameState.shield}
            maxShield={gameState.maxShield}
            rage={gameState.rage}
            maxRage={gameState.maxRage}
            gesture={gameState.gesture}
            wave={gameState.wave}
            enemiesLeft={gameState.enemiesLeft}
          />
          <CameraPreview videoElement={videoElement} visible={true} />
        </>
      )}

      {/* 暂停 */}
      {scene === 'PAUSED' && (
        <div style={styles.pauseOverlay}>
          <h2 style={styles.pauseText}>⏸ 已暂停</h2>
          <p style={styles.pauseHint}>按 ESC 继续</p>
        </div>
      )}

      {/* 死亡 */}
      {scene === 'GAME_OVER' && (
        <div style={styles.gameOverOverlay}>
          <h2 style={styles.gameOverText}>💀 修炼失败</h2>
          <p style={styles.gameOverInfo}>
            坚持到第 {gameState.wave} 波
          </p>
          <button
            style={styles.retryButton}
            onClick={() => window.location.reload()}
          >
            再来一次
          </button>
        </div>
      )}

      {/* 错误日志叠加层 (用于调试黑屏问题) */}
      {errorLogs.length > 0 && (
        <div style={{
          position: 'absolute', bottom: 20, right: 20, maxWidth: '40%', maxHeight: '40%',
          overflowY: 'auto', background: 'rgba(255,0,0,0.8)', color: 'white',
          padding: 16, borderRadius: 8, zIndex: 9999, fontSize: '12px',
          fontFamily: 'monospace', pointerEvents: 'auto',
          boxShadow: '0 0 20px rgba(255,0,0,0.5)'
        }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', borderBottom: '1px solid #fff', paddingBottom: 5 }}>⚠️ 全局致命错误拦截</h3>
          {errorLogs.map((log, i) => (
            <div key={i} style={{ marginBottom: 6, wordBreak: 'break-all' }}>= {log}</div>
          ))}
          <button 
            onClick={() => setErrorLogs([])}
            style={{ marginTop: 10, padding: '4px 8px', background: '#fff', color: 'red', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
            清除日志
          </button>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: 'relative',
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    background: '#000',
    color: '#fff',
    fontFamily: "'Noto Sans SC', system-ui, sans-serif",
  },
  canvas: {
    position: 'absolute',
    inset: 0,
  },
  pauseOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.7)',
    zIndex: 50,
  },
  pauseText: {
    fontSize: '2.5rem',
    color: '#00ffff',
    letterSpacing: '0.3em',
    margin: 0,
  },
  pauseHint: {
    fontSize: '1rem',
    color: 'rgba(255,255,255,0.4)',
    marginTop: 16,
  },
  gameOverOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(10,0,0,0.85)',
    zIndex: 50,
  },
  gameOverText: {
    fontSize: '3rem',
    color: '#ff3333',
    letterSpacing: '0.2em',
    margin: 0,
    textShadow: '0 0 30px rgba(255,50,50,0.5)',
  },
  gameOverInfo: {
    fontSize: '1.2rem',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 16,
  },
  retryButton: {
    marginTop: 24,
    padding: '12px 40px',
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#0a0a0f',
    background: 'linear-gradient(135deg, #ff5555, #ff3333)',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    letterSpacing: '0.1em',
  },
};
