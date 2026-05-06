/**
 * 提示词模板系统类型定义
 *
 * Phase 1 落地范围：把硬编码 prompts 下沉到 IndexedDB。
 * 详见 docs/09-REDESIGN-INTEGRATION-PLAN.md 第三章 与
 *      docs/playbooks/PHASE-01-prompt-infrastructure.md
 */

/** 提示词模块标识 — Phase 1 当前用到的全集 */
export type PromptModuleKey =
  // 世界观
  | 'worldview.dimension'
  // 角色
  | 'character.generate'
  | 'character.dimension'
  // 大纲
  | 'outline.volume'
  | 'outline.chapter'
  // 章节正文
  | 'chapter.content'
  | 'chapter.continue'
  | 'chapter.polish'
  | 'chapter.expand'
  | 'chapter.de-ai'
  // 伏笔
  | 'foreshadow.generate'
  // 地理 / 概念地图
  | 'geography.concept-map'
  | 'geography.image-map-prompt'
  // —— 后续 Phase 启用 ——
  | 'worldview.generate'
  | 'story.generate'
  | 'rules.generate'
  | 'detail.scene'
  | 'import.parse-character'
  | 'import.parse-worldview'
  | 'import.parse-outline'

/** 提示词模板表行 */
export interface PromptTemplate {
  id?: number
  scope: 'system' | 'user'
  moduleKey: PromptModuleKey
  promptType: string
  name: string
  description: string
  systemPrompt: string
  userPromptTemplate: string
  variables: string[]
  modelOverride?: {
    temperature?: number
    maxTokens?: number
  }
  parentId?: number
  isActive: boolean
  createdAt: number
  updatedAt: number
}

/** 渲染时传入的变量字典 — 所有可能用到的字段一次性列出 */
export interface PromptVariableContext {
  // 项目级
  projectName?: string
  genres?: string
  description?: string
  // 世界观
  worldOrigin?: string
  naturalEnv?: string
  humanityEnv?: string
  worldContext?: string
  existingWorldview?: string
  // 故事
  storyCore?: string
  // 角色
  characters?: string
  existingCharacters?: string
  characterName?: string
  characterInfo?: string
  // 创作规则
  rules?: string
  // 大纲
  volumeTitle?: string
  volumeSummary?: string
  prevVolumeSummary?: string
  targetWordCount?: number
  estimatedVolumes?: number
  // 章节
  chapterTitle?: string
  chapterSummary?: string
  previousChapterEnding?: string
  existingContent?: string
  // 编辑/润色
  text?: string
  instruction?: string
  // 伏笔
  existingForeshadows?: string
  // 概念地图
  overview?: string
  locationList?: string
  locationNames?: string
  locationTypes?: string
  imageStyle?: string
  // 通用
  dimension?: string
  userHint?: string
  // 兜底（任意自定义键）
  [extra: string]: string | number | undefined
}
