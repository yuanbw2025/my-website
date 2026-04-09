# Yuan's Digital Sandbox — 项目核心架构与规划文档

> **文档版本**：v5.0 (多仓库架构版)
> **最后更新**：2026-04-09
> **设计纲领**：主站门户即微缩宇宙，各独立工具共组生命树。

---

## 一、 系统架构蓝图与多仓库部署链路

本项目运用了基于 Vercel 的 **Monobuild (主代码库统一单体构建) 体系**，同时为每个独立工具维护公开的 GitHub 镜像库，供外部用户下载和学习。

### 1.1 三大代码库的职能划分

| 仓库 | 类型 | GitHub 地址 | 用途 |
|------|------|------------|------|
| **my-website** | 🔒 私有 主枢纽 | `yuanbw2025/my-website` | Vercel 部署唯一入口，承载主站 + 所有子项目源码 + 构建脚本 + 后端 API |
| **infiniteskill** | 🌐 公开 镜像库 | `yuanbw2025/infiniteskill` | 智能文档技能编译器的开源镜像，供用户下载 / Star / PR |
| **flying-sword-pinball** | 🌐 公开 镜像库 | `yuanbw2025/flying-sword-pinball` | 飞剑弹珠游戏的开源镜像，零依赖单文件 HTML5 游戏 |

### 1.2 仓库之间的关系图

```
┌──────────────────────────────────────────────────────┐
│                  my-website (私有主库)                  │
│  Vercel 自动部署入口 → https://yuanbw.vercel.app       │
│                                                      │
│  ├── index.html          ← 主站极客科幻首页            │
│  ├── game.html           ← 飞剑弹珠游戏 (原始源码)     │
│  ├── build.mjs           ← 统一构建脚本               │
│  ├── vercel.json         ← 路由规则 + 构建配置          │
│  ├── api/v2/             ← Serverless 后端 (API Key 安全代理) │
│  ├── infiniteskill/      ← 智能编译器子项目 (Vite+React 源码) │
│  │   └── dist/ → 构建后复制到 public/infiniteskill/     │
│  ├── public/             ← 最终部署产物 (build.mjs 聚合生成) │
│  └── *.md                ← 项目文档群                  │
│                                                      │
│  ── 代码镜像推送 ──▶                                   │
│                                                      │
│  infiniteskill/  ═══▶  yuanbw2025/infiniteskill (公开)  │
│  game.html       ═══▶  yuanbw2025/flying-sword-pinball (公开) │
└──────────────────────────────────────────────────────┘
```

### 1.3 构建流水线（Vercel Pipeline 生命周期）

当主代码被推送到 GitHub 的 main 分支后，触发的 Vercel 构建管道如下：

1. **第一阶段（读取环境）**：识别读取 `vercel.json` 规则链和 `SECRET_GEMINI_KEY` 等关键参数。
2. **第二阶段（拦截控制）**：跑自己手写的 Node 脚本 `build.mjs`。
   - 进入 `infiniteskill/` 子目录，执行 `npm install` + `npm run build`。
   - 产生生产级 SPA `dist/` 数据包。
3. **第三阶段（聚合归拢）**：
   - 销毁旧的 `public/` 文件夹并新建。
   - 把主页 `index.html` 和 `game.html` 丢入 `public/`。
   - 将 `infiniteskill/dist/` 资源平移到 `public/infiniteskill/`。
4. **最终形态**：部署器将拼合完整的 `public/` 送上前台。

### 1.4 线上访问路径

| 页面 | URL |
|------|-----|
| 主站首页 | `https://yuanbw.vercel.app/` |
| 智能编译器 | `https://yuanbw.vercel.app/infiniteskill/` |
| 飞剑弹珠游戏 | `https://yuanbw.vercel.app/game.html` |

---

## 二、 关键技术栈清单

| 生态模块 | 所用技术 | 目的 |
|---------|----------|------|
| **主站大门页** | 原生 HTML5 + CSS + JS | 闪电加载 + 极致沉浸动态极客美学 |
| **后端安全代理** | Vercel Serverless (Node.js) | 屏蔽 Web 端 API 密钥暴露风险 |
| **智能编译器** | Vite 6 + React 19 + TailwindCSS v4 + TypeScript | 组件化高速渲染 |
| **飞剑弹珠游戏** | 原生 HTML5 Canvas + Web Audio API | 零依赖单文件，离线可玩 |
| **AI 模型驱动** | Google Gemini API v1beta (Native) | 后端原生接口直连，响应伪装为 OpenAI 格式 |

---

## 三、 各子项目详细说明

### 3.1 InfiniteSkill 智能文档技能编译器

- **位置**：`my-website/infiniteskill/`
- **镜像库**：https://github.com/yuanbw2025/infiniteskill
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
- **镜像库**：https://github.com/yuanbw2025/flying-sword-pinball
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

---

## 四、 当前项目攻坚状态

### 已全面竣工的基础建设（✅ Solid Base）

- [x] 主站 Astra Prime 极客科幻暗蓝美学入口成型落地
- [x] Vercel Serverless 安全中转 API 架设完毕，密钥全部环境变量化
- [x] InfiniteSkill 工具在单体聚合打包中跑通，子站与主站导航无缝贯通
- [x] 全面跑通基于 Gemini 多模型的"全自动模型降级交叉探测"机制
- [x] 智能额度管理与透明化 UX 落地（跨端额度同步与配额拦截）
- [x] 飞剑弹珠游戏 v2.0 完成并上线
- [x] 确立跨周期防呆文档规范（工作记忆台账制 + AI 交接手册）
- [x] 三大仓库独立建制完成（my-website + infiniteskill + flying-sword-pinball）
- [x] InfiniteSkill 知乎 + 微信公众号推广文章撰写完毕

### 即将开启的功能规划（🚀 Next Pipeline）

- **工具拓展**：将逐步开发新的类似于 `infiniteskill/` 的平行工具模块
- **游戏迭代**：飞剑弹珠后续可能增加道具系统、多人排行等功能
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
