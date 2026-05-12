import Dexie, { type Table } from 'dexie'
import type {
  Project,
  Worldview,
  StoryCore,
  PowerSystem,
  Character,
  Faction,
  OutlineNode,
  Chapter,
  Foreshadow,
  Geography,
  History,
  ItemSystem,
  CreativeRules,
  CharacterRelation,
  Snapshot,
  Reference,
} from '../types'
import type { PromptTemplate } from '../types/prompt'
import type { DetailedOutline } from '../types/detailed-outline'
import type { ImportJob } from '../types/import-job'
import type { ImportSession, ImportLog } from '../types/import-session'
import type { ImportFileBlob } from '../types/import-file'
import type { PromptWorkflow } from '../types/workflow'

class StoryForgeDB extends Dexie {
  projects!: Table<Project>
  worldviews!: Table<Worldview>
  storyCores!: Table<StoryCore>
  powerSystems!: Table<PowerSystem>
  characters!: Table<Character>
  factions!: Table<Faction>
  outlineNodes!: Table<OutlineNode>
  chapters!: Table<Chapter>
  foreshadows!: Table<Foreshadow>
  geographies!: Table<Geography>
  histories!: Table<History>
  itemSystems!: Table<ItemSystem>
  creativeRules!: Table<CreativeRules>
  characterRelations!: Table<CharacterRelation>
  snapshots!: Table<Snapshot>
  references!: Table<Reference>
  promptTemplates!: Table<PromptTemplate>
  detailedOutlines!: Table<DetailedOutline>
  importJobs!: Table<ImportJob>
  importSessions!: Table<ImportSession>
  importLogs!: Table<ImportLog>
  importFiles!: Table<ImportFileBlob, number>
  promptWorkflows!: Table<PromptWorkflow>

  constructor() {
    super('storyforge')

    this.version(1).stores({
      projects: '++id, name, createdAt, updatedAt',
      worldviews: '++id, projectId',
      storyCores: '++id, projectId',
      powerSystems: '++id, projectId',
      characters: '++id, projectId, name, role',
      factions: '++id, projectId, name',
      outlineNodes: '++id, projectId, parentId, order, type',
      chapters: '++id, projectId, outlineNodeId, order, status',
      foreshadows: '++id, projectId, status, type',
    })

    this.version(2).stores({
      geographies: '++id, projectId',
      histories: '++id, projectId',
      itemSystems: '++id, projectId',
      creativeRules: '++id, projectId',
    })

    this.version(3).stores({
      characterRelations: '++id, projectId, fromCharacterId, toCharacterId',
    })

    this.version(4).stores({
      snapshots: '++id, projectId, type, createdAt',
    })

    // v5: 新增参考书目表，projects 表支持 genres[] / status / coverImage
    this.version(5).stores({
      references: '++id, projectId, type, createdAt',
    })

    // v6: 提示词模板表（Phase 1 — 提示词基础设施）
    this.version(6).stores({
      promptTemplates: '++id, scope, moduleKey, isActive, updatedAt',
    })

    // v7: 细纲 + AI 导入任务（Phase 3 — 数据模型增量扩展）
    this.version(7).stores({
      detailedOutlines: '++id, projectId, outlineNodeId',
      importJobs: '++id, projectId, type, status, createdAt',
    })

    // v8: 提示词工作流（Phase 16）
    this.version(8).stores({
      promptWorkflows: '++id, scope, isDefault, updatedAt',
    })

    // v9: 大文档分块导入流水线（Phase 18）
    this.version(9).stores({
      importSessions: '++id, projectId, status, updatedAt, fileHash',
      importLogs: '++id, sessionId, chunkIndex, createdAt',
    })

    // v10: 导入原文 Blob 持久化（Phase 18 方案 A — 2026-05-12）
    //      key = sessionId（与 importSessions 主键一致）。
    //      没用 ++ 是因为要手动用 session.id 做主键。
    this.version(10).stores({
      importFiles: 'sessionId, fileHash, createdAt',
    })
  }
}

export const db = new StoryForgeDB()
