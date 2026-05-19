/** 参考书目类型 */
export type ReferenceType = 'story' | 'style'

/** 参考书目条目 */
export interface Reference {
  id?: number
  projectId: number
  title: string        // 书名 / 文件名
  author: string       // 作者
  type: ReferenceType  // 故事参考 | 风格参考
  note: string         // 备注
  url: string          // 链接（可选）

  /** 从导入解析得到的结构化数据（项目参考模式） */
  importedData?: ImportedReferenceData

  createdAt: number
  updatedAt: number
}

/** 导入到"项目参考"时保存的结构化数据 */
export interface ImportedReferenceData {
  /** 世界观各维度 */
  worldview?: Record<string, string>
  /** 角色列表 */
  characters?: Array<Record<string, unknown>>
  /** 大纲结构 */
  outline?: Array<Record<string, unknown>>
  /** 写作技法分析 */
  writingTechniques?: import('./import-session-data').WritingTechniques
  /** 原始文件名 */
  sourceFilename?: string
  /** 导入时间 */
  importedAt?: number
}

export type CreateReferenceInput = Omit<Reference, 'id' | 'createdAt' | 'updatedAt'>
