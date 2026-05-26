# StoryForge 开发路线图

> **最后更新**: 2026-05-26
> **说明**: 本文档是唯一的功能规划文档。旧文档已归档至 `docs/archive/`。

---

## 当前状态

已完成 Phase 1-7 + Phase 00-24 + Phase A-H + Phase 19a-d，覆盖：
- 完整创作流程（世界观→大纲→细纲→正文）
- 13 家 AI 平台接入
- 10 维世界构建系统
- 伏笔系统（逾期检测 + urgency/importance + AI prompt 自动注入 + AI 建议）
- 质量控制三件套（审校 + Anti-AI 五维去痕迹 + 追读力评估）
- 大纲批量生成 + 大纲预览面板
- 大师作品学习系统（Layer 1+2 + 风格量化 + 节奏分析 + 大师洞察）
- 三层记忆系统（Working/Episodic/Semantic）
- 全局故事线 + 情节脉络
- 3D 世界地图（Voronoi + Azgaar 集成）
- 风格模板系统（15 个预设）+ 创作方法论（雪花法/英雄之旅/三幕式）
- 便签系统 + 角色出场章节管理
- 导入/导出系统（JSON/MD/TXT/HTML/EPUB + 百万字级分块导入 + GitHub Gist + FSA）
- 提示词全透明管理（模板编辑 + 工作流 + 好坏示例 + 20+ 题材包）
- Token 透明化（全模块实时估算 + 精确值 + 上下文窗口预算管理）
- 角色动态状态面板 + 货币体系管理 + 势力地图绑定
- 版本对比 Diff 面板 + 选中文本浮动工具栏

---

## ✅ Phase 21 — Token 透明化 + 上下文窗口管理（已完成）

- 21.1 ✅ 流式生成中 Token 实时估算（中文 ≈ 1.5 token/字）
- 21.2 ✅ 全模块 Token 显示（AIStreamOutput + ReviewPanel + GeographyPanel + WorldMapPanel + PromptExamplesEditor + WorkflowRunner + EmotionBeatCard）
- 21.3 ✅ 上下文窗口预算管理（ContextBudgetBar 组件 + 分层注入 L0-L3 + 模型预设 + 自动裁剪）

---

## ✅ Phase 22 — 题材模板库扩充（已完成）

- 从 4 个题材包扩充到 20 个
- 新增：玄幻、武侠、都市、历史、科幻、末世、穿越、重生、系统流、无限流、赛博朋克、克苏鲁、种田、争霸、西幻/奇幻、游戏

---

## ✅ Phase 23 — 角色 + 设定增强（已完成）

- 23.1 ✅ 角色动态状态面板（CharacterStatusPanel，从状态卡系统读取）
- 23.2 ✅ 货币体系管理（CurrencyPanel + 兑换关系 + AI prompt 自动注入）
- 23.3 ✅ 势力绑定地图（Faction.mapRegion + color 字段 + FactionPanel UI）

---

## ✅ Phase 24 — 导出 + 体验优化（已完成）

- 24.1 ✅ EPUB 导出（epub-export.ts + JSZip + EPUB 3.0 + 目录 + 封面）
- 24.2 ✅ 版本对比面板（DiffViewer 组件 + LCS 行级 diff + 增删高亮）
- 24.3 ✅ 选中文本浮动工具栏（FloatingToolbar + 润色/扩写/缩写/改写/查漏）

---

## 未规划 / 长期考虑

| 功能 | 来源 | 备注 |
|------|------|------|
| 协同编辑 | 02-FEATURE-SPEC | 需要后端，当前纯前端架构不支持 |
| WebDAV/坚果云导出 | 02-FEATURE-SPEC | 需 CORS 代理 |
| 国际化 i18n | 02-FEATURE-SPEC | 当前仅中文，架构预留 |
| 移动端适配 | 02-FEATURE-SPEC | 创作工具不适合手机，低优先级 |
| Vercel Serverless 代理 | PROGRESS.md | 解决 CORS 限制的 OpenAI/Claude/Kimi |
| TipTap 富文本编辑器优化 | Phase 24 | 长期目标，已有基础 |

---

## 归档说明

以下旧文档已移至 `docs/archive/`，内容已整合到本文档和 PROGRESS.md：

| 文件 | 原用途 | 归档原因 |
|------|--------|---------|
| 01-09 系列 (9个) | 早期产品/技术/开发规划 (2026-04-13) | 已过时或已实现 |
| DEV_PLAN_EVOLUTION.md | Phase A-H 演进计划 | A-H 已完成，未完成项整合到本文档 |
| DEV_PLAN_OUTLINE_REDESIGN.md | 大纲重构计划 | 已完成 |
| HANDOFF.md | AI 换机交接手册 | 已过时，PROGRESS.md 覆盖 |
| playbooks/PHASE-00~20 (21个) | 各 Phase 执行手册 | 全部已完成 |
| design-system/*.md (2个) | 设计系统迁移 | 已完成 |
