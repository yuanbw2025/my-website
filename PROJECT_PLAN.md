# Yuan's Digital Sandbox — 正式项目规划文档

> **文档版本**：v3.0  
> **最后更新**：2026-04-07  
> **维护规则**：每次重大架构变更、新功能上线或模块暂停后，必须更新本文档。AI 助手开始新会话前必须阅读本文档。

---

## 一、核心设计愿景

这是一个**个人数字作品集生态系统**。

- **主门户**是"门面"，是所有内容的入口，对外展示我开发的一切。
- **每个子项目**（工具/书籍/游戏）作为主网站的**二级页面/子路径**（如 `/infiniteskill/`）直接在网站上呈现并提供服务。
- **开源精神**：尽管这些工具内嵌在我的网站上运行，但它们的代码同时会被同步到我公开的 GitHub 独立仓库中，供访客下载。
- 主网站（包含门户和聚合的所有子项目的最新构建）本身是**私密库**。

### 每张项目卡片的标准结构
```
┌─────────────────────────────────┐
│  [图标]  项目标题                 │
│  项目描述文字                     │
│                                 │
│  [▶ 立即使用]  [⬇ 下载源码]       │
└─────────────────────────────────┘
```
- **立即使用** → 跳转到主站下的相对路径（如 `href="/infiniteskill/"`）
- **下载源码** → 跳转到该项目的 GitHub 公开仓库（如 `href="https://github.com/yuanbw2025/infiniteskill"`）

---

## 二、仓库与部署架构（Monorepo混合部署方案）

为了确保工具能够作为网站的原生子页面无缝加载（不跨域，无 404，且无需在 Vercel 维护大量散落的工程项目），整体工程采用**单一仓库统一构建（Monobuild）**：

```
GitHub & Vercel 部署全貌
────────────────────────────────────────────────────────────────
[私有] yuanbw2025/my-website
  ├─ 本地路径：~/Desktop/my-website/
  ├─ Vercel 项目：my-website（唯一需要部署的 Vercel 主项目）
  ├─ 构建命令：`node build.mjs`
  ├─ 输出目录：`public`
  └─ 包含内容：
      ├─ index.html          ← 主门户页
      ├─ vercel.json         ← 配置路由与 SPA 支持
      ├─ build.mjs           ← 核心构建脚本（依次打包各子应用聚合至 public）
      ├─ api/v2/telemetry-sync.js  ← Gemini API 反向代理
      ├─ PROJECT_PLAN.md     ← 本文档
      ├─ WORKING_MEMORY.md   ← AI 跨会话工作记忆
      ├─ infiniteskill/      ← 子工程代码目录（直接被主站跟踪）
      └─ [future-book]/      ← 待建子工程
      └─ [future-game]/      ← 待建子工程

[公开] yuanbw2025/infiniteskill
  ├─ 这是一个完全开源的镜像库。
  └─ 每当功能开发成熟后，可单独将主工程中的 `infiniteskill/` 目录同步/投递至该仓库中。不参与 Vercel 部署，纯作源码分享。
────────────────────────────────────────────────────────────────
```

---

## 三、构建与路由工作流

当提交代码至 `my-website` 时，Vercel 触发构建，执行 `build.mjs`：
1. 脚本进入 `infiniteskill/` 并执行 `npm run build` 产出 `dist`。
2. 脚本创建顶层 `public/` 目录。
3. 复制顶层 `index.html` → `public/index.html`。
4. 复制 `infiniteskill/dist` → `public/infiniteskill/`。
5. （未来）按此模式复制 book 和 game 构建产物。

**路由转发（vercel.json）**：
为主站 API 提供无损访问，为主站 HTML 直接服务，为 SPA 子工程（在对应子路径上）应用 `/(.*)` → `/index.html` 的 fallback 重写规则。

---

## 四、各模块详细规格

### 4.1 主门户站

| 属性 | 值 |
|------|-----|
| 技术栈 | 原生 HTML5 + Vanilla CSS3 |
| 字体 | Noto Serif SC（Logo） + Outfit（标题/正文） + JetBrains Mono（数据） |
| 配色 | 暗黑极客风（`#0b0c10` 背景，`#66fcf1` 青色 accent） |
| 布局 | ① 顶部导航栏 ② 横向轮播（鼠标拖拽）③ Tabs 分类（AI工具/书籍/游戏）④ 底部访问统计 |
| 统计 | 百度统计（hm.js）+ 不蒜子（busuanzi） |
| Serverless | `/api/v2/telemetry-sync.js`（Gemini 代理，供所有子站调用） |

### 4.2 InfiniteSkill 智能文档技能编译器

| 属性 | 值 |
|------|-----|
| 源码位置 | 独立公开库 `yuanbw2025/infiniteskill` 供展示；本地存放于项目的 `/infiniteskill` 目录内 |
| 服务路径 | `/infiniteskill/` |
| 技术栈 | Vite 6 + React 19 + TypeScript + TailwindCSS v4 |
| 配色 | 羊皮卷枯黄（`#F4EED1` 底色，棕色系 accent） |

---

## 五、当前开发状态

### ✅ 已完成
- [x] 主门户站设计完成（悬象 Astra Prime 主题）。
- [x] InfiniteSkill v2.0 独立工具开发。
- [x] 确立真实的统一架构工作流：恢复将工程挂载为主网站子路径的 `Monorepo 构建流程`，修复由此曾经造成的 404 问题。
- [x] 开发独立的 Node.js 兼容 `build.mjs` 构建脚本。
- [x] 成功执行云端与本地路径对接（所有工具现在作为主网站 `/` 同源子路径响应）。

### 🔴 待处理（次优先级开发）
- [ ] 整理代码库中的旧残余结构，优化部署性能。
- [ ] 更新 `index.html` 中对应各项目卡片的「下载源码」外链按键组件。
- [ ] 在 `index.html` 中继续补充和美化文字内容细节。

---
*本文档由 AI 于 2026-04-07 更新至 v3.0。*
