# StoryForge 更新日志

> 按时间倒序排列，每个 Phase 标注完成日期和详细改动。

---

## 2026-05-28

### Phase 33 — NVIDIA NIM API 接入

**来源**：社区反馈（用户「长耳朵兔子」）

为 StoryForge 新增 NVIDIA NIM 作为 AI 提供商。NVIDIA NIM 平台托管了多家开源大模型（Llama、DeepSeek、Qwen、Gemma、Mistral 等），使用 OpenAI 兼容协议，用户可通过 NVIDIA 账号获取 API Key 后直接使用。

**新增内容**：

- **AI 提供商**：`AIProvider` 类型新增 `'nvidia'`
- **预置模型**（7 个）：
  - `meta/llama-3.3-70b-instruct` — Llama 3.3 70B（默认推荐）
  - `meta/llama-3.1-405b-instruct` — Llama 3.1 405B（最强开源模型）
  - `meta/llama-3.1-70b-instruct` — Llama 3.1 70B
  - `deepseek-ai/deepseek-r1` — DeepSeek R1 推理模型
  - `qwen/qwen2.5-72b-instruct` — 通义千问 2.5 72B
  - `google/gemma-2-27b-it` — Google Gemma 2 27B
  - `mistralai/mistral-large-2-instruct` — Mistral Large 2
- **本地代理**：vite dev server 新增 `/nvidia-proxy` → `https://integrate.api.nvidia.com` 转发规则，解决浏览器 CORS 限制
- **设置面板**：NVIDIA NIM 选项（带 CORS 警告标记），支持一键「切换到本地代理」/「恢复直连」
- **零改动兼容**：NIM 完全兼容 OpenAI `/v1/chat/completions` 协议，`client.ts` 的 `buildRequest` + SSE 流式解析无需任何修改，`stream_options` 默认支持

**改动文件**：
| 文件 | 改动 |
|------|------|
| `src/lib/types/ai.ts` | `AIProvider` 增加 `'nvidia'`；`PROVIDER_MODELS` 增加 7 个模型；`PROVIDER_PRESETS` 增加默认 baseUrl 和模型 |
| `vite.config.ts` | `server.proxy` 增加 `/nvidia-proxy` 规则 |
| `src/components/settings/AIConfigPanel.tsx` | `PROVIDER_OPTIONS` 增加 NVIDIA NIM；`PROXY_MAP` 增加代理映射 |

---

### Phase 32 — 真实与幻想（世界规则体系）

**来源**：内部审查，取代旧的 `creativeMode` 二选一模式

将历史考证从「项目级二选一开关（fantasy/historical）」彻底重构为「维度级约束声明」系统。用户可在 15 个大类、约 50 个子类的任何维度上独立声明哪些内容取自真实历史、哪些是架空改造，AI 生成时自动遵守所有约束。

#### 32.1 — 数据模型 + DB v21

- 新增 `WorldRulesProfile` 类型：包含 `entries`（每节点的规则条目）、`customNodes`（用户自定义节点）、`globalNote`（全局补充说明）
- `WorldRuleEntry` 结构：`historicalAnchors`（真实锚点文本）、`fictionalAdaptations`（架空改造文本）、`priority`（冲突优先级：history-first / fiction-first / balanced）
- 三级树：15 个 L1 大类（时代背景、重大事件、地理疆域、气候环境、政治制度、军事、经济、社会结构、科技生产力、文化思想、宗教信仰、民族族群、语言称谓、日常生活、力量与超自然），每个 L1 包含 2-6 个 L2 子类，L3 为提示标签
- DB 升级到 v21，新增 `worldRulesProfiles` 表（每项目一条记录，singleton 模式）

**新增文件**：`src/lib/types/world-rules.ts`

#### 32.2 — Store（singleton 模式）

- Zustand store：`useWorldRulesStore`
- 方法：`loadProfile` / `getEntry` / `updateEntry` / `deleteEntry` / `updateGlobalNote` / `addCustomNode` / `updateCustomNode` / `deleteCustomNode` / `filledCount`
- `_persist` 内部方法自动同步到 IndexedDB

**新增文件**：`src/stores/world-rules.ts`

#### 32.3 — 规则清单生成器

- `buildWorldRulesManifest(profile, options)`：从所有 entries 生成结构化文本清单
  - 按 L1 分组，L2 缩进展示
  - 📜 真实锚点 + ✨ 架空改造 + ⚖️ 冲突优先级
  - 可选注入历史年表锚点（`⚓ 时间线锚定`）和历史关键词
  - 全局补充说明追加到末尾
  - 末尾添加 AI 行为约束指令
- `estimateManifestTokens(text)`：Token 估算（字符数 × 0.6）
- `buildWorldRulesContext(projectId)`：一站式读取 DB（profile + 历史年表 + 历史关键词）→ 生成清单，所有 AI prompt 统一调用此函数

**新增文件**：`src/lib/ai/world-rules-manifest.ts`

#### 32.4 — WorldRulesPanel UI

- 三栏布局：L1 导航列表（左）→ L2 子类列表（中）→ 编辑区（右）
- 编辑区包含：📜 真实锚点文本框 + ✨ 架空改造文本框 + ⚖️ 冲突优先级三选一
- L3 提示标签以灰色 tag 形式展示在编辑区
- 已填节点显示绿色圆点标记
- 底部「规则清单预览」：实时生成 manifest 文本 + Token 估算
- 全局补充说明编辑器
- 用户可新增 L1 大类和 L2 子类（自定义节点），支持删除

**新增文件**：`src/components/worldview/WorldRulesPanel.tsx`

#### 32.5 — 世界观三面板去除二选一 toggle

- **WorldviewOriginPanel**（世界起源）：
  - 删除 `creativeMode` 导入和状态管理
  - 合并 `FANTASY_FIELDS` / `HISTORICAL_FIELDS` 为统一 `FIELDS` 数组
  - 标签统一化（如「神明设定」+「宗教与民间信仰」→「神明与信仰」）
  - AI 生成注入 `worldRulesContext`
- **WorldviewNaturalPanel**（自然环境）：同上模式改造
- **WorldviewHumanityPanel**（人文环境）：同上模式改造
- **WorldviewPanel**（世界观总览/旧入口）：
  - 删除模式切换 UI 和 `handleModeChange`
  - 统一使用单一 `DIMENSIONS` 数组
  - AI 生成注入 `worldRulesContext`

**改动文件**：4 个 Panel 组件

#### 32.6 — 下游 prompt 全面改造

- **prompt-seeds.ts**（3 个 system prompt + 4 个 user template）：
  - 删除所有 `{{#if (eq creativeMode "historical")}}...{{else}}...{{/if}}` Handlebars 分支
  - 替换为统一的 `{{#if worldRulesContext}}` 约束注入块
  - `variables` 数组：移除 `creativeMode` / `historicalContext`，新增 `worldRulesContext`
- **outline-adapter.ts**：
  - `buildVolumeOutlinePrompt` / `buildChapterOutlinePrompt` 参数从 `historicalContext + creativeMode` 改为 `worldRulesContext`
- **batch-outline-runner.ts**：
  - `BatchOutlineOptions` 接口同步更新

**改动文件**：`prompt-seeds.ts`、`outline-adapter.ts`、`batch-outline-runner.ts`、`OutlinePanel.tsx`

#### 32.7 — 侧边栏 + 路由

- 侧边栏世界观子树第一项新增「⚖️ 真实与幻想」（使用 lucide-react 的 `Scale` 图标）
- `WorkspacePage` 注册 `world-rules` → `WorldRulesPanel`
- 项目加载时并行调用 `useWorldRulesStore.getState().loadProfile(pid)`

**改动文件**：`sidebar-tree.ts`、`WorkspacePage.tsx`

#### 32.8 — 历史年表锚点标识

- `HistoryPanel.tsx` 中的历史事件标签视觉升级：
  - `isHistorical: true` 的事件：标签从「史实」改为「⚓ 史实锚点」，新增「AI 不可违反」红色提示文字
  - `isHistorical: false` 的事件：标签从「虚构/架空」改为「✨ 虚构/架空」
- 与世界规则清单联动：`buildWorldRulesManifest` 自动读取 `isHistorical=true` 的年表事件作为时间线锚点

**改动文件**：`HistoryPanel.tsx`

#### 32.9 — 数据迁移（旧项目兼容）

- `world-rules.ts` store 的 `loadProfile` 方法：首次创建 profile 时自动检测 `project.creativeMode === 'historical'`
- 如果是旧的历史考证项目，自动填充 `globalNote` 迁移提示文字，引导用户在各维度中重新设定真实与架空规则
- 非历史项目不受影响（`globalNote` 为空）

**改动文件**：`world-rules.ts`

#### 32.10 — 编译验证

- `npx tsc --noEmit` 零错误
- `npm run build` 成功，主 bundle 2630 KB（较改造前 2643 KB 减小 13 KB，因删除了大量重复字段定义和模式切换代码）

---

**Phase 32 完整文件变更清单**：

| 操作 | 文件 |
|------|------|
| 新增 | `src/lib/types/world-rules.ts` |
| 新增 | `src/stores/world-rules.ts` |
| 新增 | `src/lib/ai/world-rules-manifest.ts` |
| 新增 | `src/components/worldview/WorldRulesPanel.tsx` |
| 修改 | `src/lib/db/schema.ts` — v21，新增 `worldRulesProfiles` 表 |
| 修改 | `src/lib/types/index.ts` |
| 修改 | `src/lib/types/project.ts` — deprecated `creativeMode` |
| 修改 | `src/lib/ai/context-builder.ts` |
| 修改 | `src/lib/ai/prompt-seeds.ts` — 3 个 system + 4 个 user template |
| 修改 | `src/lib/ai/adapters/outline-adapter.ts` |
| 修改 | `src/lib/ai/batch-outline-runner.ts` |
| 修改 | `src/components/worldview/WorldviewPanel.tsx` |
| 修改 | `src/components/worldview/WorldviewOriginPanel.tsx` |
| 修改 | `src/components/worldview/WorldviewNaturalPanel.tsx` |
| 修改 | `src/components/worldview/WorldviewHumanityPanel.tsx` |
| 修改 | `src/components/outline/OutlinePanel.tsx` |
| 修改 | `src/components/history/HistoryPanel.tsx` |
| 修改 | `src/components/layout/sidebar-tree.ts` |
| 修改 | `src/pages/WorkspacePage.tsx` |
