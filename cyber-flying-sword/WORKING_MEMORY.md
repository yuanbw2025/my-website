# 🧠 赛博飞剑 — 工作记忆 (Working Memory)

> **本文档是 AI 协作的上下文恢复文档。** 每次开发任务后必须更新。
> 任何 AI 接手时应先阅读 `docs/PROJECT_BIBLE.md`，再读本文档。

---

## 📍 项目状态总览

| 项目 | 状态 |
|------|------|
| **当前阶段** | Sprint 1 — MVP 核心循环 |
| **可运行** | ❌ 骨架占位符，无实际游戏逻辑 |
| **最后更新** | 2026-04-13 |

---

## 🏗️ 架构关系

本项目是 `my-website` 主库的**独立开发副本**，用于并行开发，避免影响主库（主库正在开发云中书 YunType）。

```
桌面/
├── my-website/              ← 主库（私有，Vercel 部署入口）
│   └── cyber-flying-sword/  ← 骨架副本（不动）
├── cyber-flying-sword/      ← ✅ 本项目（独立开发环境）
├── infiniteskill/           ← InfiniteSkill 公开镜像
└── flying-sword-pinball/    ← 飞剑弹珠公开镜像
```

### 合并回主库 Checklist

当本项目达到 MVP 可玩时，执行以下步骤合并：

- [ ] `vite.config.ts` 的 `base` 从 `'/'` 改回 `'/cyber-flying-sword/'`
- [ ] 复制源码到 `my-website/cyber-flying-sword/`（排除 `node_modules/` 和 `dist/`）
- [ ] 确认 `my-website/build.mjs` 中赛博飞剑的构建步骤正常
- [ ] 确认 `my-website/vercel.json` 中赛博飞剑的路由重写正常
- [ ] 推送 `my-website` 到 `main` 分支，验证 Vercel 部署

---

## 📋 开发进度

### Sprint 1：MVP 核心循环（当前）

**目标**：能看到鞭子跟手、角色挂载、基础敌人、可玩一个循环

- [ ] Three.js 场景搭建（相机/灯光/后处理 Bloom）
- [ ] MediaPipe Hands 集成（摄像头启动 + landmark 获取）
- [ ] 手势识别（挥鞭/握拳/一指定江山）
- [ ] 鞭子物理（40 节点 lerp 链）
- [ ] 鞭子渲染（InstancedMesh 飞剑 + 尾迹粒子）
- [ ] 角色挂载/弹射物理
- [ ] 碰撞系统（鞭子 vs 敌人、角色 vs 边界）
- [ ] 战斗系统（伤害/护盾/怒气/精防）
- [ ] 基础敌人（近战杂兵）
- [ ] HUD（HP/Shield/Rage 条 + 摄像头预览）
- [ ] 音效系统（程序化合成）
- [ ] 主菜单 + 开始游戏流程

### Sprint 2：打磨与关卡（待规划）
- [ ] 更多敌人类型
- [ ] Boss 战
- [ ] 关卡设计
- [ ] 特效打磨

---

## ⚠️ 关键技术决策记录

| 日期 | 决策 | 原因 |
|------|------|------|
| 2026-04-13 | 从 `my-website` 独立出来作为单独文件夹开发 | 避免影响主库的云中书开发，物理隔离 |
| 2026-04-13 | `vite.config.ts` 的 `base` 在独立开发时设为 `'/'` | 方便本地 `npm run dev` 预览，合并时改回 `'/cyber-flying-sword/'` |

---

## 🔑 关键文件索引

| 文件 | 说明 |
|------|------|
| `docs/PROJECT_BIBLE.md` | 🛑 AI 必读！核心设计原则 + Red Lines |
| `docs/GAME_DESIGN_DOCUMENT.md` | 完整游戏设计（玩法/敌人/关卡/UI） |
| `docs/TECHNICAL_DESIGN_DOCUMENT.md` | 技术架构（算法/代码结构/渲染管线） |
| `docs/gestures/all_gestures_reference.html` | 手势图解参考 |
| `WORKING_MEMORY.md` | 本文档（进度追踪 + 上下文恢复） |

---

## 📝 给接手 AI 的快速指引

1. **先读** `docs/PROJECT_BIBLE.md` — 理解"玩家只操控鞭子"的核心概念
2. **再读** 本文档 — 了解当前进度和未完成的任务
3. **关键红线**：
   - 玩家只操控飞剑鞭子，不操控角色
   - 手势不是键盘替代品
   - 单手操控（右手）
   - 画符系统暂缓至 v2.0
4. **技术栈**：Vite 6 + React 19 + TypeScript + Three.js r128+ + MediaPipe Hands
5. **本项目是独立开发环境**，合并回 `my-website` 时注意 `base` 路径配置
