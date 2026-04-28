import * as THREE from 'three';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../../utils/Constants';

/**
 * EnvironmentRenderer — 环境渲染
 * 
 * 渲染游戏背景环境：
 * - 深色地面网格线
 * - 远景粒子（星空/灵气微粒）
 * - 场景边界可视化（微弱的边框线）
 */
export class EnvironmentRenderer {
  private _groundGrid: THREE.LineSegments;
  private _starfield: THREE.Points;
  private _boundary: THREE.LineLoop;

  constructor(scene: THREE.Scene) {
    // === 地面网格线 ===
    const gridHelper = new THREE.GridHelper(600, 30, 0x111122, 0x0a0a15);
    gridHelper.rotation.x = Math.PI / 2; // 旋转到 XY 平面
    gridHelper.position.z = -10;
    scene.add(gridHelper);
    this._groundGrid = gridHelper as unknown as THREE.LineSegments;

    // === 远景星空/灵气粒子 ===
    const starCount = 200;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      starPositions[i3] = (Math.random() - 0.5) * 800;
      starPositions[i3 + 1] = (Math.random() - 0.5) * 500;
      starPositions[i3 + 2] = -100 - Math.random() * 400;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));

    const starMat = new THREE.PointsMaterial({
      color: 0x334455,
      size: 1.5,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });

    this._starfield = new THREE.Points(starGeo, starMat);
    scene.add(this._starfield);

    // === 场景边界线 ===
    const boundaryGeo = new THREE.BufferGeometry();
    const w = WORLD_WIDTH;
    const h = WORLD_HEIGHT;
    const boundaryVerts = new Float32Array([
      -w, -h, 0,
       w, -h, 0,
       w,  h, 0,
      -w,  h, 0,
    ]);
    boundaryGeo.setAttribute('position', new THREE.BufferAttribute(boundaryVerts, 3));

    const boundaryMat = new THREE.LineBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.08,
    });

    this._boundary = new THREE.LineLoop(boundaryGeo, boundaryMat);
    scene.add(this._boundary);
  }

  /**
   * 每帧更新（微弱环境动画）
   */
  update(dt: number): void {
    // 星空缓慢漂移
    this._starfield.rotation.z += dt * 0.005;
  }

  /** 销毁 */
  dispose(): void {
    this._groundGrid.geometry.dispose();
    this._starfield.geometry.dispose();
    this._boundary.geometry.dispose();
  }
}
