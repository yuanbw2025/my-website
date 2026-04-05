# 🧠 AI & 开发者协同工作记忆 (WORKING MEMORY)

> **使用说明**：这是一份能够跨设备（Mac/Windows）和跨会话同步的动态"数字大脑"。每次开启新对话时，只要用户指示"基于工作记忆文件开始工作"，AI 必须优先阅读本文件，从而做到 100% 懂你。
> **⚠️ 重要**：本文件记录快照状态，详细项目规划见根目录 `PROJECT_PLAN.md`。

### ⏱ 最新状态快照 (Last Updated: 2026-04-05)
- **更新节点**: 修复因 Gemini Flash 误操作导致的架构问题（将主网站与 infiniteskill 工具站暴力合并）。
- **当前重点**: 修复已完成；主网站只部署静态 HTML；infiniteskill 已配置独立 Vercel 部署。
- **待执行**: 在 Vercel 控制台为 infiniteskill 仓库单独添加 Vercel 项目，获取实际域名后更新 index.html 中的链接。

---

## 🏛 核心系统架构图纸
整个项目是一个**多仓库、独立部署**的网站生态系统。

### 仓库1：主门户站 `yuanbw2025/my-website`（私有）
- **部署方式**：Vercel（来自此 git 仓库），仅部署静态 `index.html`
- **技术栈**：原生 HTML5 + Vanilla CSS3（不使用任何框架）
- **当前 Vercel URL**：（私有，不公开）
- **功能**：作为个人作品合集的门户（Portal）入口，轮播展示项目，矩阵卡片链接至各子站

### 仓库2：InfiniteSkill `yuanbw2025/infiniteskill`（公开）
- **部署方式**：独立 Vercel 部署（连接自 infiniteskill git 仓库）
- **技术栈**：Vite + React + TypeScript + TailwindCSS v4
- **当前 Vercel URL**：`https://infiniteskill.vercel.app/`（待确认实际 URL）
- **功能**：将专业文档（PDF/EPUB/MD）编译为 OpenClaw AI 智能体技能包
- **主题配色**：羊皮卷枯黄 `#F4EED1` 为底色，棕色系 accent

### 防盗安全后台代理（在主仓库）
- 位置：`/api/v2/telemetry-sync.js`（Vercel Serverless Function）
- 密钥通过 Vercel 环境变量 `SECRET_GEMINI_KEY` 注入
- 触发条件：携带请求头 `X-Core-Version: 8192` 的 POST 请求
- 供 infiniteskill 前端在用户不填 API Key 时走免费代理通道

---

## 🚀 后续进化构想池 (Todo/Ideas)
- [ ] 在 Vercel 为 infiniteskill 单独部署，确认实际域名，更新主网站链接
- [ ] 丰富主门户的矩阵链接（博客、网页游戏等）
- [ ] 开发第三个独立浏览器引擎工具
- [ ] 为主门户添加暗色/琉璃/羊皮纸多主题切换

---
*End of Memory*
*(如果 AI 在新设备唤醒，读取到这里请主动向用户打招呼，告知上下文恢复进度。)*
