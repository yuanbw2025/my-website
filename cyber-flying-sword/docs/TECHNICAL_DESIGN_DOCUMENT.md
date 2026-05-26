# 🔧 赛博飞剑 — 技术设计文档 (Technical Design Document)

> 版本：1.0 | 最后更新：2026-04-12
> 前置阅读：`PROJECT_BIBLE.md` → `GAME_DESIGN_DOCUMENT.md`

---

## 1. 技术栈总览

| 层 | 技术 | 版本 | 说明 |
|----|------|------|------|
| 构建 | Vite | 6.x | 开发服务器 + 打包 |
| UI | React | 19.x | 菜单/HUD/设置界面 |
| 语言 | TypeScript | 5.x | 全项目强类型 |
| 样式 | Tailwind CSS | 4.x | UI 样式 |
| 3D | Three.js | r128+ | 渲染引擎 |
| 手势 | MediaPipe Hands | latest | 手部 21 点追踪 |
| 音频 | Web Audio API | 原生 | 程序化音效合成 |
| 后处理 | UnrealBloomPass | Three.js 内置 | Bloom 发光 |

---

## 2. 项目结构

```
cyber-flying-sword/
├── docs/                          # 文档
│   ├── PROJECT_BIBLE.md
│   ├── GAME_DESIGN_DOCUMENT.md
│   ├── TECHNICAL_DESIGN_DOCUMENT.md
│   ├── ART_ASSET_PIPELINE.md
│   ├── DEVELOPMENT_ROADMAP.md
│   ├── SETTINGS_AND_MENU_SPEC.md
│   └── gestures/
│       └── all_gestures_reference.html
├── public/
│   └── assets/                    # 静态资产（图片/音频）
├── src/
│   ├── main.tsx                   # 入口
│   ├── App.tsx                    # React 根组件
│   ├── game/                      # 游戏核心（纯 TS，不依赖 React）
│   │   ├── Game.ts                # 游戏主类（初始化/主循环）
│   │   ├── GameLoop.ts            # requestAnimationFrame 循环 + deltaTime
│   │   ├── TimeManager.ts         # 全局时间缩放（hit-stop）
│   │   ├── physics/
│   │   │   ├── WhipPhysics.ts     # 鞭子 lerp 链物理
│   │   │   ├── PlayerPhysics.ts   # 角色挂载/弹射/重力/反弹
│   │   │   ├── CollisionSystem.ts # 碰撞检测（胶囊/AABB）
│   │   │   └── AirflowShield.ts   # 气流罩逻辑
│   │   ├── combat/
│   │   │   ├── DamageSystem.ts    # 伤害计算（速度→伤害衰减公式）
│   │   │   ├── ShieldSystem.ts    # 护盾/精防
│   │   │   ├── RageSystem.ts      # 怒气积攒/大招触发
│   │   │   └── HitStop.ts        # Hit-stop 效果
│   │   ├── entities/
│   │   │   ├── Player.ts          # 玩家实体（HP/Shield/Rage/位置/状态）
│   │   │   ├── Enemy.ts           # 敌人基类
│   │   │   ├── EnemyTypes.ts      # 具体敌人类型
│   │   │   └── EntityPool.ts      # 对象池
│   │   ├── input/
│   │   │   ├── MediaPipeInput.ts  # MediaPipe 初始化 + landmark 获取
│   │   │   ├── GestureDetector.ts # 手势识别（挥鞭/握拳/一指定江山）
│   │   │   └── InputFilter.ts     # EMA 滤波器
│   │   ├── rendering/
│   │   │   ├── SceneSetup.ts      # Three.js 场景/相机/灯光/后处理
│   │   │   ├── WhipRenderer.ts    # 飞剑鞭子渲染（InstancedMesh）
│   │   │   ├── TrailRenderer.ts   # 尾迹系统（ShaderMaterial Points）
│   │   │   ├── EffectsManager.ts  # 特效管理（爆炸/闪光/气流罩）
│   │   │   └── EnvironmentRenderer.ts # 环境（地面/树/闪电）
│   │   ├── audio/
│   │   │   ├── AudioManager.ts    # Web Audio 上下文管理
│   │   │   └── SoundEffects.ts    # 各音效合成函数
│   │   └── levels/
│   │       ├── LevelManager.ts    # 关卡加载/切换
│   │       └── LevelData.ts       # 关卡数据定义
│   ├── ui/                        # React UI 组件
│   │   ├── HUD.tsx                # 战斗 HUD（HP/Shield/Rage 条）
│   │   ├── MainMenu.tsx           # 主菜单
│   │   ├── PauseMenu.tsx          # 暂停菜单
│   │   ├── SettingsPanel.tsx      # 设置面板
│   │   └── CameraPreview.tsx      # 摄像头预览小窗
│   ├── utils/
│   │   ├── MathUtils.ts           # 零分配数学工具
│   │   ├── ObjectPool.ts          # 通用对象池
│   │   └── Constants.ts           # 全局常量
│   └── assets/
│       └── pipeline/              # 前端图片处理工具
│           ├── ImageProcessor.ts  # Canvas API 图片处理
│           └── TextureLoader.ts   # Three.js 纹理加载
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.ts
```

---

## 3. 核心算法

### 3.1 鞭子物理（WhipPhysics）

基于现有 demo 的 `fingerHistory` lerp 链，增强为完整的鞭体物理：

```typescript
// 核心参数
const WHIP_SEGMENTS = 40;          // 鞭子节点数
const HEAD_LERP = 0.8;             // 握柄端响应系数
const TAIL_LERP = 0.2;             // 鞭尾端响应系数
const UPWARD_DRIFT = 2.0;          // 上漂力（仙气效果）
const PLAYER_ATTACH_NODE = 8;      // 角色挂载节点

class WhipPhysics {
    nodes: Vector3[];  // 复用对象，零分配
    
    update(fingerPos: Vector3, dt: number) {
        // 节点0：直接跟随手指
        this.nodes[0].lerp(fingerPos, HEAD_LERP);
        
        // 后续节点：依次跟随前一节点
        for (let i = 1; i < WHIP_SEGMENTS; i++) {
            const lerpFactor = HEAD_LERP - (HEAD_LERP - TAIL_LERP) * (i / WHIP_SEGMENTS);
            const target = _tempVec.copy(this.nodes[i - 1]);
            target.y += UPWARD_DRIFT;
            this.nodes[i].lerp(target, lerpFactor);
        }
    }
    
    getSegmentVelocity(index: number): number {
        // 当前帧与上一帧的位移 / dt
    }
}
```

### 3.2 角色挂载/弹射物理（PlayerPhysics）

```typescript
const DETACH_THRESHOLD = 15.0;     // 脱离加速度阈值
const GRAVITY = -20.0;             // 重力加速度
const AIR_DRAG = 0.98;             // 空气阻力系数
const BOUNCE_FACTOR = 0.75;        // 反弹保留速度比例
const REATTACH_SPEED = 3.0;        // 回到跟随态的速度阈值
const AIRFLOW_SPEED = 12.0;        // 气流罩激活速度阈值

enum PlayerState {
    ATTACHED,   // 挂在鞭子上
    LAUNCHED,   // 弹射飞行中
    SHIELDING,  // 握拳防御中
}
```

### 3.3 伤害计算（DamageSystem）

```typescript
// 鞭子伤害：尾端高，根部低，与速度成正比
function calculateWhipDamage(segmentIndex: number, segmentVelocity: number): number {
    const positionWeight = segmentIndex / WHIP_SEGMENTS; // 0→1
    const speedDamage = D_BASE * Math.max(0, segmentVelocity - V_MIN);
    return speedDamage * positionWeight;
}

// 气流罩撞击伤害
function calculateAirflowDamage(playerSpeed: number): number {
    return AIRFLOW_D_BASE * (playerSpeed - AIRFLOW_SPEED);
}

// 常量（需平衡调整）
const D_BASE = 2.0;
const V_MIN = 5.0;       // 低于此速度不造成伤害
const AIRFLOW_D_BASE = 5.0;
```

### 3.4 精防检测（ShieldSystem）

```typescript
const PERFECT_BLOCK_WINDOW = 100; // ms

class ShieldSystem {
    private shieldActivateTime: number = 0;
    
    onGestureChange(newGesture: GestureType) {
        if (newGesture === 'FIST') {
            this.shieldActivateTime = performance.now();
        }
    }
    
    onDamageIncoming(damage: number, timestamp: number): DamageResult {
        const timeSinceShield = timestamp - this.shieldActivateTime;
        
        if (timeSinceShield <= PERFECT_BLOCK_WINDOW) {
            // 精防！
            return {
                damageDealt: 0,
                shieldCost: 0,
                rageGain: 25,
                isPerfectBlock: true,
            };
        } else if (currentGesture === 'FIST') {
            // 普通格挡
            const shieldAbsorb = Math.min(shield.current, damage);
            return {
                damageDealt: damage - shieldAbsorb * 0.5,
                shieldCost: shieldAbsorb,
                rageGain: 5,
                isPerfectBlock: false,
            };
        }
        // 无防御
        return { damageDealt: damage, shieldCost: 0, rageGain: 5, isPerfectBlock: false };
    }
}
```

### 3.5 手势识别（GestureDetector）

```typescript
type GestureType = 'WHIP' | 'FIST' | 'ULTIMATE';

class GestureDetector {
    private ultimateHoldStart: number = 0;
    
    detect(landmarks: NormalizedLandmarkList): GestureType {
        const wrist = landmarks[0];
        
        // 计算各手指伸展状态
        const isThumbUp = dist(wrist, landmarks[4]) > dist(wrist, landmarks[3]);
        const isIndexUp = dist(wrist, landmarks[8]) > dist(wrist, landmarks[6]);
        const isMiddleUp = dist(wrist, landmarks[12]) > dist(wrist, landmarks[10]);
        const isRingUp = dist(wrist, landmarks[16]) > dist(wrist, landmarks[14]);
        const isPinkyUp = dist(wrist, landmarks[20]) > dist(wrist, landmarks[18]);
        
        // 一指定江山：拇指+食指90°，其余弯曲
        if (isThumbUp && isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
            const angle = this.calcThumbIndexAngle(landmarks);
            if (angle >= 80 && angle <= 100) {
                if (this.ultimateHoldStart === 0) {
                    this.ultimateHoldStart = performance.now();
                }
                if (performance.now() - this.ultimateHoldStart >= 300) {
                    return 'ULTIMATE';
                }
            }
        } else {
            this.ultimateHoldStart = 0;
        }
        
        // 握拳
        const extendedCount = [isThumbUp, isIndexUp, isMiddleUp, isRingUp, isPinkyUp]
            .filter(Boolean).length;
        if (extendedCount <= 1 && !isIndexUp && !isMiddleUp) {
            return 'FIST';
        }
        
        // 默认挥鞭
        return 'WHIP';
    }
    
    private calcThumbIndexAngle(lm: NormalizedLandmarkList): number {
        // 拇指方向：lm[2] → lm[4]
        // 食指方向：lm[5] → lm[8]
        // 返回两个向量的夹角（度）
    }
}
```

### 3.6 EMA 输入滤波（InputFilter）

```typescript
// 指数移动平均，平滑 MediaPipe 的抖动
const EMA_ALPHA = 0.35;

class InputFilter {
    private filtered = new Vector3();
    
    update(raw: Vector3): Vector3 {
        this.filtered.x = EMA_ALPHA * raw.x + (1 - EMA_ALPHA) * this.filtered.x;
        this.filtered.y = EMA_ALPHA * raw.y + (1 - EMA_ALPHA) * this.filtered.y;
        this.filtered.z = EMA_ALPHA * raw.z + (1 - EMA_ALPHA) * this.filtered.z;
        return this.filtered;
    }
}
```

---

## 4. 碰撞系统

### 4.1 碰撞体类型

| 对象 | 碰撞体 | 说明 |
|------|--------|------|
| 鞭子每段 | 线段 (Line Segment) | 40 段鞭体中相邻节点形成 39 条线段 |
| 角色 | 圆/球 (Circle) | 简单圆形碰撞体 |
| 敌人 | AABB / 圆 | 根据敌人形状选择 |
| 敌人攻击 | 圆 / 扇形 / 矩形 | 根据攻击类型 |
| 场景墙壁 | 线段 | 横版地形边界 |

### 4.2 碰撞检测优先级

每帧检测顺序：
1. 鞭子线段 vs 敌人 hitbox → 鞭击伤害
2. 角色圆 vs 敌人攻击 → 玩家受伤（检查护盾状态）
3. 角色圆 vs 敌人 → 接触伤害 / 气流罩伤害
4. 角色圆 vs 场景边界 → 反弹
5. 鞭子线段 vs 角色圆 → 弹射触发判定

---

## 5. 渲染管线

### 5.1 场景层级（Z 轴）

| 层 | Z 范围 | 内容 |
|----|--------|------|
| 深背景 | -500 ~ -100 | 远山/天空/星空 |
| 中背景 | -50 ~ -20 | 建筑/大树 |
| 游戏层 | 0 | 角色/敌人/鞭子/特效 |
| 前景 | 30 ~ 100 | 雾气/粒子/近景装饰 |
| 相机 | 150 | 相机位置 |

### 5.2 后处理链

```
Scene → RenderPass → UnrealBloomPass → Output
```

Bloom 参数：
- threshold: 0.1
- strength: 2.5
- radius: 0.8

### 5.3 性能优化要点

| 优化 | 实现方式 |
|------|---------|
| InstancedMesh | 120 把剑用一个 draw call |
| 对象池 | 敌人/粒子/音效节点复用 |
| 零分配数学 | 复用 `_tempVec` 等临时变量 |
| 裁剪 | 视锥体外的敌人不更新渲染 |
| BufferGeometry | 尾迹点使用预分配 Float32Array |

---

## 6. 状态管理

### 6.1 游戏全局状态

```typescript
interface GameState {
    scene: 'MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';
    level: number;
    player: PlayerState;
    enemies: Enemy[];
    timeScale: number;     // 1.0正常, 0.05 hit-stop
    camera: CameraState;
}

interface PlayerState {
    hp: number;
    maxHp: number;
    shield: number;
    maxShield: number;
    rage: number;
    maxRage: number;
    position: Vector3;
    velocity: Vector3;
    state: 'ATTACHED' | 'LAUNCHED' | 'SHIELDING';
    gesture: GestureType;
}
```

### 6.2 React ↔ Game 通信

- **Game → React**：通过 EventEmitter 发送状态更新（HP变化、手势变化等）
- **React → Game**：通过 Game 实例的公开方法（暂停、设置变更等）
- Game 核心逻辑不依赖 React，可独立运行

---

## 7. MediaPipe 集成

### 7.1 初始化流程

```
用户点击"开始" → AudioContext 初始化（需用户交互）
    → MediaPipe Hands 模型加载
    → Camera 启动（640×480）
    → onResults 回调开始接收 landmarks
    → 游戏主循环启动
```

### 7.2 坐标映射

MediaPipe 返回 [0,1] 归一化坐标，需映射到游戏世界坐标：

```typescript
const SCALE_X = 250;
const SCALE_Y = 150;
const SCALE_Z = 100;
const Y_OFFSET = 40;

function landmarkToWorld(lm: NormalizedLandmark): Vector3 {
    return new Vector3(
        -(lm.x - 0.5) * SCALE_X,    // X 翻转（镜像）
        -(lm.y - 0.5) * SCALE_Y + Y_OFFSET,
        -lm.z * SCALE_Z
    );
}
```

### 7.3 配置参数

```typescript
hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,       // 0=快但粗糙, 1=平衡
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
});
```

---

## 8. 音频系统

### 8.1 架构

```typescript
class AudioManager {
    private ctx: AudioContext;
    
    async init() {
        this.ctx = new AudioContext();
        // 必须在用户交互后调用
    }
    
    playWhipHit()    { /* 锯齿波 200→800Hz, 0.2s */ }
    playBlock()      { /* 方波 100Hz, 0.3s */ }
    playPerfectBlock() { /* 正弦波 600Hz + 混响 */ }
    playThunder()    { /* 白噪声 + 低通 800→50Hz, 2s */ }
    playUltimate()   { /* 多层复合音效 */ }
}
```

### 8.2 音效不使用文件

所有音效通过 OscillatorNode / BufferSource 实时合成，零网络请求，包体更小。

---

## 9. 构建与部署

### 9.1 开发命令

```bash
npm run dev      # Vite 开发服务器（支持 HMR）
npm run build    # 生产构建
npm run preview  # 预览生产构建
```

### 9.2 环境变量

```
VITE_MEDIAPIPE_CDN=https://cdn.jsdelivr.net/npm/@mediapipe/hands
```

### 9.3 浏览器兼容

| 浏览器 | 支持 | 说明 |
|--------|------|------|
| Chrome 90+ | ✅ | 主要目标 |
| Edge 90+ | ✅ | Chromium 内核 |
| Firefox 90+ | ✅ | WebGL2 支持 |
| Safari | ⚠️ | MediaPipe 可能有兼容问题 |
| 移动端 | ❌ | 不支持（需要桌面摄像头） |
