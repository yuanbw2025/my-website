# StoryForge 开发路线图

> **最后更新**: 2026-05-28
> **说明**: 本文档是唯一的功能规划文档。旧文档已归档至 `docs/archive/`。
> **结构**: 上半部分「已完成」，下半部分「待开发」按优先级排列。完成后从待办挪到已完成区。

---

# ═══ 已完成 ═══

## ✅ Phase 1-7 — 基础架构 + 核心创作流程

- 完整创作流程（世界观→大纲→细纲→正文）
- 提示词基础设施（`promptTemplates` 表 + 渲染引擎 + 适配器）
- 提示词管理 UI（编辑器 + 列表 + 实时预览 + 导入导出）
- Dexie v7 数据模型增量扩展
- 侧边栏 5 一级三级树导航
- 世界观 13 字段 + 人文环境 7 字段 + 角色分档（次要/NPC/路人）
- 创作区六模块（故事/规则/章节列表/细纲）
- 版本历史（自动+手动快照）
- AI 文档解析导入

## ✅ Phase 8-11 — 抛光 + 提示词参数化

- 主题修复 + UI 清理
- 提示词参数化（25 参数 + 启用/禁用开关）
- 4 套题材包（仙侠/言情/现实/悬疑）+ 热切换器
- PromptRunPanel 调参浮窗扩散到全创作面板
- 示例/反例闭环（few-shot + 👍👎 + AI 生成）

## ✅ Phase 16-17 — 工作流引擎

- 链式编排 AI 步骤
- 工作流自动写回 + 结构化 saveTarget（角色/大纲/伏笔批量 JSON 写入）

## ✅ Phase 18 — 分块导入流水线

- Blob 持久化 + 断点续传 + 暂停/取消 + 角色去重合并
- 百万字级文档工业级导入方案

## ✅ Phase 19 — 大师研读系统

- 19-a: 五维分析 + 三级深度 + 独立数据表
- 19-b: Layer 1 流水线 + 进度追踪
- 19-c: Layer 2 风格量化 + 章节节奏点提取 + Blob 持久化 + 学习设置
- 19-d: 大师洞察（跨作品归纳）

## ✅ Phase R1-R6 — 代码审查

- TypeScript 严格化 / Store 工厂重构 / 导出 5 方式 / 关系图修复 / 架构文档

## ✅ Phase A — 三层记忆系统

- Working Memory（当前章 + 近 3 章摘要）
- Episodic Memory（状态卡 + 事件 + 关系变动）
- Semantic Memory（世界观 + 角色 + 故事线 + 伏笔）
- 状态表自动提取 + 章节摘要 + 事件时间线 + 情感节拍卡

## ✅ Phase B — 全局故事线

- StoryArc 主线/支线 + 阶段卡 + 进度可视化 + AI 生成 + 上下文注入

## ✅ Phase C — 伏笔系统增强

- 逾期检测 + 紧急度分级 + 上下文自动注入 + AI 伏笔建议

## ✅ Phase D — 大纲流程强化

- 批量生成 + 细纲 6 字段增强 + 大纲预览面板

## ✅ Phase E — 题材模板 + 风格系统

- 21 题材元数据 + 11 写作风格 + 5 创作方法论

## ✅ Phase F — 质量控制三件套

- 章节审校 + 去 AI 味增强 + 追读力评估

## ✅ Phase G — 角色 + 设定增强

- 动态状态 + 出场章节追踪 + 活跃角色过滤

## ✅ Phase H — 历史题材增强 (H1-H5)

- 历史年表与事件考证 + 关键词细节风暴
- 历史资料十三维分析
- 项目级历史创作模式（fantasy/historical 双模式）
- 历史题材包与模板映射

## ✅ Phase 20 — 3D 世界地图

- Voronoi 地形生成 + Azgaar 集成

## ✅ Phase 21 — Token 透明化 + 上下文窗口管理

- 流式生成中 Token 实时估算
- 全模块 Token 显示
- 上下文窗口预算管理（ContextBudgetBar + 分层注入 L0-L3 + 模型预设 + 自动裁剪）

## ✅ Phase 22 — 题材模板库扩充

- 从 4 个题材包扩充到 20 个
- 新增：玄幻、武侠、都市、历史、科幻、末世、穿越、重生、系统流、无限流、赛博朋克、克苏鲁、种田、争霸、西幻/奇幻、游戏

## ✅ Phase 23 — 角色 + 设定增强 II

- 角色动态状态面板 + 货币体系管理 + 势力绑定地图

## ✅ Phase 24 — 导出 + 体验优化

- EPUB 导出 + 版本对比 Diff 面板 + 选中文本浮动工具栏

## ✅ Phase 25 — 地理系统重构 + 重要地点

- 25.1 ✅ 修复世界地图双主世界 bug
- 25.2 ✅ 删除「地理环境」面板，地理总述合并到自然环境
- 25.3 ✅ 2026-05-28 创作区新增「重要地点」模块（多标签组合 + 树状层级 + 树状图/列表双视图 + DB v20 `importantLocations` 表）

## ✅ Phase 26（部分）— 角色权重改进

- 26.1 ✅ 角色创建改进（role 选择器 + AI 阵容缺口感知）
- 26.2 ✅ 角色上下文分权重注入（主角完整/配角一句话/其他仅名字）

## ✅ Phase 30（部分）— 批量生成 + 大纲增强

- 30.1 ✅ 批量生成引擎（细纲批量 + 章节批量 + 进度条 + 中途停止）
- 30.3 ✅ 大纲-细纲同步检测（`lastUsedSummary` + 黄色警告条）
- 30.4 ✅ 大纲输出 JSON 化（JSON.parse 优先 + 正则降级）

## ✅ Phase 31（部分）— 历史模式贯通

- 31.1 ✅ 上下文注入历史数据（`buildHistoricalContext` + Token 预算控制）
- 31.2 ✅ 大纲/细纲/正文感知历史模式（历史上下文 + creativeMode 变量）

## ✅ Phase 28（部分）— 作品分析结果优化

- 28.1 ✅ 2026-05-28 分析结果去重、合并与出处定位（Jaccard 2-gram 相似度去重 + 角色按名聚合 + chunk 来源标注）
- 28.2 ✅ 2026-05-28 分析结果结构化展示（左侧 TOC 导航 + 合并/分块双视图 + 角色合并卡片 + 维度折叠面板）
- 28.3 ✅ 2026-05-28 全书 AI 总结（每维度 100-200 字精炼总结 + `analysisSummary` 字段持久化）

## ❌ Phase 29 — 已关闭

> Prompt 精细化：经确认现有功能已满足需求，关闭。

---

# ═══ 待开发（按优先级排列）═══

## 🔴 优先级：高

### Phase 32 — ✅ 真实与幻想（世界规则体系）（2026-05-28）

> 来源：内部审查 | 状态：已完成 | 取代 Phase 31.3（creativeMode 联动）

**核心理念**：将历史考证从「项目级二选一模式（fantasy/historical）」改为「维度级约束声明」。用户可在任何维度上自由混搭真实与架空，AI 生成时遵守用户声明的约束。

**三级树结构**（15 大类 → ~50 子类 → 提示标签），每个节点可独立设置「📜取自真实 / ✨架空改造 / ⚖️冲突优先」：

```
1. 时代背景        — 历史时期 / 架空起点 / 历法时间
2. 重大事件        — 与历史年表联动，isHistorical=true 自动成为锚点
3. 地理疆域        — 行政区划 / 地形地貌 / 城市重镇 / 水系 / 道路交通
4. 气候环境        — 气候特征 / 自然灾害 / 生态物种
5. 政治制度        — 政体 / 中央官制 / 地方官制 / 选官 / 爵位 / 法律 / 外交
6. 军事            — 军制编制 / 武器装备 / 战术战法 / 防御工事
7. 经济            — 赋税 / 货币金融 / 商业贸易 / 农业 / 手工业 / 资源物产
8. 社会结构        — 阶层 / 宗族 / 性别秩序 / 依附关系 / 民间组织
9. 科技生产力      — 工程 / 医药 / 天文 / 交通工具 / 通信 / 生产工具
10. 文化思想       — 主流思想 / 文学艺术 / 教育
11. 宗教信仰       — 官方宗教 / 民间信仰 / 丧葬祭祀 / 禁忌避讳
12. 民族族群       — 主体民族 / 周边民族 / 民族互动 / 外国势力
13. 语言称谓       — 口语风格 / 称谓体系 / 书面语 / 忌讳用语
14. 日常生活       — 饮食 / 服饰 / 居住 / 出行 / 度量衡 / 时间 / 娱乐 / 节庆 / 社交
15. 力量与超自然   — 力量体系 / 超自然存在 / 灵材法器 / 力量与社会
```

**用户可自定义**：支持新增 L1 大类、L2 子类、L3 提示标签。

**子任务**：

- **32.1** ✅ 数据模型 + DB v21（2026-05-28）
  - 新增 `WorldRulesProfile` 类型：`entries: Record<nodeId, {historical, fictional, priority}>` + `customNodes[]`
  - DB 新增 `worldRulesProfiles` 表（singleton per project）
- **32.2** ✅ Store（`world-rules.ts`，singleton 模式）（2026-05-28）
- **32.3** ✅ 规则清单生成器（`world-rules-manifest.ts`）（2026-05-28）
  - 从 entries 生成结构化清单，集成历史年表锚点 + 历史关键词
  - 不设 Token 上限，透明展示消耗估算
  - `buildWorldRulesContext(projectId)` 一站式读取 DB → 生成清单
- **32.4** ✅ WorldRulesPanel UI（2026-05-28）
  - 三栏布局：L1 列表 → L2 列表 → 编辑区（双输入框 + 优先级）
  - L3 作为编辑区灰色提示标签
  - 底部规则清单实时预览 + Token 估算
  - 各级 `+ 新增` 按钮（用户自定义节点）
  - 已填节点标记（色点指示）
- **32.5** ✅ 世界观三面板去 toggle（2026-05-28）
  - 去掉 WorldviewOriginPanel / NaturalPanel / HumanityPanel / WorldviewPanel 的「幻想设定/历史考证」二选一按钮
  - 统一使用通用字段标签
  - 各面板 AI 生成调用改为注入 `worldRulesContext`
- **32.6** ✅ 下游 prompt 改造（2026-05-28）
  - `world-rules-manifest.ts`：新增 `buildWorldRulesContext(projectId)`
  - `prompt-seeds.ts`：`{{#if (eq creativeMode "historical")}}` → `{{#if worldRulesContext}}`
  - `outline-adapter.ts` / `batch-outline-runner.ts`：参数改为 `worldRulesContext`
  - `OutlinePanel.tsx`：调用 `buildWorldRulesContext` 替代 `buildHistoricalContext`
- **32.7** ✅ 侧边栏 + 路由（2026-05-28）
  - 世界观子树第一项：「⚖️ 真实与幻想」（Scale 图标）
  - WorkspacePage 注册 `world-rules` → `WorldRulesPanel`
- **32.8** ✅ 历史年表锚点标识（2026-05-28）
  - `isHistorical: true` 事件标签改为「⚓ 史实锚点」+「AI 不可违反」提示
  - `isHistorical: false` 事件标签改为「✨ 虚构/架空」
- **32.9** ✅ 数据迁移（2026-05-28）
  - `loadProfile` 首次访问时检测 `creativeMode=historical`，自动填充 `globalNote` 迁移提示
  - WorkspacePage 并行加载块新增 `useWorldRulesStore.getState().loadProfile(pid)`
- **32.10** ✅ tsc + build 验证（2026-05-28）

**文件变更清单**：

| 操作 | 文件 |
|------|------|
| 新增 | `src/lib/types/world-rules.ts` |
| 新增 | `src/stores/world-rules.ts` |
| 新增 | `src/lib/ai/world-rules-manifest.ts` |
| 新增 | `src/components/worldview/WorldRulesPanel.tsx` |
| 修改 | `src/lib/db/schema.ts` — v21 |
| 修改 | `src/lib/types/index.ts` |
| 修改 | `src/lib/types/project.ts` — deprecated creativeMode |
| 修改 | `src/lib/ai/context-builder.ts` |
| 修改 | `src/lib/ai/prompt-seeds.ts` |
| 修改 | `src/components/worldview/WorldviewPanel.tsx` |
| 修改 | `src/components/worldview/WorldviewOriginPanel.tsx` |
| 修改 | `src/components/worldview/WorldviewNaturalPanel.tsx` |
| 修改 | `src/components/worldview/WorldviewHumanityPanel.tsx` |
| 修改 | `src/components/outline/OutlinePanel.tsx` |
| 修改 | `src/lib/ai/batch-outline-runner.ts` |
| 修改 | `src/lib/ai/adapters/outline-adapter.ts` |
| 修改 | `src/components/layout/sidebar-tree.ts` |
| 修改 | `src/pages/WorkspacePage.tsx` |

### Phase 28.4 — 导入分卷支持

> 来源：社区反馈 | 状态：未开始

- 识别卷标题（「第一卷 xxx」「卷一」等）自动分卷
- 支持手动拖拽分卷

### Phase 30.2 — 角色关系自动提取

> 来源：社区用户 | 状态：未开始

- 数据源：大纲摘要 + 细纲场景 + 章节正文
- AI 输出 JSON `[{char1, char2, type, description}]`
- 关系类型：亲属、恋人、朋友、对手、敌人、师徒、盟友、上下级、其他
- 去重：同对角色同类型关系跳过已存在
- 新增 prompt seed：`relation.extract`

### Phase 30.5 — 导入去重增强

> 来源：社区用户 | 状态：未开始 | 与 Phase 28.1 协同

- 世界观字段：句子级相似度过滤（本地计算，无需 AI）
- 角色按名字聚合：同名角色合并为一张卡片
- 项目参考中角色手动合并：多选 → 合并字段 → 自定义名称
- 大纲按内容去重：相似度高的章节提示用户确认

---

## 🟡 优先级：中-高

### Phase 33 — ✅ NVIDIA NIM API 接入（2026-05-28）

> 来源：社区反馈（长耳朵兔子） | 状态：已完成

**背景**：NVIDIA NIM（`integrate.api.nvidia.com`）提供 OpenAI 兼容的 `/v1/chat/completions` 接口。浏览器直接请求存在 CORS 限制，通过 vite dev server 代理转发。

**实现内容**：
- `AIProvider` 新增 `'nvidia'` 类型
- 预置 7 个模型：Llama 3.3 70B / Llama 3.1 405B / Llama 3.1 70B / DeepSeek R1 / Qwen 2.5 72B / Gemma 2 27B / Mistral Large 2
- 本地代理：`/nvidia-proxy` → `https://integrate.api.nvidia.com`
- 设置面板：NVIDIA NIM 选项 + 一键代理切换
- `client.ts` 无需改动（NIM 兼容 OpenAI 协议，走默认分支）

| 操作 | 文件 |
|------|------|
| 修改 | `vite.config.ts` |
| 修改 | `src/lib/types/ai.ts` |
| 修改 | `src/components/settings/AIConfigPanel.tsx` |

---

### Phase 26.3 — 角色驱动剧情模式

> 来源：社区反馈 | 状态：未开始

- 用户设定角色的「初始状态」和「目标状态/结局」
- AI 根据两端状态 + 世界观约束，生成中间情节/大纲
- 与现有大纲系统集成：生成结果可导入为卷/章结构

### Phase 26.4 — 灵感反推入口

> 来源：社区反馈 | 状态：未开始

- 项目概况或独立面板，用户写碎片想法
- AI 反向生成：世界观草稿、故事核心、初始角色卡
- 生成结果填入对应模块，用户可二次编辑

### ~~Phase 31.3 — creativeMode 联动题材包~~

> ~~来源：内部审查~~ | 状态：**已被 Phase 32 取代**（Phase 32 去掉了 creativeMode 二选一，改为维度级世界规则体系）

---

## 🟢 优先级：中

### Phase 25.4 — 多世界系统实现

> 来源：产品梳理 | 状态：设计文档已完成（`docs/MULTI-WORLD-DESIGN.md`），代码未开始

设计方案要点（详见设计文档）：
- 世界树节点绑定独立世界观/力量体系/地理数据
- 世界间传送门/通道连接
- 章节/大纲关联所属世界
- 支持诸天流、无限流、平行世界、快穿、修仙多界等题材
- 主角跨世界状态继承与限制

### Phase 30 补充 — 解析增强

> 来源：社区用户 | 状态：未开始

- 章节标题支持 `**标题**摘要` 无冒号格式（`parseChapterOutlineOutput` 增加格式）
- 细纲场景提取降级处理（`parseEnhancedDetailResult` JSON 解析失败时正则降级）

---

## 🔵 优先级：低（远期）

### Phase 27 — AI Agent 化

> 来源：社区反馈 | 状态：概念阶段，需 tool calling / agent 架构重构

- **27.1** 架构评估：当前流式聊天 → 支持 tool calling 的 agent 模式
- **27.2** 历史考证助手：构思场景时 AI 自动检索世界观历史设定 + 联想相关史实
- **27.3** NPC 自动演进：后台异步推演 NPC 故事线，在合适时机向作者推荐

### 未规划 / 长期考虑

| 功能 | 来源 | 备注 |
|------|------|------|
| 协同编辑 | 02-FEATURE-SPEC | 需要后端，当前纯前端架构不支持 |
| WebDAV/坚果云导出 | 02-FEATURE-SPEC | 需 CORS 代理 |
| 国际化 i18n | 02-FEATURE-SPEC | 当前仅中文，架构预留 |
| 移动端适配 | 02-FEATURE-SPEC | 创作工具不适合手机，低优先级 |
| Vercel Serverless 代理 | PROGRESS.md | 解决 CORS 限制的 OpenAI/Claude/Kimi |
| TipTap 富文本编辑器优化 | Phase 24 | 长期目标，已有基础 |

---

## Phase 间关联

```
Phase 28.1（分析去重）←→ Phase 30.5（导入去重）—— 同方向，28 偏展示，30 偏导入
Phase 30.2（关系提取）→ Phase 26.2（角色权重注入）—— 提取的数据可直接用于权重系统
Phase 28.3（全书总结）→ 大师洞察系统 —— 总结可直接作为洞察注入创作 prompt
Phase 26.3（角色驱动）+ Phase 26.4（灵感反推）—— 共同解决「自下而上创作」的需求
Phase 25.4（多世界）—— 独立大模块，不阻塞其他 Phase
Phase 27（Agent）—— 远期架构升级，28.1 智能合并未来可升级为 Agent 多步推理
Phase 32（真实与幻想）→ 取代 Phase 31.3（creativeMode 联动），改造所有下游 prompt 注入
```

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
