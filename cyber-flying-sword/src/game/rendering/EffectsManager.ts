import * as THREE from 'three';

/**
 * EffectsManager — 特效管理
 * 
 * 管理临时视觉效果：
 * - 命中火花（粒子爆发）
 * - 精防闪光（全屏闪白）
 * - 气流罩（半透明球 + 风速线）
 */
export class EffectsManager {
  /** 场景引用（供后续特效扩展使用） */
  readonly sceneRef: THREE.Scene;

  // 命中火花粒子池
  private _sparkParticles: THREE.Points;
  private _sparkPositions: Float32Array;
  private _sparkVelocities: Float32Array;
  private _sparkAlphas: Float32Array;
  private _sparkGeometry: THREE.BufferGeometry;
  private readonly SPARK_COUNT = 50;
  private _activeSparks: number = 0;

  // 气流罩
  private _airflowMesh: THREE.Mesh;
  private _airflowMaterial: THREE.MeshBasicMaterial;

  // 精防闪光（全屏叠加层，用 CSS 实现更简单）
  private _flashOverlay: HTMLDivElement | null = null;

  constructor(scene: THREE.Scene) {
    this.sceneRef = scene;

    // === 命中火花 ===
    this._sparkPositions = new Float32Array(this.SPARK_COUNT * 3);
    this._sparkVelocities = new Float32Array(this.SPARK_COUNT * 3);
    this._sparkAlphas = new Float32Array(this.SPARK_COUNT);

    this._sparkGeometry = new THREE.BufferGeometry();
    this._sparkGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this._sparkPositions, 3).setUsage(THREE.DynamicDrawUsage)
    );
    this._sparkGeometry.setAttribute(
      'alpha',
      new THREE.BufferAttribute(this._sparkAlphas, 1).setUsage(THREE.DynamicDrawUsage)
    );

    const sparkMat = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color(0xffaa33) } },
      vertexShader: `
        attribute float alpha;
        varying float vAlpha;
        void main() {
          vAlpha = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = 4.0 * (150.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          gl_FragColor = vec4(color, vAlpha * (1.0 - d * 2.0));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this._sparkParticles = new THREE.Points(this._sparkGeometry, sparkMat);
    scene.add(this._sparkParticles);

    // === 气流罩 ===
    this._airflowMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    });
    const airflowGeo = new THREE.SphereGeometry(12, 16, 16);
    this._airflowMesh = new THREE.Mesh(airflowGeo, this._airflowMaterial);
    this._airflowMesh.visible = false;
    scene.add(this._airflowMesh);
  }

  /**
   * 在指定位置触发命中火花
   */
  spawnSparks(x: number, y: number, z: number = 0, count: number = 12): void {
    for (let i = 0; i < count && this._activeSparks < this.SPARK_COUNT; i++) {
      const idx = this._activeSparks;
      const i3 = idx * 3;

      this._sparkPositions[i3] = x;
      this._sparkPositions[i3 + 1] = y;
      this._sparkPositions[i3 + 2] = z;

      // 随机方向速度
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 60;
      this._sparkVelocities[i3] = Math.cos(angle) * speed;
      this._sparkVelocities[i3 + 1] = Math.sin(angle) * speed;
      this._sparkVelocities[i3 + 2] = (Math.random() - 0.5) * 20;

      this._sparkAlphas[idx] = 1.0;
      this._activeSparks++;
    }
  }

  /**
   * 触发精防闪光（CSS 实现）
   */
  triggerPerfectBlockFlash(): void {
    if (!this._flashOverlay) {
      this._flashOverlay = document.createElement('div');
      this._flashOverlay.style.cssText = `
        position: fixed; inset: 0; z-index: 9999;
        background: white; pointer-events: none;
        transition: opacity 0.08s ease-out;
      `;
      document.body.appendChild(this._flashOverlay);
    }

    this._flashOverlay.style.opacity = '0.6';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (this._flashOverlay) {
          this._flashOverlay.style.opacity = '0';
        }
      });
    });
  }

  /**
   * 更新气流罩显示
   */
  updateAirflow(visible: boolean, x: number, y: number): void {
    this._airflowMesh.visible = visible;
    if (visible) {
      this._airflowMesh.position.set(x, y, 0);
      this._airflowMesh.rotation.z += 0.05;
      // 呼吸缩放
      const scale = 1.0 + Math.sin(Date.now() * 0.01) * 0.1;
      this._airflowMesh.scale.set(scale, scale, scale);
    }
  }

  /**
   * 每帧更新所有特效
   */
  update(dt: number): void {
    // 更新火花粒子
    let writeIdx = 0;
    for (let i = 0; i < this._activeSparks; i++) {
      const i3 = i * 3;

      // 更新位置
      this._sparkPositions[i3] += this._sparkVelocities[i3] * dt;
      this._sparkPositions[i3 + 1] += this._sparkVelocities[i3 + 1] * dt;
      this._sparkPositions[i3 + 2] += this._sparkVelocities[i3 + 2] * dt;

      // 衰减
      this._sparkAlphas[i] *= 0.92;

      // 存活判定
      if (this._sparkAlphas[i] > 0.01) {
        if (writeIdx !== i) {
          // 紧凑数组
          const w3 = writeIdx * 3;
          this._sparkPositions[w3] = this._sparkPositions[i3];
          this._sparkPositions[w3 + 1] = this._sparkPositions[i3 + 1];
          this._sparkPositions[w3 + 2] = this._sparkPositions[i3 + 2];
          this._sparkVelocities[w3] = this._sparkVelocities[i3];
          this._sparkVelocities[w3 + 1] = this._sparkVelocities[i3 + 1];
          this._sparkVelocities[w3 + 2] = this._sparkVelocities[i3 + 2];
          this._sparkAlphas[writeIdx] = this._sparkAlphas[i];
        }
        writeIdx++;
      }
    }
    this._activeSparks = writeIdx;

    // 更新 GPU 缓冲区
    const posAttr = this._sparkGeometry.getAttribute('position') as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    const alphaAttr = this._sparkGeometry.getAttribute('alpha') as THREE.BufferAttribute;
    alphaAttr.needsUpdate = true;
    this._sparkGeometry.setDrawRange(0, this._activeSparks);
  }

  /** 销毁 */
  dispose(): void {
    this._sparkGeometry.dispose();
    this._airflowMesh.geometry.dispose();
    this._airflowMaterial.dispose();
    if (this._flashOverlay) {
      this._flashOverlay.remove();
    }
  }
}
