# 🧠 AI & 开发者协同工作记忆 (WORKING MEMORY)

> **使用说明**：这是一份能够跨设备（Mac/Windows）和跨会话同步的动态"数字大脑"。每次开启新对话时，只要用户指示"基于工作记忆文件开始工作"，AI 必须优先阅读本文件，从而做到 100% 懂你。
> **⚠️ 重要**：本文件记录快照状态，详细项目规划见根目录 `PROJECT_PLAN.md`。

### ⏱ 最新状态快照 (Last Updated: 2026-04-07)
- **更新节点**: 修正架构认知。确立采用主库 Monobuild 模式：主网站通过执行 `build.mjs` 将自己和所有子目录里的工具应用全部构建聚合至 `public/` 一并部署。解决了此前由于架构脱节导致的 `infiniteskill` 404 问题。
- **当前重点**: 工具项目（如 infiniteskill）是主域名的**子目录/二级页面**（`/infiniteskill/`）。同时它的源码在 GitHub 有一个平行的公开库（供他人下载用），这是分离和解耦的完美结合。

---

## 🏛 核心系统架构图纸
整个项目是一个**独立单一构建体系**。

### 门户与工作流 `yuanbw2025/my-website`（私有库）
- **部署方式**：Vercel（读取这个私有库），通过 `build.mjs` 和 `vercel.json` 将原生门户 HTML 与各子 React 应用综合至 `public/`。
- **当前状态**：已经修复子工具页面外链错误，重新全部改为同站站内跳转链接 `/infiniteskill/`。

### 开发中的子工具 `infiniteskill/` (子目录模块)
- **存放方式**：内嵌在主代码库中开发和托管部署。
- **技术栈**：Vite + React + TypeScript + TailwindCSS v4。
- **额外身份**：同时把该目录通过 subtree 或分离后的 push 同步到远端的开源仓库 `yuanbw2025/infiniteskill`，以满足下载展示之用。

### 防盗安全后台代理
- 位置：`/api/v2/telemetry-sync.js`（Vercel Serverless Function）
- 触发条件：携带请求头 `X-Core-Version: 8192` 的 POST 请求。

---

## 🚀 后续进化构想池 (Todo/Ideas)
- [ ] 丰富主门户的卡片设计：为主卡片提供【立即体验】与【下载源码】双按钮链路。
- [ ] 继续开发其他项目：书籍与深思模块、浏览器引擎工具、实验性网络游戏。

---
*End of Memory*
*(如果 AI 在新设备唤醒，读取到这里请主动向用户打招呼，告知上下文恢复进度。)*
