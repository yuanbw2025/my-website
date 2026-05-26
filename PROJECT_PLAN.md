# Yuan's Digital Sandbox — 项目核心架构与规划文档

> **文档版本**：v7.0 (独立仓库开发 + 主库集成部署)
> **最后更新**：2026-05-26
> **设计纲领**：主站门户即微缩宇宙，各独立工具共组生命树。

---

## 一、 系统架构蓝图与多仓库部署链路

本项目采用 **独立仓库开发 + 主库集成部署** 的架构。各子项目在自己的独立仓库中进行日常开发，完成后通过 `git subtree pull` 同步到主库，由主库统一构建部署到 Vercel。

> ⚠️ **架构变更说明（2026-05-26）**：此前采用"主库开发 → 镜像推送"模式，已改为"独立仓库开发 → 主库集成"模式。旧模式下独立仓库是只读镜像，新模式下独立仓库是开发正本。

### 1.1 代码库的职能划分

| 仓库 | 类型 | GitHub 地址 | 用途 |
|------|------|------------|------|
| **my-website** | 🏗 集成部署库 | `yuanbw2025/my-website` | Vercel 部署唯一入口，汇聚所有子项目构建产物 + 门户页面 + 后端 API。**不在此库做子项目开发。** |
| **storyforge** | 🔧 独立开发库 | `yuanbw2025/storyforge` | 故事熔炉小说创作工坊，日常开发在此进行 |
| **yuntype** | 🔧 独立开发库 | `yuanbw2025/yuntype` | 云中书 AI 排版引擎 |
| **cyber-flying-sword** | 🔧 独立开发库 | `yuanbw2025/cyber-flying-sword` | 赛博飞剑手势动作游戏 |
| **novel-game** | 🔧 独立开发库 | `yuanbw2025/novel-game` | 小说转文本交互游戏生成器 |
| **ai-slides** | 🔧 独立开发库 | `yuanbw2025/ai-slides` | AI 演示文稿工具 |
| **ai-presentation** | 🔧 独立开发库 | `yuanbw2025/ai-presentation` | AI 演示稿工具 |
| **wechat-html-injector** | 🔧 独立开发库 | `yuanbw2025/wechat-html-injector` | 微信 HTML 注入器 |
| **infiniteskill** | 📦 已归档 | `yuanbw2025/infiniteskill` | 智能文档技能编译器（已成型，不再活跃开发） |
| **Infinite_SpatioTemporal_Map** | 🔧 独立开发库 | `yuanbw2025/Infinite_SpatioTemporal_Map` | 无限时空图（独立项目，不在主库 subtree 中） |
| **flying-sword-pinball** | 🔧 独立开发库 | `yuanbw2025/flying-sword-pinball` | 飞剑弹珠游戏（独立项目，不在主库 subtree 中） |
| **freellmapizh** | 🔧 独立开发库 | `yuanbw2025/freellmapizh` | 免费 LLM API 中文文档 |

### 1.2 开发与部署流程

```
独立仓库（开发正本）                    my-website（集成部署库）
┌──────────────────┐                 ┌──────────────────────────────┐
│ storyforge       │──subtree pull──▶│ storyforge/                  │
│ yuntype           │──subtree pull──▶│ yuntype/                      │
│ cyber-flying-sword│──subtree pull──▶│ cyber-flying-sword/          │
│ novel-game       │──subtree pull──▶│ novel-game/                  │
│ ai-slides        │──subtree pull──▶│ ai-slides/                   │
│ ai-presentation  │──subtree pull──▶│ ai-presentation/             │
│ wechat-html-injector│─subtree pull─▶│ wechat-plugin/              │
│ infiniteskill    │──subtree pull──▶│ infiniteskill/               │
└──────────────────┘                 │                              │
                                     │ + index.html (门户页面)       │
                                     │ + build.mjs (统一构建)        │
                                     │ + vercel.json (部署配置)      │
                                     │ + api/ (Serverless)           │
                                     └──────────┬───────────────────┘
                                                │ git push origin main
                                                ▼
                                          Vercel 自动部署
                                     https://yuanbw.vercel.app
```

### 1.3 日常操作指南

**在独立仓库开发：**
```bash
cd ~/Desktop/projects/storyforge    # 进入独立仓库
git checkout -b feat/xxx            # 新建功能分支
# ... 正常开发 ...
git commit && git push              # 提交推送
# GitHub 上 merge PR（或本地 merge）
```

**同步到主库部署：**
```bash
cd ~/Desktop/projects/my-website
git subtree pull --prefix=storyforge storyforge-mirror main --squash \
  -m "sync: pull latest storyforge"
git push origin main                # 触发 Vercel 部署
```

**批量同步所有子项目（使用 sync.sh）：**
```bash
cd ~/Desktop/projects/my-website
bash sync.sh                        # 一键拉取所有独立仓库的最新代码
git push origin main                # 触发 Vercel 部署
```

### 1.4 关键规则

| 规则 | 说明 |
|------|------|
| ❌ 不在主库直接改子项目代码 | 子目录（storyforge/ 等）只通过 `subtree pull` 更新 |
| ✅ 主库只改自己的文件 | index.html / build.mjs / vercel.json / README.md / api/ |
| ✅ 独立仓库是唯一开发入口 | 所有功能开发、bug 修复都在独立仓库进行 |
| ✅ 独立仓库可接受外部 PR | 合并后 subtree pull 同步到主库 |

### 1.5 构建流水线（Vercel Pipeline 生命周期）

当主代码被推送到 GitHub 的 main 分支后，触发的 Vercel 构建管道如下：

1. **第一阶段（读取环境）**：识别读取 `vercel.json` 规则链和 `SECRET_GEMINI_KEY` 等关键参数。
2. **第二阶段（拦截控制）**：跑自己手写的 Node 脚本 `build.mjs`，按序构建所有子项目。
   - Step 1: 进入 `infiniteskill/`，执行 `npm install` + `npm run build`。
   - Step 2: 进入 `yuntype/`，执行 `npm install` + `npm run build`。
   - Step 3: 进入 `cyber-flying-sword/`，执行 `npm install` + `npm run build`。
   - Step 4: 进入 `storyforge/`，执行 `npm install` + `npm run build`。
   - Step 5: 进入 `novel-game/`，执行 `npm install` + `npm run build`。
3. **第三阶段（聚合归拢）**：
   - 销毁旧的 `public/` 文件夹并新建。
   - 把主页 `index.html` 和 `game.html` 丢入 `public/`。
   - 将各子项目 `dist/` 资源平移到对应的 `public/<子项目名>/`。
4. **最终形态**：部署器将拼合完整的 `public/` 送上前台。

### 1.6 线上访问路径

| 页面 | URL |
|------|-----|
| 主站首页 | `https://yuanbw.vercel.app/` |
| 智能编译器 | `https://yuanbw.vercel.app/infiniteskill/` |
| 云中书排版 | `https://yuanbw.vercel.app/yuntype/` |
| 赛博飞剑 | `https://yuanbw.vercel.app/cyber-flying-sword/` |
| 故事熔炉 | `https://yuanbw.vercel.app/storyforge/` |
| 交互游戏 | `https://yuanbw.vercel.app/novel-game/` |
| 飞剑弹珠游戏 | `https://yuanbw.vercel.app/game.html` |

---

## 二、 关键技术栈清单

| 生态模块 | 所用技术 | 目的 |
|---------|----------|------|
| **主站大门页** | 原生 HTML5 + CSS + JS | 闪电加载 + 极致沉浸动态极客美学 |
| **后端安全代理** | Vercel Serverless (Node.js) | 屏蔽 Web 端 API 密钥暴露风险 |
| **智能编译器** | Vite 6 + React 19 + TailwindCSS v4 + TypeScript | 组件化高速渲染 |
| **飞剑弹珠游戏** | 原生 HTML5 Canvas + Web Audio API | 零依赖单文件，离线可玩 |
| **云中书排版引擎** | Vite + React 19 + TypeScript | AI 驱动的微信公众号 / 小红书排版，660 种组合 |
| **赛博飞剑** | Vite + React 19 + Three.js r128+ + MediaPipe Hands + TypeScript | 手势控制 3D 动作游戏 |
| **AI 模型驱动** | Google Gemini API v1beta (Native) | 后端原生接口直连，响应伪装为 OpenAI 格式 |

---

## 三、 各子项目详细说明

### 3.1 InfiniteSkill 智能文档技能编译器

- **位置**：`my-website/infiniteskill/`
- **独立仓库**：https://github.com/yuanbw2025/infiniteskill
- **技术栈**：Vite 6 + React 19 + TypeScript + TailwindCSS v4
- **功能**：上传 PDF/文档 → AI 自动提取技能树 → 生成结构化技能卡片
- **核心文件**：
  - `src/App.tsx` — 主界面组件
  - `src/lib/skill-compiler.ts` — AI 编译核心（调用 Gemini API）
  - `src/lib/doc-parser.ts` — 文档解析
- **API 通信**：前端 → `/api/v2/telemetry-sync.js` (Vercel Serverless) → Gemini API
- **已完成功能**：
  - [x] PDF/文档上传与解析
  - [x] AI 技能提取与结构化
  - [x] 技能卡片渲染
  - [x] 多模型自动降级（Gemini 2.5 → 3.1 → 1.5 Pro）
  - [x] 智能额度管理（跨端同步配额拦截）
- **配套文章**：
  - 知乎文章 → `infiniteskill/docs/zhihu-article.md`
  - 微信公众号文章 → `infiniteskill/docs/wechat-article.html`

### 3.2 飞剑弹珠 Flying Sword Breakout

- **位置**：`my-website/game.html`（主库中的源文件）
- **独立仓库**：https://github.com/yuanbw2025/flying-sword-pinball
- **技术栈**：纯 HTML5 Canvas + JavaScript + Web Audio API
- **零依赖**：整个游戏浓缩在单个 HTML 文件中（~43KB）
- **核心特性**：
  - [x] 8 大仙侠风格关卡（晨雾林 → 虚空境）
  - [x] 三星评价系统
  - [x] 本地排行榜
  - [x] 程序化音效合成（Web Audio API，无需音频文件）
  - [x] 全设备兼容（桌面键鼠 + 移动触控）
  - [x] 丰富设置面板（音量/震屏/粒子/FPS）
  - [x] 30 个随机仙侠风格昵称

### 3.3 云中书 YunType AI 排版引擎

- **位置**：`my-website/yuntype/`
- **独立仓库**：https://github.com/yuanbw2025/yuntype
- **技术栈**：Vite + React 19 + TypeScript
- **功能**：Markdown 文章 → AI 智能排版 → 微信公众号 / 小红书兼容的富文本 HTML
- **核心特性**：
  - [x] 660 种排版组合（11 配色 × 5 排版 × 4 装饰 × 3 字体）
  - [x] 8 个精选预设（商务简约/文艺清新/温柔奶茶/活力蜜桃/暗夜金字/科技极光/樱花浪漫/深海学术）
  - [x] 微信公众号 + 小红书双平台适配
  - [x] MCP Server（4 工具 + 1 资源），注册到 Cline 可直接调用
  - [x] Prompt Skill 基础版 + 完整版，可导入 Claude/Gemini Artifacts
  - [x] 测试 Playground（独立 HTML，内嵌完整渲染引擎）
- **已知架构问题**：排版系统(T1-T5)仅改 CSS 参数不改 HTML 结构，需在下阶段重构为真正多版式

### 3.4 赛博飞剑 Cyber Flying Sword

- **位置**：`my-website/cyber-flying-sword/`
- **独立仓库**：https://github.com/yuanbw2025/cyber-flying-sword（待创建）
- **技术栈**：Vite + React 19 + TypeScript + Three.js r128+ + MediaPipe Hands
- **功能**：手势控制的 3D 赛博朋克动作平台游戏
- **核心玩法**：
  - 玩家控制「鞭」（40 节 lerp 链），而非角色本身
  - 角色挂载在鞭的第 ~8 节点上，作为物理对象
  - 三种手势：张手=鞭击、握拳=护盾格挡、拇指+食指 90°=大招
  - 完美格挡（100ms 窗口）= 零护盾消耗 + 大量怒气
  - 三大资源：HP、Shield、Rage
- **视觉**：InstancedMesh 120 把飞剑、UnrealBloomPass 辉光、ShaderMaterial 拖尾
- **音频**：Web Audio API 程序化合成，零音频文件
- **当前状态**：🚧 骨架搭建中，核心文档已完成（PROJECT_BIBLE / GDD / TDD / 手势参考）
- **待开发功能**：
  - [ ] MediaPipe 手势检测集成
  - [ ] 鞭物理系统（WhipPhysics）
  - [ ] 角色挂载与发射系统（PlayerPhysics）
  - [ ] 伤害 / 护盾 / 怒气系统
  - [ ] 敌人 AI（6 种敌人类型）
  - [ ] 关卡设计与 Boss 战
  - [ ] HUD 与音效系统

### 3.5 故事熔炉 StoryForge

- **位置**：`my-website/storyforge/`
- **独立仓库**：https://github.com/yuanbw2025/storyforge
- **技术栈**：Vite + React 19 + TypeScript
- **功能**：AI 辅助的小说创作工坊，包含世界观设定、大纲生成、章节续写。
- **核心特性**：纯本地存储，自由配置各类 AI 模型接口。

### 3.6 小说转文本交互游戏 Novel Game

- **位置**：`my-website/novel-game/`
- **独立仓库**：https://github.com/yuanbw2025/novel-game
- **技术栈**：Vite + React 19 + TypeScript
- **功能**：将小说剧本转换为分支叙事的互动文本游戏，支持变量与成就。
- **核心特性**：
  - AI 自动生成包含多分支与变量的故事图谱
  - 可视化剧情树视图
  - 直接导出为含存档系统与成就解锁的单文件 HTML 游戏

---

## 四、 当前项目攻坚状态

### 已全面竣工的基础建设（✅ Solid Base）

- [x] 主站中国风「悬象」门户 9 套主题 + Tab 栏目 + i18n 落地
- [x] Vercel Serverless 安全中转 API 架设完毕，密钥全部环境变量化
- [x] InfiniteSkill 工具在单体聚合打包中跑通，子站与主站导航无缝贯通
- [x] 全面跑通基于 Gemini 多模型的"全自动模型降级交叉探测"机制
- [x] 智能额度管理与透明化 UX 落地（跨端额度同步与配额拦截）
- [x] 飞剑弹珠游戏 v2.0 完成并上线
- [x] 确立跨周期防呆文档规范（工作记忆台账制 + AI 交接手册）
- [x] 12 个仓库独立建制完成，架构升级为"独立仓库开发 → 主库集成部署"模式（2026-05-26）
- [x] InfiniteSkill 知乎 + 微信公众号推广文章撰写完毕
- [x] 云中书 YunType v1.0 全渠道上线（Web App + MCP Server + Prompt Skill + Playground）
- [x] 赛博飞剑 Monobuild 集成骨架 + 核心设计文档完成

### 即将开启的功能规划（🚀 Next Pipeline）

- **赛博飞剑开发**：从骨架推进到 MVP — MediaPipe 手势检测 → 鞭物理 → 角色挂载 → 关卡设计
- **云中书重构**：重构排版系统为真正多版式（不同 HTML 结构），参考 `_reference/` 资料
- **工具拓展**：继续开发新的平行工具模块
- **页面打磨**：继续调优主页矩阵排列排版及交互动画
- **文档完善**：持续维护 AI 交接文档和项目规划文档

---

## 五、 新 AI 接手快速指引

如果你是新加入的 AI 开发助手，请按以下顺序阅读文档：

1. **`AI_HANDOVER_GUIDE.md`** — 🛑 最高优先级！行为纪律与防呆约束
2. **`PROJECT_PLAN.md`** (本文件) — 全局架构与进度
3. **`WORKING_MEMORY.md`** — 开发日志台账
4. **`WORKING_PRINCIPLES.md`** — 设计原则
5. **`build.mjs`** — 理解构建流程的关键脚本
6. **`vercel.json`** — 路由规则与部署配置

**关键提醒**：
- 不要把根目录当成 Vite 项目（它不是）
- API 密钥只能通过 `process.env` 获取，绝不硬编码
- 改代码前必须向用户通报计划并等待确认
