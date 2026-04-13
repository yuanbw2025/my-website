# 🧠 具有时序追踪属性的跨周期工作记忆 (WORKING MEMORY)

> **使用说明**：任何接手的 AI 在动手第一秒必须优先读取全篇文档。任何改变项目的举措，无论是增加了一句打印语句还是推翻了整个重构架构，都必须在这里附带时分秒 `[HH:MM:SS]` 留底。绝无例外！

---

## 📅 开发节点台账 (Development Logs)

*这是用于精细回溯的操作日志。严禁以覆盖的方式修改过去的节点。必须**从最上方插入最新一条记录***。

- **[01:30:00] (2026-04-13)**: [赛博飞剑 Monobuild 集成完成] 将 cyber-flying-sword 子项目完整集成到主仓库：① 修改 `build.mjs` 新增 Step 3 构建 cyber-flying-sword；② `vercel.json` 新增 SPA rewrite；③ `.gitignore` 排除 node_modules/dist/；④ `index.html` 游戏面板新增赛博飞剑卡片+i18n；⑤ 创建项目骨架（package.json/tsconfig/vite.config/src/*）；⑥ 复制 4 份核心文档（PROJECT_BIBLE/GDD/TDD/手势参考）；⑦ 更新 PROJECT_PLAN.md v6.0（五大仓库架构）；⑧ 更新 README.md（目录结构+部署架构+更新日志）；⑨ 更新 WORKING_MEMORY.md。待办：创建独立公开仓库 yuanbw2025/cyber-flying-sword。
- **[22:40:00] (2026-04-12)**: [Phase 7 文档收尾 + 推送] 更新 PROGRESS.md（新增 Phase 7 多渠道分发 + 用户反馈的架构问题）、WORKING_MEMORY.md（今日全部交互记录）、.gitignore（排除 _reference/）。同步 yuntype 到独立仓库并推送两个仓库。
- **[21:30:00] (2026-04-12)**: [参考资料收集] 用户提供两个参考项目 ZIP 下载，已解压到 `_reference/` 目录：① awesome-design-md（66套 DESIGN.md，Google Stitch 概念）② ui-ux-pro-max-skill（67种 UI 风格 + 161条推理规则，AI设计智能 Skill）。这两个项目展示了真正的"多版式"设计思路，可作为布局重构灵感来源。
- **[20:45:00] (2026-04-12)**: [🔴 核心架构问题暴露] 用户实测 test-playground.html 后严厉指出：660种组合实际只是"换色"，不是"换版式"。5种排版(T1-T5)仅改 CSS 数值参数（字号/行高/间距），HTML 结构完全一致。用户原话："版式定好之后，纯改色的东西，完全不是我想要的"。用户期望：极简排版只强调标题、线条主导版式、图形模块丰富版式、图片突出留位版式等。此问题是渲染引擎架构级缺陷，影响所有渠道（Web App / MCP / Skill / Playground），需在下一阶段彻底重构。同时 Playground 缺少小红书平台入口。
- **[19:00:00] (2026-04-12)**: [测试 Playground 创建] 用户无 API Key 想测试 MCP 工具效果。创建 `test-playground.html`（独立HTML，内嵌完整渲染引擎）：左侧8个预设按钮+4个四维度选择器+随机组合+复制按钮，右侧 Markdown 编辑器+实时预览。同时创建 `test-preview.html`（静态预览科技极光预设效果）。
- **[17:30:00] (2026-04-12)**: [Complete Skill 完整版 + README 更新] 创建 `skill/yuntype-complete-skill.md`（~400行），内嵌全部原子数据（11色hex值+5排版参数+4装饰HTML模板+3字体参数+15种文章类型映射+渲染规则），用户可导入 Claude Pro / Gemini Advanced 的 Artifacts/Canvas 中无 API Key 使用。更新 README.md 将完整版标记为 ⭐推荐。
- **[16:00:00] (2026-04-12)**: [Phase 7 MCP Server + Skill 基础版] MCP Server 构建完成（`mcp-server/src/index.ts`：4工具+1资源），注册到 Cline 配置并验证通过。Prompt Skill 基础版 `skill/yuntype-skill.md` 创建完成。
- **[15:35:10] (2026-04-07)**: [架构文档重构竣工] 全面改写了 `PROJECT_PLAN.md` 架构蓝图，理清了 Vercel 下的合并构建管线机理；创立了严酷版的 `AI_HANDOVER_GUIDE.md` 针对基础级大模型进行了事前通报与冲突侦测约束。并且重塑了当前的 `WORKING_MEMORY.md` 开始引入时序表机制。所有文档即将执行 Git 推送合并收官。
- **[14:53:00] (2026-04-07)**: [后门密匙阻断] 彻底去除了 `api/v2/telemetry-sync.js` 第 12 行潜伏的 `I08A` 硬编码泄露代码。强制要求读 Vercel 的 `SECRET_GEMINI_KEY`；完善了应对 500 和前端请求兼容性的强防抖机制并成功推送。
- **[07:15:00] (2026-04-07)**: [Monobuild 合流修复] 根据主站特性编写了 `build.mjs`，将原本孤岛一样的工具库构建打包进主目录的 `/public` 中进行 SPA 同源路由分发解析，消灭了从门户切子系统必然发生的 Vercel 404 挂死问题。

---

## 🏛 核心运作上下文精炼 (Context Flash)

- 这是一个在主私人库里包办所有的 **混合构建（Monobuild）网络体系**。主门面使用 Vanilla 技术流；子工具走 React。
- 绝密环境变数：所有后端 Serverless 的外呼认证全部只且必须走 `process.env.XXXX`，一旦明文进源代码即视为破坏红线。
- 只有被明确记录并在 `build.mjs` 中登记聚合的子项目，才能在线上 `vercel.app` 中渲染显示，不要迷信本地 `npm run dev`。
- **[2026-04-12 新增]** 云中书 YunType 的排版系统(T1-T5)存在架构缺陷：仅改CSS参数不改HTML结构。下一阶段需彻底重构为真正的多版式系统。参考资料在 `_reference/` 目录。
- **[2026-04-12 新增]** 云中书多渠道分发已就绪：MCP Server（`yuntype/mcp-server/`）、Prompt Skill 基础版+完整版（`yuntype/skill/`）、测试 Playground（`yuntype/test-playground.html`）。完整版 Skill 是推荐方案，无需 API Key。

- **[19:07:00] (2026-04-07)**: [架构级降级策略上线] 在后端层实现了循环探测机制，支持跨版本（v1/v1beta）模型自动切换。
- **[19:55:00] (2026-04-07)**: [对齐同步] 同步了 `skill-compiler.ts` 的模型方案映射。
- **[20:53:00] (2026-04-07)**: [最终重构] 优化了 `telemetry-sync.js` 的错误透传能力，将主攻方向锁定为 Gemini 2.5。

- **[11:35:00] (2026-04-08)**: [游戏页面集成上线] 将 `game.html`（飞剑弹珠游戏）正式集成进主站部署流水线：修改 `index.html` 游戏卡片链接指向 `/game.html`；在 `build.mjs` 中新增 `game.html` 的复制逻辑，确保 Vercel 构建产物包含游戏页面。
- **[09:55:00] (2026-04-08)**: [额度监控系统大版本更新] 
  - **后端**：`telemetry-sync.js` 全面支持 429 错误捕捉与重置时间计算，返回 `_quota` 元数据。
  - **前端**：引入 `QuotaTracker` 类，利用 `localStorage` 缓存每日配额状态（80次/天），实现"请求前拦截"机制。
  - **UX**：在进度条和完成信息中实时反馈每日剩余额度。

---
*End of Memory*
