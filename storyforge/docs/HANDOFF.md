# 🔄 换机交接手册（HANDOFF）

> **本文档是 AI 助手换机/换会话时的唯一交接依据。**
> 任何新 Claude / Sonnet / Gemini 会话第一件事必须完整读完此文档。
> 最近更新：Phase 0 完成、即将启动 Phase 1
> 由 Opus 4.7 撰写于 2026-05-06

---

## 0. 给新会话的开场指令模板

> 用户请把以下文字粘贴给新 Claude 会话作为第一句话：
>
> ```
> 请完整读取 docs/HANDOFF.md，然后告诉我你理解到的当前状态、
> 下一步要做什么、以及你需要我做什么。读完后等我确认再开始动手。
> ```

---

## 1. 项目身份

- **GitHub 用户**：yuanbw2025
- **个人网站**：https://yuanbw.vercel.app/（"悬象 · Xuán Xiàng"）
- **沟通语言**：简体中文，代码和注释可用英文
- **协作模式**：用户授权 AI 全权进行开发、git push/pull、建仓
- **当前正在开发的子项目**：StoryForge（故事熔炉，AI 辅助小说创作）

---

## 2. 仓库地图（双仓库模式）

```
E:\MYgithub\
├── my-website\      ← 🔒 私有主库（Vercel 唯一部署入口）
│   └── storyforge\  ← 主库内的 StoryForge 子项目
├── storyforge\      ← 🌐 公开镜像（社区下载）
├── infiniteskill\   ← 其他子项目
├── yuntype\
├── cyber-flying-sword\
├── flying-sword-pinball\
└── Infinite_SpatioTemporal_Map\
```

### 双仓库同步规则（铁律）

- **开发改动只在 `E:\MYgithub\storyforge\` 进行**
- 推送 storyforge 镜像后，**手动 cp 同步**到 `E:\MYgithub\my-website\storyforge\`
- 然后在 `my-website` 也 commit + push
- 永远保持两个仓库内容**逐字节一致**

### 同步命令模板

```bash
SRC="E:/MYgithub/storyforge"
DEST="E:/MYgithub/my-website/storyforge"

# 同步源代码
cp -r "$SRC/src/." "$DEST/src/"
cp -r "$SRC/docs/." "$DEST/docs/"
cp "$SRC/package.json" "$DEST/package.json"
# 按需追加其他改动文件

cd E:/MYgithub/my-website
git add storyforge/
git commit -m "sync(storyforge): <概述>"
git push origin main
```

---

## 3. 当前 Git 状态（2026-05-06）

**最新 commit hash**（换机后 git pull 验证一致）：

| 仓库 | HEAD | 内容 |
|------|------|------|
| storyforge | `07beda2` | feat(phase-00): 流派标签数据集 + Playbook 体系建立 |
| my-website | `2eac11d` | sync(storyforge): phase-00 流派标签数据 + Playbook 体系 |
| infiniteskill | `8b59dae` | docs: 双语 README |
| yuntype | `da5f7a1` | ci: Gitee auto-deploy |
| cyber-flying-sword | `5310578` | ci: Gitee auto-deploy |
| flying-sword-pinball | `878d968` | feat: initial release v2.0 |
| Infinite_SpatioTemporal_Map | `4fa17aa` | Initial infra |

**所有仓库本地与远端完全同步**。换机后只需 `git clone` 或 `git pull` 即可拿到最全状态。

---

## 4. 当前开发任务：StoryForge 全面 UI/UX 重构（v3 重设计）

### 战略文档（必读）

- 📜 `docs/09-REDESIGN-INTEGRATION-PLAN.md` —— v3 战略文档（约 1300 行）
- 📋 `docs/playbooks/TEMPLATE.md` —— Playbook 标准模板
- 📋 `docs/playbooks/PHASE-00-genre-web-search.md` —— Phase 0 完整执行手册（已完成）

### 用户的核心诉求（3 句话总结）

1. **侧边栏改成四分区三级层级**：著作信息 / 设定库 / 创作区 / 设置区
2. **流派标签扩展**：从 8 条扩展到 70+ 条，参考起点/纵横/晋江三大平台
3. **AI 是核心特色**：每个创作模块都要 AI 一键生成按钮；提示词系统**对用户开放自定义**（关键差异化卖点）

### 开发分 12 个 Phase

| Phase | 内容 | 状态 |
|-------|------|------|
| **P0** | 流派标签数据 + Playbook 体系 | ✅ **已完成** |
| **P1** | 提示词基础设施（promptTemplates 表 + 渲染引擎 + 适配器） | 🔄 **下一步** |
| P2 | 提示词管理 UI | ⏸ 待办 |
| P3 | Dexie v6 schema 重建 + 依赖修复 | ⏸ |
| P4 | 侧边栏导航三级重建 | ⏸ |
| P5 | 著作信息面板（多选流派 + 状态栏） | ⏸ |
| P6 | 世界观大面板（整合 6 个旧模块） | ⏸ |
| P7 | 角色设计四级显示 + 关系图保留 | ⏸ |
| P8 | 创作区六模块（创作规则/大纲/细纲/章节/正文/伏笔，每个加 AI 按钮） | ⏸ |
| P9 | 概念地图（Voronoi 程序生成 + AI 视觉解析占位） | ⏸ |
| P10 | AI 解析导入（支持 .docx/.xlsx/.csv/.txt/.md） | ⏸ |
| P11 | UI 走查 + token 替换 + 主题验证 | ⏸ |

### 工作流（关键决策）

```
Phase N 启动前 → Opus 写 Playbook
Phase N 执行   → Sonnet 跟着 Playbook 干（P0/P1 由 Opus 自己执行）
Phase N 验收   → Opus 抽查（运行 § 7 全功能巡检）
Phase N 完成   → 进入 Phase N+1
```

**"Opus 设计 + Sonnet 执行 + Opus 验收"** 模式，成本最优。

---

## 5. Phase 0 已完成内容

### 产出

- ✅ `src/lib/data/genre-presets.ts` —— 77 条流派标签（48 male + 19 female + 10 general）
- ✅ `docs/09-REDESIGN-INTEGRATION-PLAN.md` —— v3 战略文档
- ✅ `docs/playbooks/TEMPLATE.md`
- ✅ `docs/playbooks/PHASE-00-genre-web-search.md`
- ✅ 双仓库已 push

### Phase 0 中的重要决策

1. **WebFetch 三站均失败**（页面 JS 渲染/反爬虫），降级使用人工对照三站分类整理的 77 条数据
2. **决议 1**：保留细纲（Phase 8 实现）
3. **决议 2**：暂用 Sonnet 提案的章节/正文拆法，先做了再说
4. **决议 3**：暂用 Sonnet 提案的伏笔时间线 + 大纲极简化方案
5. **决议 4**：保留角色关系网络（CharacterRelationPanel 力导图）
6. **决议 5（重要）**：概念地图升级到"程序化奇幻地图（Inkarnate 风格）+ AI 视觉反向解析" → 已写入 Phase 9
7. **决议 6**：题材模板包延后开发，先做基础版本
8. **决议 7**：不考虑旧用户兼容（开发期，无真实用户）→ Phase 3 直接清空数据库
9. **决议 8**：提示词自定义独立成 v3 文档第三章，是核心特色

---

## 6. Phase 1 计划（下一步）

### Phase 1 目标

构建提示词基础设施，让"用户自定义提示词"成为可能。

### Phase 1 改动清单（预计）

#### 新增

- `src/lib/types/prompt.ts` —— PromptTemplate / Variable 类型
- `src/lib/ai/prompt-engine.ts` —— 模板渲染引擎（变量插值 + 校验）
- `src/lib/ai/prompt-seed-data.ts` —— 14+ 系统模板种子数据
- `src/stores/prompt.ts` —— Zustand store
- `src/lib/ai/adapters/` —— 6 个适配器（每个对应一条 AI 链）
  - `worldview-adapter.ts`
  - `character-adapter.ts`
  - `outline-adapter.ts`
  - `chapter-adapter.ts`
  - `editing-adapter.ts`
  - `foreshadow-adapter.ts`

#### 修改

- `src/lib/db/schema.ts` —— Dexie v5 → v6（新增 `promptTemplates` 表）
- 6 个 Panel 组件（worldview/character/outline/chapter/editor/foreshadow）—— 仅改 1~2 行换 import 路径

#### 删除

- `src/lib/ai/prompts/` —— 旧硬编码 prompts 目录（迁移完成后删除）

### 与 Phase 1 相关的 6 条 AI 链路（必须保留）

1. **链 1：世界观生成**（`prompts/worldview.ts` → `worldview-adapter.ts`）
2. **链 2：角色设计**（`prompts/character.ts` → `character-adapter.ts`）
3. **链 3：大纲生成**（`prompts/outline.ts` → `outline-adapter.ts`）
4. **链 5：章节正文写作**（`prompts/chapter.ts` → `chapter-adapter.ts`）
5. **链 6/7：续写/润色/扩写/去AI味**（`prompts/editing.ts` → `editing-adapter.ts`）
6. **链 8：伏笔建议**（`prompts/foreshadow.ts` → `foreshadow-adapter.ts`）

### Phase 1 必须满足的兼容性约束

- **Panel 组件代码改动 ≤ 2 行/文件**（只改 import 路径）
- 现有所有 AI 链跑完后输出**与重构前等价**
- 用户感知不到任何变化（只是底层换骨）
- 只在 Phase 2 之后才暴露"自定义提示词"UI

---

## 7. 用户当前需要做的事

### ⚠️ 阻塞 Phase 1 启动的一件事

清空浏览器 IndexedDB（开发期数据，无真实用户）：

```javascript
// 在浏览器 DevTools Console 执行：
indexedDB.deleteDatabase('storyforge')
```

清完后告诉 AI「清空完毕」即可启动 Phase 1。

---

## 8. 换到新电脑的标准启动流程

### 第一次（克隆双仓库）

```bash
# 在新电脑创建工作目录
mkdir E:\MYgithub
cd E:\MYgithub

# 克隆双仓库
git clone https://github.com/yuanbw2025/my-website.git
git clone https://github.com/yuanbw2025/storyforge.git

# 安装依赖
cd storyforge
npm install --registry https://registry.npmmirror.com

# 验证 build
npm run build
```

### 已克隆过（拉取最新）

```bash
cd E:/MYgithub/storyforge && git pull origin main
cd E:/MYgithub/my-website && git pull origin main
```

### Git 凭据

- 用户已在原电脑用 GCM (Git Credential Manager) 存了 PAT
- **新电脑必须重新登录**：第一次 `git push` 时会弹出 GitHub OAuth/PAT 输入
- **建议**：新电脑直接到 GitHub Settings → Developer Settings → Personal Access Tokens 生成一个新的 PAT（scopes 勾选 `repo`、`workflow`），不要复用旧 token
- 配置完成后 Windows 凭据管理器会自动保存，后续 push/pull 无感

### 启动开发服务器

`E:\MYgithub\.claude\launch.json`（每台电脑各自的本地配置）：

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "storyforge-dev",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev", "--prefix", "storyforge"],
      "port": 5175
    }
  ]
}
```

> 端口选 5175 是因为 5173/5174 在原电脑上被其他进程占用。新电脑可改回 5173。

---

## 9. 用户档案与协作偏好（重要）

### 沟通风格
- 用户希望 AI 把规划讲清楚再动手，**反对自作主张**
- 用户能理解架构，能审查 AI 的方案
- 用户喜欢具体的文档+代码，不喜欢含糊的描述
- 用户有过被 AI"自作主张改坏系统"的不愉快经历

### 关键纪律（来自 AI_HANDOVER_GUIDE.md）

1. ❌ **API Key 绝不硬编码** —— 只用 `process.env.SECRET_GEMINI_KEY`
2. ❌ **不重构 telemetry-sync.js 为 OpenAI SDK 形式** —— 它是 Gemini 原生调用
3. ❌ **根目录不是 Vite 项目** —— 不要给根目录加 vite.config
4. ✅ **每次完成改动后**：在 my-website 的 WORKING_MEMORY.md 顶部插入 `[HH:MM:SS]` 日志条目
5. ✅ **镜像同步是手动的** —— 双仓库改动需要手动 cp 然后双 push
6. ❌ **无占位符** —— 不写 `// 省略`，不清楚就问用户
7. ❌ **改动前必须报告计划等用户确认** —— 不可擅自动手

---

## 10. 已知的待解决问题

### 安全：my-website 的 PAT 暴露

`E:\MYgithub\my-website\.git\config` 中 remote origin URL 含明文 PAT（具体 token 已从此文档脱敏，可在本地 `.git/config` 直接查看）。

**建议**：① GitHub Settings 撤销该 token；② 生成新 token；③ `git remote set-url origin https://github.com/yuanbw2025/my-website.git`（清掉 URL 里的 token，改用 GCM）。

**状态**：待处理。换电脑时 .git/config 不会被克隆带过去（只是本地 push 凭据），但建议在新电脑配置时直接走干净的 PAT 流程。

### 项目状态遗留

- 云中书 YunType 排版系统架构缺陷：T1-T5 仅改 CSS 参数不改 HTML 结构（用户已知，待重构，与 StoryForge 无关）
- 赛博飞剑 MVP 待开发（与 StoryForge 无关）

---

## 11. 完整的功能 Backlog（必读）

> 这份 Backlog 原本在 `C:\Users\yuanj\.claude\projects\E--MYgithub\memory\storyforge_backlog.md`，
> 是机器本地文件不会跟 git 走，所以**完整内容下面镶嵌**。

### 🔴 当前迭代（UI/UX 重构）

- [x] Phase 0：流派标签 + Playbook 体系
- [ ] Phase 1：提示词基础设施
- [ ] Phase 2：提示词管理 UI
- [ ] Phase 3：Dexie v6 schema 重建
- [ ] Phase 4：侧边栏导航三级重建
- [ ] Phase 5：著作信息面板
- [ ] Phase 6：世界观大面板
- [ ] Phase 7：角色设计 + 关系图
- [ ] Phase 8：创作区六模块
- [ ] Phase 9：概念地图（Voronoi + AI 视觉）
- [ ] Phase 10：AI 解析导入（含 .docx/.xlsx）
- [ ] Phase 11：UI 走查

### 🟡 AI 功能迭代

#### AI 一键生成（Phase 6/7/8 各模块）
- [ ] 世界观整体生成（世界设定 + 文明体系 + 力量体系）
- [ ] 故事设计整体生成（故事核心 + 故事结构）
- [ ] 角色设计整体生成（生成主角 + 配角群）
- [ ] 大纲生成
- [ ] 章节续写/生成

#### AI 文档导入（Phase 10）
- [ ] 角色设定文档解析导入
- [ ] 世界观文档解析导入
- [ ] 大纲/故事文档解析导入
- 流程：粘贴文本/上传 .txt/.md/.docx/.xlsx → AI解析 → JSON预览 → 确认写入

#### 提示词系统（Phase 1+2 是基础）
- [ ] 各模块内置提示词模板设计（v3 文档第三章）
- [ ] 提示词对用户开放自定义（高级设置面板）
- [ ] 提示词版本管理（允许用户保存多套提示词方案）
- [ ] **提示词工作流**（链式编排，借鉴蛙蛙写作）
- [ ] **题材模板包**（玄幻/仙侠/言情/硬科幻等，每包 14+ 模板）
- [ ] 题材包社区分享（远期，需后端）
- [ ] A/B 测试两个模板（远期）
- [ ] AI 自动调优提示词（远期）

### 🗺️ 概念地图（Phase 9 升级）

- [ ] 程序化 SVG 奇幻地图生成（基于世界观参数）—— Voronoi + Simplex Noise
- [ ] AI 视觉反向解析（用户上传地图 → 自动填表）
- [ ] AIConfig 加 `visionModel` 字段（支持 Gemini Vision / Claude Vision / GPT-4o）
- [ ] `import.parse-map` 提示词模板（视觉解读专用）
- [ ] 不自研画板，让用户用 Inkarnate 等外部工具

### 🟢 体验优化（后续迭代）

- [ ] 章节状态徽章（未开始/草稿/修改中/完稿/终稿）
- [ ] 写作进度统计（已写字数 vs 目标字数，分章节）
- [ ] 故事结构可视化（三幕/节奏曲线）
- [ ] 大纲节点拖拽排序
- [ ] 角色头像上传
- [ ] 地理地图编辑器（集成现有 GeographyPanel）
- [ ] 深色/浅色/护眼三套主题切换 UI
- [ ] 全局搜索（跨模块检索角色名/地名/关键词）
- [ ] 移动端适配（长期）

---

## 12. 接续会话的预期行为

新会话启动后应该：

1. ✅ **完整读取本文档**
2. ✅ **复述当前状态**：在 Phase 0 完成、Phase 1 待启动
3. ✅ **确认即将做的事**：等用户回「清空完毕」后启动 Phase 1
4. ✅ **询问是否切换模型**：Phase 0/1 推荐 Opus，Phase 2+ 推荐 Sonnet
5. ❌ **不要直接动代码**：必须等用户确认理解一致

---

## 13. 关键文件锚点（速查）

```
docs/
  HANDOFF.md                              ← 你正在读
  09-REDESIGN-INTEGRATION-PLAN.md         ← v3 战略文档
  playbooks/
    TEMPLATE.md                           ← Playbook 标准
    PHASE-00-genre-web-search.md          ← 已完成

src/
  lib/
    data/genre-presets.ts                 ← Phase 0 产出
    types/                                ← 数据类型
    db/schema.ts                          ← Dexie schema（Phase 3 升 v6）
    ai/
      prompts/                            ← 旧硬编码（Phase 1 删除）
  components/
    layout/Sidebar.tsx                    ← Phase 4 重构
    worldview/                            ← Phase 6 整合
    character/CharacterPanel.tsx          ← Phase 7 重构
    outline/OutlinePanel.tsx              ← Phase 8 重构
    editor/ChapterEditor.tsx              ← Phase 8 保留
    foreshadow/ForeshadowPanel.tsx        ← Phase 8 重构
  stores/                                 ← Zustand stores
  pages/
    HomePage.tsx                          ← Phase 5 配套调整
    WorkspacePage.tsx                     ← Phase 4 路由配套
```

---

## 14. 联系/同步备注

- 用户使用一个工作账号 `yuanbw2025`，所有仓库属同一所有者
- 用户邮箱：`yuanjingwende@gmail.com`
- Git 配置已在原电脑设置好（`user.name yuanbw2025` / `user.email yuanjingwende@gmail.com`），新电脑首次运行需要重新设置：

```bash
git config --global user.name "yuanbw2025"
git config --global user.email "yuanjingwende@gmail.com"
```

---

**🟢 此文档为唯一交接依据。读完后等用户确认再开始动手。**
