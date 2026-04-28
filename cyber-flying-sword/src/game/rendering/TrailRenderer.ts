import * as THREE from 'three';
import { WHIP_SEGMENTS } from '../../utils/Constants';

/**
 * TrailRenderer — 鞭尾拖尾粒子系统
 * 
 * 使用 Points + ShaderMaterial 渲染鞭子尾端的发光拖尾。
 * 预分配 Float32Array，零运行时内存分配。
 */
export class TrailRenderer {
  private _points: THREE.Points;
  private _positions: Float32Array;
  private _alphas: Float32Array;
  private _geometry: THREE.BufferGeometry;
  private _material: THREE.ShaderMaterial;

  /** 拖尾历史长度 */
  private readonly TRAIL_LENGTH = 60;
  /** 只追踪鞭子尾部 N 个节点 */
  private readonly TRACKED_NODES = 10;
  private readonly TOTAL_POINTS: number;

  /** Points 对象（添加到场景中） */
  get points(): THREE.Points {
    return this._points;
  }

  constructor() {
    this.TOTAL_POINTS = this.TRAIL_LENGTH * this.TRACKED_NODES;

    // 预分配
    this._positions = new Float32Array(this.TOTAL_POINTS * 3);
    this._alphas = new Float32Array(this.TOTAL_POINTS);

    // BufferGeometry
    this._geometry = new THREE.BufferGeometry();
    this._geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this._positions, 3).setUsage(THREE.DynamicDrawUsage)
    );
    this._geometry.setAttribute(
      'alpha',
      new THREE.BufferAttribute(this._alphas, 1).setUsage(THREE.DynamicDrawUsage)
    );

    // ShaderMaterial — 发光粒子
    this._material = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(0x00ffff) },
        pointSize: { value: 3.0 },
      },
      vertexShader: `
        attribute float alpha;
        varying float vAlpha;
        uniform float pointSize;
        void main() {
          vAlpha = alpha;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = pointSize * (150.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        varying float vAlpha;
        void main() {
          // 圆形粒子
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          float fade = 1.0 - dist * 2.0;
          gl_FragColor = vec4(color, vAlpha * fade);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this._points = new THREE.Points(this._geometry, this._material);
  }

  /** 头部写入指针 */
  private _head: number = 0;

  /**
   * 每帧更新
   * 将鞭子尾部节点的当前位置写入环形缓冲区
   */
  update(whipNodes: THREE.Vector3[]): void {
    const startNode = WHIP_SEGMENTS - this.TRACKED_NODES;

    // 写入当前帧的位置
    for (let n = 0; n < this.TRACKED_NODES; n++) {
      const nodeIdx = startNode + n;
      if (nodeIdx >= whipNodes.length) break;

      const node = whipNodes[nodeIdx];
      const idx = (this._head * this.TRACKED_NODES + n);
      const i3 = idx * 3;

      this._positions[i3] = node.x;
      this._positions[i3 + 1] = node.y;
      this._positions[i3 + 2] = node.z;
      this._alphas[idx] = 1.0;
    }

    // 衰减所有粒子的透明度
    for (let i = 0; i < this.TOTAL_POINTS; i++) {
      this._alphas[i] *= 0.92;
      if (this._alphas[i] < 0.01) {
        this._alphas[i] = 0;
      }
    }

    // 推进写入指针
    this._head = (this._head + 1) % this.TRAIL_LENGTH;

    // 标记需要更新
    const posAttr = this._geometry.getAttribute('position') as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    const alphaAttr = this._geometry.getAttribute('alpha') as THREE.BufferAttribute;
    alphaAttr.needsUpdate = true;
  }

  /** 销毁 */
  dispose(): void {
    this._geometry.dispose();
    this._material.dispose();
  }
}
