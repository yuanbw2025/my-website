import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {
  BLOOM_THRESHOLD,
  BLOOM_STRENGTH,
  BLOOM_RADIUS,
  COLOR_BG,
} from '../../utils/Constants';

/**
 * SceneSetup — Three.js 场景初始化
 * 
 * 职责：
 * - WebGLRenderer + PerspectiveCamera
 * - 灯光系统（环境光 + 点光源）
 * - 后处理链（RenderPass → UnrealBloomPass）
 * - 窗口 resize 响应
 */
export class SceneSetup {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly composer: EffectComposer;

  // 灯光
  private _ambientLight: THREE.AmbientLight;
  private _pointLight: THREE.PointLight;

  // 闪电效果用的额外点光源
  private _lightningLight: THREE.PointLight;
  private _lightningTimer: number = 0;

  constructor(container: HTMLElement) {
    // 场景
    this.scene = new THREE.Scene();
    this.scene.background = COLOR_BG;
    this.scene.fog = new THREE.FogExp2(0x0a0a0f, 0.002);

    // 获取尺寸并保证有托底值
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 相机 — 固定在 Z=150 俯瞰游戏平面
    this.camera = new THREE.PerspectiveCamera(
      60,
      width / height,
      1,
      1000
    );
    this.camera.position.set(0, 0, 150);
    this.camera.lookAt(0, 0, 0);

    // 渲染器
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);

    // 灯光
    this._ambientLight = new THREE.AmbientLight(0x112233, 0.6);
    this.scene.add(this._ambientLight);

    this._pointLight = new THREE.PointLight(0x00ffff, 1.5, 400);
    this._pointLight.position.set(0, 50, 80);
    this.scene.add(this._pointLight);

    // 闪电光源（默认关闭）
    this._lightningLight = new THREE.PointLight(0xffffff, 0, 500);
    this._lightningLight.position.set(0, 100, 50);
    this.scene.add(this._lightningLight);

    // 后处理
    this.composer = new EffectComposer(this.renderer);

    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      BLOOM_STRENGTH,
      BLOOM_RADIUS,
      BLOOM_THRESHOLD
    );
    this.composer.addPass(bloomPass);

    // 窗口 resize
    window.addEventListener('resize', this._onResize);
    // 保存容器引用
    this._container = container;
  }

  private _container: HTMLElement;

  /**
   * 每帧渲染
   */
  render(): void {
    // 强制直接使用 renderer 而非 composer（暂时旁路以排查黑屏问题）
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * 更新相机偏移（用于屏幕震动）
   */
  applyScreenShake(offsetX: number, offsetY: number): void {
    this.camera.position.x = offsetX;
    this.camera.position.y = offsetY;
  }

  /**
   * 触发随机闪电效果
   */
  triggerLightning(): void {
    this._lightningLight.intensity = 3.0 + Math.random() * 2;
    this._lightningTimer = 0.1 + Math.random() * 0.15;
  }

  /**
   * 更新闪电衰减
   */
  updateLightning(dt: number): void {
    if (this._lightningTimer > 0) {
      this._lightningTimer -= dt;
      if (this._lightningTimer <= 0) {
        this._lightningLight.intensity = 0;
      }
    }

    // 随机触发环境闪电
    if (Math.random() < 0.002) {
      this.triggerLightning();
    }
  }

  /**
   * 销毁
   */
  dispose(): void {
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
  }

  private _onResize = (): void => {
    const w = this._container.clientWidth;
    const h = this._container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  };
}
