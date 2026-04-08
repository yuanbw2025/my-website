# 悬象 · Xuán Xiàng

> **却顾所来径，苍苍横翠微**

个人数字门户网站，融合中国传统山水美学与现代 Web 技术，承载 AI 工具、书籍、游戏等数字作品集。

🔗 **线上地址**：部署于 Vercel（自动部署，推送 `main` 分支即触发）

---

## 📸 项目概览

| 特性 | 说明 |
|------|------|
| **9 套中国风主题** | 绢本（暖绢）、暮色（翠微）、重岩（玄铁）、千里江山、水墨晴岚、丹霞赤壁、青铜鼎彝、墨夜苍穹、紫气东来 |
| **中英文切换** | 一键切换全站语言，localStorage 持久化 |
| **Tab 栏目导航** | 🏺 器·工具 / 📜 卷·书籍 / 🎯 弈·游戏 — 点击切换，不跳转 |
| **SVG 山水底纹** | 纯代码绘制的远山、松树、日月背景，跟随主题自动变色 |
| **子应用集成** | InfiniteSkill 等工具作为独立 React SPA，统一部署在 `/infiniteskill/` 路径下 |

---

## 🗂 目录结构

```
my-website/
├── index.html                  # 🏠 主门户页面（9主题、Tab栏目、i18n）
├── game.html                   # 🎮 飞剑弹珠 — Canvas 弹珠游戏
├── build.mjs                   # 🔨 统一构建脚本（Vercel 使用）
├── vercel.json                 # ☁️  Vercel 部署配置（路由重写等）
│
├── infiniteskill/              # 📦 InfiniteSkill 工具源码（React + Vite + TypeScript）
│   ├── src/
│   │   ├── App.tsx             #   主应用组件
│   │   ├── index.css           #   Tailwind CSS 主题变量
│   │   ├── main.tsx            #   入口
│   │   └── lib/
│   │       ├── doc-parser.ts   #   多格式文档解析（PDF/EPUB/TXT/MD）
│   │       ├── skill-compiler.ts #  AI 技能编译核心（调用 Gemini API）
│   │       └── utils.ts        #   工具函数
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── public/                     # 📂 构建产物（Vercel 最终部署此目录）
│   ├── index.html              #   主页副本
│   └── infiniteskill/          #   InfiniteSkill 编译产物
│       ├── index.html
│       └── assets/             #   JS/CSS/Worker 文件
│
├── api/                        # ⚡ Vercel Serverless Functions
│   └── v2/
│       └── telemetry-sync.js   #   遥测同步接口
│
├── PROMPT_LOG.md               # 📝 用户提示词工作日志（每次需求的完整记录）
├── WORKING_PRINCIPLES.md       # 📐 施工原则文档
├── WORKING_MEMORY.md           # 🧠 AI 工作记忆
├── REDESIGN_PLAN.md            # 📋 改版设计方案
├── PROJECT_PLAN.md             # 📊 项目规划
├── AI_HANDOVER_GUIDE.md        # 🤝 AI 交接指南
└── README.md                   # 📖 本文件
```

---

## 🛠 本地开发

### 前置要求

- **Node.js** ≥ 18（推荐 v20）
- **npm** ≥ 9
- **Git**

### 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/yuanbw2025/my-website.git
cd my-website

# 2. 直接预览主页（纯静态 HTML，无需构建）
open index.html

# 3. 开发 InfiniteSkill 工具
cd infiniteskill
npm install
npm run dev          # 启动 Vite 开发服务器 (localhost:5173)
```

### 构建部署

```bash
# 完整构建（Vercel 部署时自动执行）
node build.mjs

# 手动构建 InfiniteSkill 并同步到 public/
cd infiniteskill && npm install && npm run build
cp -r dist/* ../public/infiniteskill/

# 推送部署
git add -A && git commit -m "update" && git push origin main
```

---

## 🎨 9 套主题说明

### ✦ 精选组合（江山字体 · Noto Serif SC）

| 主题 | 色调 | 背景色 | 主色 | 适合场景 |
|------|------|--------|------|----------|
| 🌄 **绢本** | 浅色 | `#EDE4D0` 暖绢 | `#6B3410` 赭石 | 日间阅读，默认主题 |
| 🌤 **暮色** | 中色 | `#1E2A28` 翠微 | `#6EC8A0` 青碧 | 傍晚氛围 |
| 🌙 **重岩** | 深色 | `#0C0E12` 玄铁 | `#46A0DC` 冰蓝 | 夜间使用 |

### ☀ 浅色系

| 主题 | 特色 |
|------|------|
| **千里江山** | 青绿山水，`Noto Serif SC` 字体 |
| **水墨晴岚** | 纯墨黑白，`Ma Shan Zheng` 书法字体 |

### ◑ 中色系

| 主题 | 特色 |
|------|------|
| **丹霞赤壁** | 赤红暖调，`ZCOOL XiaoWei` 字体 |
| **青铜鼎彝** | 铜绿古调，`ZCOOL QingKe HuangYou` 字体 |

### ● 深色系

| 主题 | 特色 |
|------|------|
| **墨夜苍穹** | 深空翠绿，`Noto Serif SC` 字体 |
| **紫气东来** | 星河紫调，`Ma Shan Zheng` 书法字体 |

主题选择自动保存在浏览器 `localStorage`，下次访问自动恢复。

---

## 📦 子项目：InfiniteSkill

**智能文档 Skill 编译器** — 将专业书籍一键编译为大模型可直接调用的结构化 Skill 技能包。

| 技术栈 | 说明 |
|--------|------|
| React 18 + TypeScript | 前端框架 |
| Vite 6 | 构建工具 |
| Tailwind CSS 4 | 样式系统 |
| Framer Motion | 动画 |
| Google Gemini API | AI 编译引擎 |
| pdf.js / epub.js | 文档解析 |

### 核心能力

1. **文档解析** — 支持 PDF、EPUB、TXT、Markdown 格式
2. **语义拆解** — 按逻辑边界智能拆分知识节点
3. **团队建模** — 构建多角色智能体团队（Agent Team）
4. **技能封装** — 输出可导入 OpenClaw 的标准 Skill Pack（ZIP）

### API 代理

工具提供免费代理通道，用户也可在「开发者高级权限」中填入自己的 Gemini API Key。

---

## 📋 文档索引

| 文档 | 用途 |
|------|------|
| [`PROMPT_LOG.md`](./PROMPT_LOG.md) | 📝 每次用户需求的完整提示词记录 |
| [`WORKING_PRINCIPLES.md`](./WORKING_PRINCIPLES.md) | 📐 开发施工原则（必须遵守的规范） |
| [`WORKING_MEMORY.md`](./WORKING_MEMORY.md) | 🧠 AI 工作记忆（上下文断点恢复用） |
| [`REDESIGN_PLAN.md`](./REDESIGN_PLAN.md) | 📋 网站改版设计方案（9 主题详细规格） |
| [`PROJECT_PLAN.md`](./PROJECT_PLAN.md) | 📊 项目整体规划 |
| [`AI_HANDOVER_GUIDE.md`](./AI_HANDOVER_GUIDE.md) | 🤝 AI 助手交接指南 |

---

## 🚀 部署架构

```
GitHub (main) → Vercel Auto Deploy
                  ├── buildCommand: "node build.mjs"
                  ├── outputDirectory: "public/"
                  └── rewrites: /infiniteskill/* → /infiniteskill/index.html (SPA)
```

- 推送到 `main` 分支即自动触发 Vercel 部署
- `build.mjs` 负责：安装依赖 → 构建 InfiniteSkill → 组装 `public/` 目录
- Vercel rewrites 确保 InfiniteSkill SPA 路由正常工作

---

## 📜 更新日志

### 2026-04-08
- 🎨 全站改版为中国风「悬象」门户
- 🎯 实现 9 套主题下拉切换（3 精选 + 2 浅色 + 2 中色 + 2 深色）
- 🌐 新增中英文一键切换
- 🏺 Tab 栏目导航（工具/书籍/游戏）
- 🔮 InfiniteSkill 页面重设计（绢本浅色主题 + 大模型 Skill 视角文案）
- 🎮 集成飞剑弹珠 Canvas 游戏

### 2026-04-07
- 🚀 项目初始化
- 📦 InfiniteSkill 智能文档编译器上线
- ☁️ Vercel 部署配置

---

## 📄 许可

© 2026 Yuan's Digital Sandbox. All rights reserved.
