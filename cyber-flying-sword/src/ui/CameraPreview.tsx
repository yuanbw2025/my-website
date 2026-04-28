import { useEffect, useRef } from 'react';

interface CameraPreviewProps {
  videoElement: HTMLVideoElement | null;
  visible: boolean;
}

/**
 * CameraPreview — 右下角摄像头预览小窗
 */
export function CameraPreview({ videoElement, visible }: CameraPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!visible || !videoElement || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      if (!visible) return;
      ctx.save();
      // 镜像翻转
      ctx.scale(-1, 1);
      ctx.drawImage(videoElement, -canvas.width, 0, canvas.width, canvas.height);
      ctx.restore();
      rafRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [videoElement, visible]);

  if (!visible) return null;

  return (
    <div style={styles.container}>
      <canvas
        ref={canvasRef}
        width={160}
        height={120}
        style={styles.canvas}
      />
      <div style={styles.label}>📷 摄像头</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    zIndex: 10,
    borderRadius: 8,
    overflow: 'hidden',
    border: '1px solid rgba(0,255,255,0.2)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
  },
  canvas: {
    display: 'block',
    background: '#000',
  },
  label: {
    position: 'absolute',
    bottom: 4,
    left: 6,
    fontSize: 10,
    color: 'rgba(0,255,255,0.5)',
    pointerEvents: 'none',
  },
};
