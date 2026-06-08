# StoryForge 重构交接包(给 5.5 / 其它接手 AI)

> 这个文件夹包含 **GPT 5.5(或任何接手 AI)开始重构 StoryForge 项目** 所需的完整资料。
> 进入这个文件夹 = 你已被分配重构任务,先按下面顺序读完再动手。

---

## ⚠️ 读取顺序(严格按此)

| # | 文件 | 用途 | 必须吗 |
|---|---|---|---|
| 1 | **`/CLAUDE.md`**(仓库根目录) | 🔒 项目宪法:三注册表铁律 + 动手前的「四问」+ 反面教材 | **必读** |
| 2 | `HANDOFF.md` | 🤝 协作契约:分支策略 / 交付物格式 / 卡点处理 / 审查流程 | **必读** |
| 3 | `TARGET-STATE.md` | 🎯 **最终形态规约(北极星)**:代码结构 / 反模式 / 每 Phase 可观察现象 / UX 标准 | **必读** |
| 4 | `/docs/MASTER-BLUEPRINT.md` | 📐 施工权威:Phase 0/1/2/3 完整任务清单 + 三注册表数据结构 | **必读** |
| 5 | `PROJECT_TABLES_ALL.md` | 📋 全部 45 张表硬清单(消除"暂时硬编码"歧义) | 必读 |
| 6 | `/docs/DATA-FLOW-MAP.md` 等 | 历史审计与文档(可按需) | 参考 |

---

## 🎯 你的最终目标

把 StoryForge 重构成 **质量优秀、可参评开源项目大赛得奖** 的项目。

判据:
- 三个注册表(CONTEXT_SOURCES / FIELD_REGISTRY+AdoptionSchema / PROJECT_TABLES)上线并被全项目使用
- 17 个已知 bug 全部根治(根因消除,不是头疼医头)
- 测试覆盖 ≥ 60% + CI 全绿 + tsc strict + ESLint 零警告
- 数据完整性:导出/导入/删除/迁移 **完全可逆,零丢失**
- AI 行为可信:说明书自动从代码生成,与实际一致

---

## 🛑 三条不可触碰的红线

1. **不允许直接 push 到 main 分支**(纯前端 + Vercel 自动部署 = main 即生产)
2. **不允许跳过测试**(每个任务的"验证"步骤必跑)
3. **不允许"先这样吧,等以后再统一"**(头疼医头 = 反复 bug 的根源)

---

## 🤝 你和"审查者"的关系

你(5.5 / 接手 AI) = **实施者**
另一个 AI 模型(默认 Claude) = **审查者**

- 你完成一个任务 → 提交到 `refactor/phase-X-task-Y` 分支
- 审查者按 HANDOFF.md 流程审查
- 审查通过 → 合并到 main(由项目作者执行)
- 审查未通过 → 你打回重做,不允许跳过修复

详细协作规则见 `HANDOFF.md`。

---

## 📂 本文件夹文件清单

```
docs/refactor/
├── README.md              ← 本文件(入口)
├── HANDOFF.md             ← 协作契约
├── TARGET-STATE.md        ← 最终形态规约(北极星)
└── PROJECT_TABLES_ALL.md  ← 45 张表硬清单
```

外部相关文件(仓库其它位置):

```
/CLAUDE.md                          ← 项目宪法(根目录,自动加载)
/AGENTS.md                          ← AI 接手指南(根目录)
/docs/MASTER-BLUEPRINT.md           ← 施工权威(Phase 0/1/2/3)
/docs/DATA-FLOW-MAP.md              ← 历史审计记录
/docs/DATA-FLOW-DIAGRAM.md          ← 数据流可视化(Mermaid)
/docs/ROADMAP.md                    ← 任务索引
/tests/regression/                  ← 反例测试网(部分已就绪)
/src/lib/safety/require-backup-before.ts  ← 数据保护红线(已就绪)
```

---

## ❓ 不知道下一步做什么?

按这个流程走:
1. 读完上面 ⚠️ 区的 1-5 号文件
2. 跑 `npm install && npm test` 确认基础设施可用
3. 打开 `/docs/MASTER-BLUEPRINT.md` §4,找到 **Phase 0 任务 0.1**(`deleteGroup` 事务声明)
4. 按"前置 → 改法 → 验证 → 完成判据"四步执行
5. 完成 → 按 `HANDOFF.md` 规范提交分支 → 通知审查者
6. 审查通过 → 进入下一个任务(0.2)

**任何卡点立即停下,开 issue,等决策。不要"我觉得应该可以"。**
