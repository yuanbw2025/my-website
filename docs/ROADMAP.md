# StoryForge 开发路线图

> **最后更新**: 2026-05-26
> **说明**: 本文档是唯一的功能规划文档。旧文档已归档至 `docs/archive/`。

---

## 当前状态

已完成 Phase 1-7 + Phase 00-20 + Phase A-H + Phase 19a-d，覆盖：
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
- 导入/导出系统（JSON/MD/TXT + 百万字级分块导入）
- 提示词全透明管理（模板编辑 + 工作流 + 好坏示例 + 题材包）

---

## Phase 21 — Token 透明化 + 上下文窗口管理

> 优先级：**高** | 来源：社区反馈 + 用户评论

### 21.1 生成中 Token 估算显示（P1）
- 流式生成中按字数实时估算 token（中文 ≈ 1.5 token/字），底栏显示 `≈ ~450 tokens`
- 流结束后切换为 API 返回的精确值
- 改动：`AIStreamOutput.tsx`、`useAIStream.ts`

### 21.2 补齐 5 个模块的 Token 显示（P0）
- EmotionBeatCard / ReviewPanel / GeographyPanel / WorldMapPanel / PromptExamplesEditor+WorkflowRunner
- 补传 `tokenUsage={ai.tokenUsage}` prop

### 21.3 上下文窗口预算管理 + 分层注入优化（P2）
- **发送前预算面板**：显示本次请求各部分 token 占比（世界观/前文回顾/细纲/伏笔/参考作品…）
- **分层按需注入**：L0 常驻 → L1 核心 → L2 扩展 → L3 增强，超窗口时自动从 L3→L2 裁剪
- **章节摘要自动生成**：每章写完后生成压缩摘要存 DB，后续章节用摘要代替全文
- **各模型窗口预设**：DeepSeek 128K / Gemini 1M / Claude 200K / Ollama 8K 等
- **小窗口适配**：8K/32K 模型自动极简模式

详见 PROGRESS.md Phase 21 章节。

---

## Phase 22 — 题材模板库扩充

> 优先级：**中** | 来源：DEV_PLAN_EVOLUTION Phase E1

- 从 4 个题材包（仙侠/言情/现实/悬疑）扩充到 20+ 个
- 新增：玄幻、武侠、都市、历史、科幻、末世、穿越、重生、系统流、无限流、赛博朋克、克苏鲁、种田、争霸、西幻、奇幻等
- 每个题材包增加：反模式清单 / 节奏策略 / 典型结构

---

## Phase 23 — 角色 + 设定增强

> 优先级：**低** | 来源：DEV_PLAN_EVOLUTION Phase G

### 23.1 角色动态状态面板
- 角色卡片下显示当前状态（位置/实力/持有物品/近期事件）
- 数据来源：状态卡系统

### 23.2 货币体系管理
- 独立的货币单位 CRUD + 兑换关系
- 写作时注入避免 AI 搞错货币

### 23.3 势力绑定地图
- 势力关联世界地图区域
- 地图上可视化势力分布（不同势力不同颜色）

---

## Phase 24 — 导出 + 体验优化

> 优先级：**低** | 来源：DEV_PLAN_EVOLUTION Phase H

### 24.1 导出格式扩充
- EPUB 导出
- HTML 导出（带样式）
- 导出前可选 Anti-AI 体检

### 24.2 版本对比面板
- 左右分栏 diff 对比（增/删/改高亮）
- 退回到此版本

### 24.3 选中文本浮动工具栏
- 选中文本后弹出浮动工具栏：润色/扩写/缩写/改写/查漏
- 修改结果以 diff 形式展示

### 24.4 其他体验项
- File System Access API（绑定本地文件夹自动保存）
- GitHub Gist 导出
- TipTap 富文本编辑器替换 textarea（长期目标）

---

## 未规划 / 长期考虑

| 功能 | 来源 | 备注 |
|------|------|------|
| 协同编辑 | 02-FEATURE-SPEC | 需要后端，当前纯前端架构不支持 |
| WebDAV/坚果云导出 | 02-FEATURE-SPEC | 需 CORS 代理 |
| 国际化 i18n | 02-FEATURE-SPEC | 当前仅中文，架构预留 |
| 移动端适配 | 02-FEATURE-SPEC | 创作工具不适合手机，低优先级 |
| Vercel Serverless 代理 | PROGRESS.md | 解决 CORS 限制的 OpenAI/Claude/Kimi |

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
