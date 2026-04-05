# Yuan's Digital Sandbox — 正式项目规划文档

> **文档版本**：v1.0  
> **最后更新**：2026-04-05  
> **维护规则**：每次重大架构变更、新功能上线或模块暂停后，必须更新本文档。AI 助手开始新会话前必须阅读本文档。

---

## 一、项目总览

这是一个**个人数字作品集生态系统**，由**一个主门户（Portal）+ 多个独立子应用**构成。主门户是"门面"，各子应用是独立部署的"分国"。

### 核心设计原则
1. **多仓库独立部署**：每个工具/应用有自己独立的 git 仓库和 Vercel 项目，互不干扰。
2. **主门户只做路由**：主网站不构建任何子应用的代码，只负责展示和外链跳转。
3. **工具站公开，主站私有**：工具代码开源，主网站代码私有。
4. **零框架主站**：主门户坚持原生 HTML + Vanilla CSS，不引入臃肿框架。

---

## 二、仓库与部署架构

```
GitHub & Vercel 部署拓扑
────────────────────────────────────────────────────────────────
[私有仓库] yuanbw2025/my-website
  ↳ 本地路径: E:\MYgithub\my-website
  ↳ Vercel 项目: my-website（私有，不列出 URL）
  ↳ 内容: index.html + api/ 目录
  
  [嵌套，但完全独立的 git 仓库]
  E:\MYgithub\my-website\infiniteskill\
    ↳ 对应公开仓库: yuanbw2025/infiniteskill
    ↳ 在本地是子目录，但 .git 完全独立，推送到不同 remote
    ↳ ⚠️ 主网站 git 不跟踪此目录的内容（应在主网站 .gitignore 确认）

[公开仓库] yuanbw2025/infiniteskill
  ↳ 本地路径: E:\MYgithub\my-website\infiniteskill
  ↳ Vercel 项目: infiniteskill（独立部署）
  ↳ 期望 URL: https://infiniteskill.vercel.app/（待确认）
────────────────────────────────────────────────────────────────
```

### ⚠️ 重要——3flash 制造的错误（已修复）

2026-04-04，Gemini Flash 误操作将两个仓库"暴力合并"，主网站 `vercel.json` 试图在构建时同时构建 infiniteskill 并复制到 `public/infiniteskill`，这导致：
- 使用了 Linux 命令（`mkdir -p`、`cp`），在 Vercel Windows 构建环境下不可靠
- 架构上违反了"多仓库独立部署"原则
- 导致子网站 404

**修复记录（2026-04-05）**：
- `my-website/vercel.json`：改为只用 `@vercel/static` 部署静态 HTML
- `my-website/index.html`：所有指向 infiniteskill 的链接改为独立 Vercel URL（绝对路径，`target="_blank"`）
- `infiniteskill/vercel.json`：新建，配置独立构建 + SPA 路由重写
- `infiniteskill/index.html`：修复标题（原为"My Google AI Studio App"）
- `my-website/WORKING_MEMORY.md`：同步更新

---

## 三、各模块详细规格

### 3.1 主门户站 (`yuanbw2025/my-website`)

| 属性 | 值 |
|------|-----|
| 仓库 | `yuanbw2025/my-website`（私有） |
| 技术栈 | 原生 HTML5 + Vanilla CSS3 |
| 字体 | Outfit（标题）+ JetBrains Mono（代码/数据） |
| 配色主题 | 暗黑极客风（`#0b0c10` 背景，`#66fcf1` 青色 accent） |
| 主要组件 | ① 顶部导航栏、② 横向轮播大屏（鼠标拖拽）、③ 项目矩阵卡片网格、④ 页脚访问统计 |
| 统计服务 | 百度统计（hm.js）+ 不蒜子访问计数 |
| Vercel 配置 | `@vercel/static` 直接服务 `index.html` |
| Serverless | `/api/v2/telemetry-sync.js`（Gemini API 代理，供 infiniteskill 免费代理通道使用） |

**文件结构**：
```
my-website/
├── index.html          # 主门户页面（唯一页面）
├── vercel.json         # Vercel 静态部署配置
├── WORKING_MEMORY.md   # AI 跨会话工作记忆
├── PROJECT_PLAN.md     # 本文档
├── api/
│   └── v2/
│       └── telemetry-sync.js  # Gemini API 反向代理
└── infiniteskill/      # ⚠️ 这是独立 git 仓库的本地路径，主网站 git 不应跟踪其内容
```

**Vercel 环境变量**（在 Vercel 控制台设置，不在代码中）：
- `SECRET_GEMINI_KEY`：站长自己的 Gemini API Key，供代理函数使用

---

### 3.2 InfiniteSkill 智能文档技能编译器 (`yuanbw2025/infiniteskill`)

| 属性 | 值 |
|------|-----|
| 仓库 | `yuanbw2025/infiniteskill`（公开） |
| 技术栈 | Vite 6 + React 19 + TypeScript + TailwindCSS v4 |
| 字体 | Inter（正文）+ JetBrains Mono（代码） |
| 配色主题 | 羊皮卷枯黄（`#F4EED1` 底色，`#8b7355` 棕色 accent） |
| Base URL | `/`（独立部署，根路径） |
| 核心功能 | 上传 PDF/EPUB/TXT/MD → AI 分析 → 导出 OpenClaw 技能包 ZIP |

**文件结构**：
```
infiniteskill/
├── index.html           # HTML 入口（已修复标题和 meta）
├── vercel.json          # Vercel 构建配置（buildCommand + SPA rewrites）
├── vite.config.ts       # Vite 配置（base: '/'，因为独立部署）
├── package.json
├── src/
│   ├── main.tsx         # React 入口，含 Promise.withResolvers polyfill
│   ├── App.tsx          # 主界面：上传区、进度流水线、结果展示
│   ├── index.css        # TailwindCSS v4 主题配置（品牌色、glass-card）
│   └── lib/
│       ├── doc-parser.ts    # 文件解析（PDF/EPUB/TXT/MD → 纯文本）
│       ├── skill-compiler.ts # 核心：AI 技能编译逻辑 + ZIP 生成
│       └── utils.ts         # 工具函数（cn()）
├── public/
└── .env.example         # 环境变量示例
```

**Vercel 构建配置**（infiniteskill/vercel.json）：
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

**Vercel 环境变量**（infiniteskill Vercel 项目中设置）：
- （当前无，API Key 由用户自填或走主站代理）

**AI 调用架构**：
```
用户操作
  ↓
infiniteskill 前端 (skill-compiler.ts)
  ↓
  ├─ 如果用户填了 API Key → 直接调用 Gemini API（dangerouslyAllowBrowser）
  └─ 如果没有 API Key → POST /api/v2/telemetry-sync（主站的代理函数）
                              ↓
                        my-website Vercel 的 Serverless Function
                              ↓
                        Gemini API（使用 SECRET_GEMINI_KEY）
```

---

## 四、当前开发状态跟踪

### ✅ 已完成
- [x] 主门户站 HTML/CSS 设计与部署（暗黑极客风格，轮播+矩阵）
- [x] InfiniteSkill v2.0 核心功能（文档解析、AI 编译、ZIP 导出）
- [x] Serverless 代理函数（`/api/v2/telemetry-sync.js`）
- [x] 跨会话 AI 记忆系统（WORKING_MEMORY.md）
- [x] 修复 3flash 的架构合并错误（2026-04-05）

### 🔧 待处理（高优先级）
- [ ] **在 Vercel 为 infiniteskill 单独建立项目**（连接 `yuanbw2025/infiniteskill` 仓库），并确认实际 URL
- [ ] **更新主站中的链接**：将 `https://infiniteskill.vercel.app/` 替换为实际确认的 URL
- [ ] **验证主网站的 `.gitignore`**：确保 `infiniteskill/` 目录不被主网站 git 跟踪

### 💡 未来构想（低优先级）
- [ ] 主门户添加多主题切换（暗黑/琉璃/羊皮纸）
- [ ] 博客/文档站（第三个独立仓库）
- [ ] 网页游戏集合（Canvas/WebGL，第四个独立仓库）
- [ ] 浏览器引擎工具（第三个子应用）
- [ ] 主门户矩阵卡片真正串联博客和游戏

---

## 五、各平台账号与操作指南

### Git 操作规范
```bash
# 主网站提交
cd E:\MYgithub\my-website
git add .
git commit -m "描述"
git push origin main

# InfiniteSkill 提交（独立仓库）
cd E:\MYgithub\my-website\infiniteskill
git add .
git commit -m "描述"
git push origin main
# ⚠️ 注意：这推送到 yuanbw2025/infiniteskill，不是 my-website
```

### Vercel 部署说明
- **主网站**：连接 `yuanbw2025/my-website` → 自动部署 `index.html`（静态）+ `api/` 目录（Serverless）
- **InfiniteSkill**：需单独在 Vercel Dashboard 创建项目，连接 `yuanbw2025/infiniteskill`，Build Command `npm run build`，Output Dir `dist`

### 关键注意事项
1. 两个仓库的 git remote 不同，**不要在 infiniteskill 目录下对主网站做 commit**
2. `/api/v2/telemetry-sync.js` 中的 `SECRET_GEMINI_KEY` **只能在 Vercel 环境变量中设置**，绝不能写入代码
3. 在代码中不要硬编码任何 API Key，`.env*` 文件已被 gitignore

---

## 六、为 AI 助手准备的接续开发提示

当 AI 在新会话中接手时，应知道：

1. **我们有两个独立 git 仓库**：`my-website`（私有门户）和 `infiniteskill`（公开工具），共享同一本地父目录但完全独立
2. **主网站不构建 infiniteskill**：链接直接跳转到外部 URL
3. **配色有两套**：主网站是暗黑青色系，infiniteskill 是羊皮卷暖棕色系
4. **Gemini 代理**在主网站的 `/api/v2/telemetry-sync.js`，要用请求头 `X-Core-Version: 8192` 触发
5. **当前最紧急的事**：在 Vercel 为 infiniteskill 仓库单独注册 Vercel 项目

---
*本文档由 Antigravity (Claude Sonnet 4.6) 于 2026-04-05 初始创建。*
