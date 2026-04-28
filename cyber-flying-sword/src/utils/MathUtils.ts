import * as THREE from 'three';

// ============================================================
// 临时 Vector3 池 — 零分配数学运算
// 在热路径中使用这些临时变量，避免每帧 new Vector3()
// ============================================================
const _tv0 = new THREE.Vector3();
const _tv1 = new THREE.Vector3();
const _tv2 = new THREE.Vector3();

/** 获取一个临时 Vector3（通道 0）。每帧只能安全使用一次。 */
export function tmpVec0(): THREE.Vector3 {
  return _tv0.set(0, 0, 0);
}

/** 获取一个临时 Vector3（通道 1）。 */
export function tmpVec1(): THREE.Vector3 {
  return _tv1.set(0, 0, 0);
}

/** 获取一个临时 Vector3（通道 2）。 */
export function tmpVec2(): THREE.Vector3 {
  return _tv2.set(0, 0, 0);
}

// ============================================================
// 基础数学
// ============================================================

/** 线性插值 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 限制范围 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** 两个 Vector3 之间的 2D 距离（忽略 Z） */
export function dist2D(a: THREE.Vector3, b: THREE.Vector3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** 两个 Vector3 之间的 3D 距离 */
export function dist3D(a: THREE.Vector3, b: THREE.Vector3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** 二维向量长度 */
export function length2D(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

/** 角度转弧度 */
export function degToRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/** 弧度转角度 */
export function radToDeg(rad: number): number {
  return rad * (180 / Math.PI);
}

/** 随机范围 [min, max) */
export function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/** 随机整数 [min, max] */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ============================================================
// 碰撞检测辅助
// ============================================================

/** 点到线段的最近距离（2D） */
export function pointToSegmentDist2D(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLenSq = abx * abx + aby * aby;

  if (abLenSq === 0) {
    // 线段退化为点
    return Math.sqrt(apx * apx + apy * apy);
  }

  let t = (apx * abx + apy * aby) / abLenSq;
  t = clamp(t, 0, 1);

  const closestX = ax + t * abx;
  const closestY = ay + t * aby;
  const dx = px - closestX;
  const dy = py - closestY;
  return Math.sqrt(dx * dx + dy * dy);
}

/** AABB 碰撞检测 */
export function aabbOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number
): boolean {
  return (
    ax < bx + bw &&
    ax + aw > bx &&
    ay < by + bh &&
    ay + ah > by
  );
}

/** 圆 vs 圆碰撞 */
export function circleOverlap(
  ax: number, ay: number, ar: number,
  bx: number, by: number, br: number
): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const distSq = dx * dx + dy * dy;
  const radSum = ar + br;
  return distSq <= radSum * radSum;
}

/** 线段 vs 圆碰撞 */
export function segmentCircleCollide(
  ax: number, ay: number,
  bx: number, by: number,
  cx: number, cy: number, cr: number
): boolean {
  return pointToSegmentDist2D(cx, cy, ax, ay, bx, by) <= cr;
}
