import * as THREE from 'three';
import { SCALE_X, SCALE_Y, SCALE_Z, Y_OFFSET } from '../../utils/Constants';

/**
 * MediaPipe Hands 输入管理
 * 
 * 职责：
 * 1. 初始化 MediaPipe Hands（CDN 加载）
 * 2. 启动摄像头
 * 3. 将 landmark 坐标映射到游戏世界坐标
 * 4. 提供当前帧的原始 landmark 数据
 */

// MediaPipe 类型定义（CDN 加载，无 npm 类型包）
interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

interface HandsResults {
  multiHandLandmarks?: NormalizedLandmark[][];
  multiHandedness?: { label: string; score: number }[];
}

interface HandsOptions {
  maxNumHands: number;
  modelComplexity: number;
  minDetectionConfidence: number;
  minTrackingConfidence: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Hands: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Camera: any;

export type LandmarkData = NormalizedLandmark[] | null;

export class MediaPipeInput {
  private _landmarks: LandmarkData = null;
  private _videoElement: HTMLVideoElement | null = null;
  private _ready: boolean = false;

  // 复用 Vector3，避免每帧分配
  private _worldPos = new THREE.Vector3();

  /** 当前帧是否有手部数据 */
  get hasHand(): boolean {
    return this._landmarks !== null;
  }

  /** 是否初始化完成 */
  get ready(): boolean {
    return this._ready;
  }

  /** 当前帧的原始 landmark 数据（21 个关键点） */
  get landmarks(): LandmarkData {
    return this._landmarks;
  }

  /** 获取视频元素（用于摄像头预览） */
  get videoElement(): HTMLVideoElement | null {
    return this._videoElement;
  }

  /**
   * 将 MediaPipe 的归一化 landmark 映射到游戏世界坐标
   * @param landmark 归一化坐标 [0,1]
   * @returns 游戏世界坐标 Vector3（复用对象）
   */
  landmarkToWorld(landmark: NormalizedLandmark): THREE.Vector3 {
    this._worldPos.set(
      -(landmark.x - 0.5) * SCALE_X,       // X 翻转（镜像）
      -(landmark.y - 0.5) * SCALE_Y + Y_OFFSET,
      -landmark.z * SCALE_Z
    );
    return this._worldPos;
  }

  /**
   * 获取食指尖（landmark 8）的游戏世界坐标
   * 这是鞭子握柄端的位置驱动源
   */
  getFingerTipWorld(): THREE.Vector3 | null {
    if (!this._landmarks) return null;
    return this.landmarkToWorld(this._landmarks[8]);
  }

  /**
   * 初始化 MediaPipe Hands + 摄像头
   * 必须在用户交互后调用（浏览器安全策略）
   */
  async init(): Promise<void> {
    // 动态加载 MediaPipe Hands CDN 脚本
    await this._loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js');
    await this._loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');

    // 创建隐藏的 video 元素
    this._videoElement = document.createElement('video');
    this._videoElement.setAttribute('playsinline', '');
    this._videoElement.style.display = 'none';
    document.body.appendChild(this._videoElement);

    // 初始化 Hands
    const hands = new Hands({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
    } as HandsOptions);

    hands.onResults((results: HandsResults) => {
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        this._landmarks = results.multiHandLandmarks[0];
      } else {
        this._landmarks = null;
      }
    });

    // 启动摄像头
    const camera = new Camera(this._videoElement, {
      onFrame: async () => {
        await hands.send({ image: this._videoElement! });
      },
      width: 640,
      height: 480,
    });

    await camera.start();
    this._ready = true;
  }

  /** 销毁资源 */
  dispose(): void {
    if (this._videoElement) {
      // 停止摄像头流
      const stream = this._videoElement.srcObject as MediaStream;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      this._videoElement.remove();
      this._videoElement = null;
    }
    this._landmarks = null;
    this._ready = false;
  }

  /** 动态加载 script 标签 */
  private _loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // 检查是否已加载
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.crossOrigin = 'anonymous';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load: ${src}`));
      document.head.appendChild(script);
    });
  }
}
