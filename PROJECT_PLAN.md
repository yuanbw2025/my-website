# Yuan's Digital Sandbox — 正式项目规划文档

> **文档版本**：v2.0  
> **最后更新**：2026-04-07  
> **维护规则**：每次重大架构变更、新功能上线或模块暂停后，必须更新本文档。AI 助手开始新会话前必须阅读本文档。

---

## 一、核心设计愿景

这是一个**个人数字作品集生态系统**。

- **主门户**是"门面"，是所有内容的入口，对外展示我开发的一切。
- **每个子项目**（工具/书籍/游戏）都可以**直接在网站上使用**，同时拥有**独立的开源仓库**，供访客下载源码。
- 主网站本身是**私有仓库**，子项目仓库**全部公开**。

### 每张项目卡片的标准结构
```
┌─────────────────────────────────┐
│  [图标]  项目标题                 │
│  项目描述文字                     │
│                                 │
│  [▶ 立即使用]  [⬇ 下载源码]       │
└─────────────────────────────────┘
```
- **立即使用** → 跳转到该项目独立的 Vercel 部署 URL（`target="_blank"`）
- **下载源码** → 跳转到该项目的 GitHub 公开仓库

---

## 二、仓库与部署架构

```
GitHub & Vercel 部署全貌
────────────────────────────────────────────────────────────────
[私有] yuanbw2025/my-website
  ├─ 本地路径：~/Desktop/my-website/
  ├─ Vercel 项目：my-website（私有，不公开 URL）
  ├─ 技术栈：纯原生 HTML5 + Vanilla CSS3（零框架）
  └─ 包含内容：
      ├─ index.html          ← 唯一页面，门户主体
      ├─ vercel.json         ← @vercel/static 静态部署
      ├─ api/v2/telemetry-sync.js  ← Gemini API 反向代理
      ├─ .gitignore          ← 排除 infiniteskill/ 等子项目目录
      ├─ PROJECT_PLAN.md     ← 本文档
      └─ WORKING_MEMORY.md   ← AI 跨会话工作记忆

[公开] yuanbw2025/infiniteskill
  ├─ 本地路径：~/Desktop/my-website/infiniteskill/（独立 .git）
  ├─ Vercel 项目：待在控制台为此仓库单独创建 ⚠️
  ├─ 期望 URL：https://infiniteskill.vercel.app/
  └─ 技术栈：Vite 6 + React 19 + TypeScript + TailwindCSS v4

[公开] yuanbw2025/[future-book]   ← 待建
[公开] yuanbw2025/[future-game]   ← 待建
────────────────────────────────────────────────────────────────
```

### ⚠️ 重要：子项目 Git 操作规范

每个子项目目录都有**独立的 `.git`**，与主网站仓库完全隔离：

```bash
# 主网站提交（只包含 index.html、api/、vercel.json 等）
cd ~/Desktop/my-website
git add .
git commit -m "描述"
git push origin main   # → yuanbw2025/my-website

# InfiniteSkill 提交（独立仓库）
cd ~/Desktop/my-website/infiniteskill
git add .
git commit -m "描述"
git push origin main   # → yuanbw2025/infiniteskill（不同 remote！）
```

---

## 三、各模块详细规格

### 3.1 主门户站 `yuanbw2025/my-website`

| 属性 | 值 |
|------|-----|
| 仓库 | `yuanbw2025/my-website`（**私有**） |
| 技术栈 | 原生 HTML5 + Vanilla CSS3 |
| 字体 | Noto Serif SC（Logo） + Outfit（标题/正文） + JetBrains Mono（数据） |
| 配色 | 暗黑极客风（`#0b0c10` 背景，`#66fcf1` 青色 accent） |
| 布局 | ① 顶部导航栏 ② 横向轮播（鼠标拖拽）③ Tabs 分类（AI工具/书籍/游戏）④ 底部访问统计 |
| 统计 | 百度统计（hm.js）+ 不蒜子（busuanzi） |
| Vercel | `@vercel/static` 直接服务 `index.html` |
| Serverless | `/api/v2/telemetry-sync.js`（Gemini 代理，供 infiniteskill 免费通道使用） |

**Vercel 环境变量**（在 Vercel 控制台设置）：
- `SECRET_GEMINI_KEY`：Gemini API Key，供代理函数使用

---

### 3.2 InfiniteSkill `yuanbw2025/infiniteskill`

| 属性 | 值 |
|------|-----|
| 仓库 | `yuanbw2025/infiniteskill`（**公开**） |
| 技术栈 | Vite 6 + React 19 + TypeScript + TailwindCSS v4 |
| 配色 | 羊皮卷枯黄（`#F4EED1` 底色，棕色系 accent） |
| 核心功能 | 上传 PDF/EPUB/TXT/MD → AI 分析 → 导出 OpenClaw 技能包 ZIP |
| Gemini 代理 | 无 Key 时走主站 `/api/v2/telemetry-sync` 免费通道 |

**Vercel 构建配置**（`infiniteskill/vercel.json`）：
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

**AI 调用链路**：
```
用户操作
  ↓
infiniteskill 前端 (skill-compiler.ts)
  ├─ 有 API Key → 直接调用 Gemini API
  └─ 无 API Key → POST https://[主站URL]/api/v2/telemetry-sync
                              ↓
                    主站 Vercel Serverless（SECRET_GEMINI_KEY）
                              ↓
                          Gemini API
```

---

### 3.3 未来模块（规划中）

| 模块 | 仓库（待建） | 类型 | 技术预选 |
|------|------------|------|---------|
| 书籍阅读器 | `yuanbw2025/[book-name]` | 公开 | 静态 HTML / Markdown 渲染 |
| 网页游戏集合 | `yuanbw2025/[game-name]` | 公开 | Canvas / WebGL |
| 浏览器引擎工具 | `yuanbw2025/[tool-name]` | 公开 | 待定 |

---

## 四、当前开发状态

### ✅ 已完成
- [x] 主门户站设计与部署（暗黑极客风，轮播 + Tabs）
- [x] InfiniteSkill v2.0 核心功能（文档解析、AI 编译、ZIP 导出）
- [x] Serverless 代理（`/api/v2/telemetry-sync.js`）
- [x] 跨会话 AI 记忆（WORKING_MEMORY.md + PROJECT_PLAN.md）
- [x] 修复主网站 git 仓库（移除对 infiniteskill 目录的跟踪，添加 .gitignore）
- [x] infiniteskill 建立独立 .git，remote 指向 `yuanbw2025/infiniteskill`

### 🔴 待处理（高优先级）
- [ ] **在 Vercel 控制台为 `yuanbw2025/infiniteskill` 单独创建 Vercel 项目**
  - 访问：https://vercel.com/new
  - Import：yuanbw2025/infiniteskill
  - Build Command：`npm run build`
  - Output Dir：`dist`
  - 部署后确认实际 URL（期望是 `infiniteskill.vercel.app`）
- [ ] 确认实际 URL 后，检查主站 `index.html` 中的链接是否需要更新

### 💡 未来构想（低优先级）
- [ ] 主门户添加多主题切换（暗黑/琉璃/羊皮纸）
- [ ] 博客/文档站（独立仓库）
- [ ] 网页游戏集合（独立仓库）
- [ ] 浏览器引擎工具（独立仓库）

---

## 五、为 AI 助手准备的接续开发提示

1. **两个独立 git 仓库**：`my-website`（私有门户）和 `infiniteskill`（公开工具），本地共享父目录但独立推送
2. **主网站不构建 infiniteskill**：主站只链接外部 URL，infiniteskill 独立部署
3. **两套配色**：主网站暗黑青色系，infiniteskill 羊皮卷暖棕色系
4. **Gemini 代理**：触发条件是请求头 `X-Core-Version: 8192`
5. **当前最紧急**：在 Vercel 控制台为 infiniteskill 仓库单独注册 Vercel 项目

---
*本文档由 Antigravity (Claude Sonnet 4.6) 于 2026-04-07 更新至 v2.0。*
