# Changelog

## v2.0.0 — 2026-05-26 · Phase A-H 全量进化

> 一次性实现 8 个大版本（Phase A → H），覆盖记忆系统、故事线、伏笔增强、大纲强化、题材风格、质量控制、角色增强、导出优化共 25+ 个子功能模块。

---

### Phase A — 三层记忆系统

| 子模块 | 说明 |
|---|---|
| **A1 状态表自动提取** | AI 生成正文后自动提取角色/地点/物品/势力的状态变更（StateDiffModal 支持跳过） |
| **A2 三层记忆架构** | Working Memory（当前章节+近3章摘要）、Episodic Memory（状态卡+事件+关系变动）、Semantic Memory（世界观+角色+故事线+伏笔），按任务类型分配 token 预算 |
| **A3 章节摘要** | AI 自动生成 100-200 字章节摘要，用于 Working Memory 注入 |
| **A4 事件时间线** | 状态表新增"时间线"视图，事件按章节时间轴展示 |
| **A5 情感节拍卡** | 每章自动分析情绪走向，生成情感节拍可视化 |

**新增文件**：`memory-builder.ts` · `summary-adapter.ts` · `EventTimeline.tsx`

---

### Phase B — 全局故事线

| 子模块 | 说明 |
|---|---|
| **B1 数据模型** | `StoryArc`（主线/支线）→ `StoryStage[]`（阶段，含关键事件、转折点） |
| **B2 故事线面板** | Tab 切换多条线、手动添加/AI 生成、阶段卡编辑、进度条可视化 |
| **B3 上下文注入** | `buildStoryArcContext()` 自动注入 AI 写作 prompt |

**新增文件**：`story-arc.ts`(类型) · `story-arc.ts`(store) · `story-arc-adapter.ts` · `StoryArcPanel.tsx`

---

### Phase C — 伏笔系统增强

| 子模块 | 说明 |
|---|---|
| **C1 逾期检测** | `getOverdue()` / `getUpcoming()` / `computeUrgency()` — 自动判断 critical/high/medium/low |
| **C2 伏笔上下文注入** | `buildForeshadowContext()` — 按章节生成 [埋设]/[回收]/[呼应]/[逾期!] 标记注入 prompt |
| **C3 AI 伏笔建议** | `buildForeshadowSuggestPrompt()` — 根据故事线+已有伏笔+大纲建议 3-5 个新伏笔 |

**新增字段**：`expectedResolveChapterId` · `importance` · `urgency`

---

### Phase D — 大纲流程强化

| 子模块 | 说明 |
|---|---|
| **D1 批量生成** | `batch-outline-runner.ts` — 按卷循环生成章节大纲，前一卷摘要自动作为下一卷上下文，支持进度条和中途取消 |
| **D2 细纲增强** | `DetailedOutline` 新增 6 字段：开头衔接 / 结尾悬念 / 场景地点 / 情绪走向 / 出场角色 / 关联伏笔 |
| **D3 大纲预览** | `OutlinePreview.tsx` — 编辑器内一键查看章节聚合信息（摘要、角色、伏笔、场景列表） |

**新增文件**：`batch-outline-runner.ts` · `OutlinePreview.tsx`

---

### Phase E — 题材模板 + 风格系统

| 子模块 | 说明 |
|---|---|
| **E1 题材元数据** | 20 个题材完整元数据（反模式清单、节奏策略、典型结构），GENRE_PACKS 从 5 扩充到 21 个 |
| **E2 写作风格预设** | 11 个风格预设：金庸武侠 / 古龙 / 张爱玲 / 鲁迅 / 网文爽文 / 纯文学 / 轻小说 / 硬核科幻 / 黑色幽默 / 暗黑哥特 / 现代极简 |
| **E3 创作方法论** | 5 种方法论：雪花法 / 英雄之旅(12阶段) / 三幕式 / 起承转合 / 救猫咪节拍表(15节拍) |

**新增文件**：`genre-metadata.ts` · `writing-styles.ts` · `methodology.ts`  
**新增字段**：`Project.writingStyleId` · `Project.methodologyId`

---

### Phase F — 质量控制三件套

| 子模块 | 说明 |
|---|---|
| **F1 章节审校** | 五维检测（逻辑一致性 / 人物行为 / 世界观 / 伏笔衔接 / 情节节奏），0-100 评分 + 逐条问题定位 |
| **F2 去AI味增强** | 五维检测（词汇 / 句法 / 叙事 / 情感 / 对话）+ 高频词统计，输出"人味指数" |
| **F3 追读力评估** | 四维评估（悬念钩子 / 爽点 / 微兑现 / 节奏），0-100 追读力评分 + 亮点&薄弱分析 |

**新增文件**：`review-adapter.ts` · `anti-ai-adapter.ts` · `readability-adapter.ts` · `ReviewPanel.tsx`

---

### Phase G — 角色 + 设定增强

| 子模块 | 说明 |
|---|---|
| **G1 角色动态状态** | `getCharacterState()` — 从状态卡实时获取角色当前位置、实力、持有物品等 |
| **G2 出场章节追踪** | `Character` 新增 `firstAppearChapterId` / `activeChapterRange` / `exitChapterId`，AI 写作时自动过滤未出场/已退场角色 |

**新增字段**：`Character.firstAppearChapterId` · `Character.activeChapterRange` · `Character.exitChapterId`

---

### Phase H — 导出 + 体验优化

| 子模块 | 说明 |
|---|---|
| **H1 HTML 导出** | 带样式排版的单页 HTML（宋体排版 + 目录 + 角色设定 + 世界观），可选包含内容 |
| **H3 便签系统** | 6 色便签 + 置顶 + 章节关联，编辑器侧边快速查阅，DB v17 新增 `notes` 表 |

**新增文件**：`html-builder.ts` · `note.ts`(类型) · `note.ts`(store) · `NotePanel.tsx`

---

### 编辑器工具栏新增

编辑器顶部新增三个切换按钮：

| 按钮 | 功能 |
|---|---|
| 📖 **大纲预览** | 展开当前章节的聚合信息面板（D3） |
| 🛡 **质量审校** | 展开审校/去AI味/追读力三合一面板（F） |
| 📝 **便签** | 展开便签面板，支持本章/全局/全部筛选（H3） |

---

### 数据库变更

- **v16**：新增 `storyArcs` 表
- **v17**：新增 `notes` 表
