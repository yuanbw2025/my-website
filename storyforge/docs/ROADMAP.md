# StoryForge 开发路线图

> **最后更新**: 2026-05-26
> **说明**: 本文档是唯一的功能规划文档，整合自旧版 01-09 系列文档 + DEV_PLAN_EVOLUTION + playbooks 中尚未实现的功能。旧文档已归档至 `docs/archive/`。

---

## 当前状态

已完成 Phase 1-7 + Phase 00-20 + Phase A-H + Phase 19a-d，覆盖：
- 完整创作流程（世界观→大纲→细纲→正文）
- 13 家 AI 平台接入
- 10 维世界构建系统
- 伏笔追踪系统
- 大师作品学习系统（Layer 1+2）
- 三层记忆系统（Phase A）
- 全局故事线（Phase B）
- 3D 世界地图（Phase 20）
- 导入/导出系统
- 提示词全透明管理

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

## Phase 22 — 质量控制三件套

> 优先级：**高** | 来源：DEV_PLAN_EVOLUTION Phase F

### 22.1 Anti-AI 去痕迹增强
- 五维检查：词汇 cliché / 句法多样性 / 展示vs告知 / 模板化情感 / 说话标签
- 高频词统计 + AI 优化建议
- 新增 `AntiAIPanel.tsx`

### 22.2 追读力评估
- AI 评估维度：Hook（章末悬念）/ Coolpoint（爽点）/ Micropayoff（微兑现）/ Pacing（节奏）
- 0-100 评分 + 全书趋势折线图
- 章节列表颜色标注评分

### 22.3 章节审校增强
- 已有 ReviewPanel 基础，需增强：
  - 逻辑一致性 / 人物行为一致性 / 世界观一致性 / 伏笔衔接 / 情节节奏
  - 结构化输出 ReviewResult（overallScore + issues[] + suggestions[]）

---

## Phase 23 — 伏笔系统升级

> 优先级：**中** | 来源：DEV_PLAN_EVOLUTION Phase C

### 23.1 伏笔逾期检测
- 新增字段：`expectedResolveChapterId` / `importance` / `urgency`
- 自动计算紧急度，看板上标红逾期伏笔

### 23.2 伏笔自动注入写作 Prompt
- 当前章节关联的伏笔（埋设/呼应/回收任务）自动注入 AI 上下文
- 全局逾期伏笔（urgency >= high）强制注入

### 23.3 AI 自动建议伏笔
- 根据故事线 + 已有伏笔 + 当前大纲，AI 建议新的伏笔点

---

## Phase 24 — 大纲流程强化

> 优先级：**中** | 来源：DEV_PLAN_EVOLUTION Phase D

### 24.1 批量生成大纲
- 选择范围（全书/指定卷/章节区间）→ 循环生成，每章摘要传给下一章
- 显示进度条 + 支持中途取消

### 24.2 大纲预览面板
- 章节完整信息聚合：标题+摘要+故事线位置+出场角色+相关伏笔+场景+情绪走向
- 写作时可展开参考

---

## Phase 25 — 题材 + 风格扩展

> 优先级：**中** | 来源：DEV_PLAN_EVOLUTION Phase E

### 25.1 题材模板库扩充
- 从 4 个扩充到 20+ 个题材包
- 每个题材包增加：反模式清单 / 节奏策略 / 典型结构

### 25.2 风格模板系统
- 内置 10-15 个风格预设（金庸/古龙/张爱玲/网文爽文/硬科幻/轻小说…）
- 每个预设含：promptInjection / 偏好词汇 / 避免表达 / 对话风格
- 支持用户自定义风格

### 25.3 创作方法论引导
- 雪花法 / 英雄之旅 / 三幕式
- 选择后生成大纲时按方法论阶段指导 AI 规划

---

## Phase 26 — 角色 + 设定增强

> 优先级：**低** | 来源：DEV_PLAN_EVOLUTION Phase G

### 26.1 角色动态状态面板
- 角色卡片下显示当前状态（位置/实力/持有物品/近期事件）
- 数据来源：状态卡系统

### 26.2 角色出场章节管理
- 首次出场/活跃范围/退场章节
- 写作时只注入当前活跃角色

### 26.3 功法/技能系统
- 功法 CRUD + 品级 + 效果 + 持有角色关联
- 力量体系面板下子面板

### 26.4 货币体系管理
- 货币单位 + 兑换关系
- 写作时注入避免 AI 搞错

### 26.5 势力绑定地图
- 势力关联世界地图区域
- 地图上可视化势力分布

---

## Phase 27 — 导出 + 体验优化

> 优先级：**低** | 来源：DEV_PLAN_EVOLUTION Phase H + 07-DEVELOPMENT-PLAN Phase 6

### 27.1 导出格式扩充
- EPUB 导出
- HTML 导出（带样式）
- 导出前可选 Anti-AI 体检

### 27.2 版本对比面板
- 左右分栏 diff 对比（增/删/改高亮）
- 退回到此版本

### 27.3 便签/笔记系统
- 可关联章节的便签 CRUD
- 编辑器侧边展开 + 快捷键贴便签

### 27.4 选中文本智能操作
- 选中文本后浮动工具栏：润色/扩写/缩写/改写/查漏
- 修改结果以 diff 形式展示

### 27.5 其他体验项（来自旧 Phase 6/7）
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
| 01-PRODUCT-OVERVIEW.md | 产品概述 v1.0 (2026-04-13) | 已过时，README 覆盖 |
| 02-FEATURE-SPEC.md | 功能规格 v1.0 | 已过时，功能已实现或已整合到本文档 |
| 03-UI-DESIGN.md | UI 设计稿 | 已过时，UI 已大幅重构 |
| 04-TECH-ARCHITECTURE.md | 技术架构 v1.0 | 已被 docs/ARCHITECTURE.md 取代 |
| 05-WORLD-BUILDING-ENGINE.md | 世界构建引擎设计 | 已实现 |
| 06-AI-PROMPTS-SYSTEM.md | AI 提示词系统设计 | 已实现（Phase 00-17） |
| 07-DEVELOPMENT-PLAN.md | 开发计划 v1.0 Phase 1-7 | 全部已完成 |
| 08-DATA-SCHEMA.md | 数据库设计 | 已被 ARCHITECTURE.md 覆盖 |
| 09-REDESIGN-INTEGRATION-PLAN.md | 整改集成计划 v3 | 已执行完毕 |
| DEV_PLAN_EVOLUTION.md | Phase A-H 演进计划 | A-H 已完成，未完成项整合到本文档 |
| DEV_PLAN_OUTLINE_REDESIGN.md | 大纲重构计划 | 已在 Phase A-H 中完成 |
| HANDOFF.md | AI 换机交接手册 | 已过时，PROGRESS.md 覆盖 |
| playbooks/PHASE-00~20 | 各 Phase 执行手册 | 全部已完成 |
| design-system/*.md | 设计系统迁移 | 已完成 |
