import * as THREE from 'three';

// ============================================================
// 鞭子物理参数
// ============================================================
export const WHIP_SEGMENTS = 40;           // 鞭子节点数
export const HEAD_LERP = 0.8;              // 握柄端响应系数
export const TAIL_LERP = 0.2;              // 鞭尾端响应系数
export const UPWARD_DRIFT = 2.0;           // 上漂力（仙气效果）
export const PLAYER_ATTACH_NODE = 8;       // 角色挂载节点索引
export const SWORD_COUNT = 120;            // 飞剑数量（InstancedMesh）

// ============================================================
// 角色物理参数
// ============================================================
export const DETACH_THRESHOLD = 15.0;      // 弹射脱离加速度阈值
export const GRAVITY = -20.0;              // 重力加速度 (向下)
export const AIR_DRAG = 0.98;              // 空气阻力系数 (每帧速度乘以此值)
export const BOUNCE_FACTOR = 0.75;         // 反弹保留速度比例
export const REATTACH_SPEED = 3.0;         // 磁吸回鞭速度阈值
export const AIRFLOW_SPEED = 12.0;         // 气流罩激活速度阈值

// ============================================================
// 战斗数值参数
// ============================================================
export const D_BASE = 2.0;                 // 鞭击基础伤害系数
export const V_MIN = 5.0;                  // 低于此速度不造成伤害
export const AIRFLOW_D_BASE = 5.0;         // 气流罩撞击伤害系数

export const PERFECT_BLOCK_WINDOW = 100;   // 精防时间窗口 (ms)
export const ULTIMATE_HOLD_TIME = 300;     // 大招手势保持时间 (ms)

// 玩家资源最大值
export const MAX_HP = 100;
export const MAX_SHIELD = 50;
export const MAX_RAGE = 100;

// 护盾自然回复
export const SHIELD_REGEN_RATE = 3.0;      // 每秒回复量

// 怒气获取
export const RAGE_ON_HIT = 2;             // 鞭击命中敌人
export const RAGE_ON_DAMAGED = 5;          // 被敌人攻击
export const RAGE_ON_PERFECT_BLOCK = 25;   // 精防

// ============================================================
// 输入参数
// ============================================================
export const EMA_ALPHA = 0.35;             // EMA 滤波器平滑系数

// MediaPipe 坐标映射参数
export const SCALE_X = 250;
export const SCALE_Y = 150;
export const SCALE_Z = 100;
export const Y_OFFSET = 40;

// ============================================================
// 渲染参数
// ============================================================
export const BLOOM_THRESHOLD = 0.1;
export const BLOOM_STRENGTH = 2.5;
export const BLOOM_RADIUS = 0.8;

// 场景尺寸
export const WORLD_WIDTH = 300;            // 游戏世界半宽
export const WORLD_HEIGHT = 180;           // 游戏世界半高

// 颜色
export const COLOR_CYAN = new THREE.Color(0x00ffff);
export const COLOR_HP = new THREE.Color(0xff3333);
export const COLOR_SHIELD = new THREE.Color(0x3399ff);
export const COLOR_RAGE = new THREE.Color(0xffaa00);
export const COLOR_BG = new THREE.Color(0x0a0a0f);

// ============================================================
// 敌人参数
// ============================================================
export const MELEE_GRUNT_HP = 30;
export const MELEE_GRUNT_SPEED = 2.0;      // 每秒移动距离
export const MELEE_GRUNT_DAMAGE = 10;
export const MELEE_GRUNT_ATTACK_RANGE = 15; // 攻击距离
export const MELEE_GRUNT_ATTACK_COOLDOWN = 1500; // 攻击间隔 (ms)
