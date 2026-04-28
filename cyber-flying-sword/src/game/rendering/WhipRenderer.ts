import * as THREE from 'three';
import { SWORD_COUNT, COLOR_CYAN } from '../../utils/Constants';

/**
 * WhipRenderer — 飞剑鞭子渲染
 * 
 * 使用 InstancedMesh 在一个 draw call 中渲染 120 把飞剑。
 * 飞剑沿鞭子节点排列，形成剑链鞭。
 * 
 * 视觉效果：
 * - 蓝色金属材质 + 青色自发光
 * - 挥鞭速度越快，发光越强
 */
export class WhipRenderer {
  private _mesh: THREE.InstancedMesh;
  private _dummy = new THREE.Object3D();
  private _material: THREE.MeshStandardMaterial;

  /** InstancedMesh 对象（添加到场景中） */
  get mesh(): THREE.InstancedMesh {
    return this._mesh;
  }

  constructor() {
    // 飞剑几何体 — 细长的六面体
    const geometry = new THREE.BoxGeometry(0.6, 4, 0.3);

    // 飞剑材质 — 金属蓝 + 青色自发光
    this._material = new THREE.MeshStandardMaterial({
      color: 0x4488cc,
      metalness: 0.9,
      roughness: 0.2,
      emissive: COLOR_CYAN,
      emissiveIntensity: 0.5,
    });

    // 创建 InstancedMesh
    this._mesh = new THREE.InstancedMesh(geometry, this._material, SWORD_COUNT);
    this._mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // 初始化所有实例到原点
    for (let i = 0; i < SWORD_COUNT; i++) {
      this._dummy.position.set(0, 0, 0);
      this._dummy.updateMatrix();
      this._mesh.setMatrixAt(i, this._dummy.matrix);
    }
    this._mesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * 每帧更新飞剑位置
   * 
   * 将 120 把飞剑均匀分布在鞭子节点链上
   * @param whipNodes 鞭子节点位置数组
   * @param velocities 获取节点速度的函数（用于调整发光强度）
   */
  update(whipNodes: THREE.Vector3[], getVelocity: (i: number) => number): void {
    const nodeCount = whipNodes.length;

    for (let s = 0; s < SWORD_COUNT; s++) {
      // 计算这把剑对应的鞭子位置（在两个节点之间插值）
      const nodeFloat = (s / SWORD_COUNT) * (nodeCount - 1);
      const nodeA = Math.floor(nodeFloat);
      const nodeB = Math.min(nodeA + 1, nodeCount - 1);
      const t = nodeFloat - nodeA;

      // 位置插值
      const px = whipNodes[nodeA].x + (whipNodes[nodeB].x - whipNodes[nodeA].x) * t;
      const py = whipNodes[nodeA].y + (whipNodes[nodeB].y - whipNodes[nodeA].y) * t;
      const pz = whipNodes[nodeA].z + (whipNodes[nodeB].z - whipNodes[nodeA].z) * t;

      this._dummy.position.set(px, py, pz);

      // 朝向 — 指向下一个节点的方向
      if (nodeB < nodeCount - 1) {
        const dx = whipNodes[nodeB].x - whipNodes[nodeA].x;
        const dy = whipNodes[nodeB].y - whipNodes[nodeA].y;
        const angle = Math.atan2(dy, dx);
        this._dummy.rotation.set(0, 0, angle - Math.PI / 2);
      }

      // 缩放 — 尾部的飞剑稍微小一些
      const scale = 0.7 + 0.3 * (1 - s / SWORD_COUNT);
      this._dummy.scale.set(scale, scale, scale);

      // 小幅旋转让每把剑有独特角度
      this._dummy.rotation.x += (s * 0.37) % 0.5;
      this._dummy.rotation.y += (s * 0.73) % 0.5;

      this._dummy.updateMatrix();
      this._mesh.setMatrixAt(s, this._dummy.matrix);
    }

    this._mesh.instanceMatrix.needsUpdate = true;

    // 根据平均速度调整发光强度
    let avgVel = 0;
    for (let i = 0; i < nodeCount; i++) {
      avgVel += getVelocity(i);
    }
    avgVel /= nodeCount;
    this._material.emissiveIntensity = 0.3 + Math.min(avgVel * 0.05, 2.0);
  }

  /**
   * 护盾模式渲染 — 飞剑围绕角色旋转
   */
  updateShieldMode(centerX: number, centerY: number, elapsed: number): void {
    const radius = 18;

    for (let s = 0; s < SWORD_COUNT; s++) {
      const angle = (s / SWORD_COUNT) * Math.PI * 2 + elapsed * 3;
      const layerOffset = (s % 3) * 5;

      this._dummy.position.set(
        centerX + Math.cos(angle) * (radius + layerOffset),
        centerY + Math.sin(angle) * (radius + layerOffset),
        Math.sin(angle * 2 + elapsed) * 5
      );

      // 飞剑朝向切线方向
      this._dummy.rotation.set(0, 0, angle + Math.PI / 2);
      this._dummy.scale.set(0.8, 0.8, 0.8);

      this._dummy.updateMatrix();
      this._mesh.setMatrixAt(s, this._dummy.matrix);
    }

    this._mesh.instanceMatrix.needsUpdate = true;
    this._material.emissiveIntensity = 1.2; // 防御时发光更亮
  }

  /** 销毁 */
  dispose(): void {
    this._mesh.geometry.dispose();
    this._material.dispose();
  }
}
