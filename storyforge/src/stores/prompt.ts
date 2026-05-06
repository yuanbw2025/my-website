import { create } from 'zustand'
import { db } from '../lib/db/schema'
import type { PromptTemplate, PromptModuleKey } from '../lib/types/prompt'
import { SYSTEM_PROMPT_SEEDS } from '../lib/ai/prompt-seeds'

interface PromptStore {
  templates: PromptTemplate[]
  loaded: boolean

  /** 启动时调用一次：从 IndexedDB 加载，若空则注入系统 seed。 */
  init(): Promise<void>

  /** 同步获取某 moduleKey 当前激活的模板。
   *  正常情况从内存里取；若 store 未初始化或没找到，fallback 到 seed 数组兜底。
   */
  getActive(key: PromptModuleKey): PromptTemplate

  /** 保存（新增或更新）一个模板，并刷新 in-memory 列表。 */
  saveTemplate(t: PromptTemplate): Promise<number>

  /** 从已有模板克隆一份给用户编辑（scope='user'，isActive=false）。 */
  cloneTemplate(id: number, newName?: string): Promise<number>

  /** 把某模板设为对应 moduleKey 的激活模板（其他同 key 的取消激活）。 */
  setActive(id: number): Promise<void>

  /** 强制重新从 DB 加载。 */
  reload(): Promise<void>
}

export const usePromptStore = create<PromptStore>((set, get) => ({
  templates: [],
  loaded: false,

  init: async () => {
    if (get().loaded) return
    const existing = await db.promptTemplates.toArray()
    if (existing.length === 0) {
      const now = Date.now()
      const rows: PromptTemplate[] = SYSTEM_PROMPT_SEEDS.map(seed => ({
        ...seed,
        createdAt: now,
        updatedAt: now,
      }))
      await db.promptTemplates.bulkAdd(rows)
      const reloaded = await db.promptTemplates.toArray()
      set({ templates: reloaded, loaded: true })
    } else {
      // 增量补 seed：DB 已有但缺某些 moduleKey 的（迁移到新版本时友好）
      const existingKeys = new Set(existing.filter(t => t.scope === 'system').map(t => t.moduleKey))
      const missing = SYSTEM_PROMPT_SEEDS.filter(s => !existingKeys.has(s.moduleKey))
      if (missing.length > 0) {
        const now = Date.now()
        await db.promptTemplates.bulkAdd(
          missing.map(seed => ({ ...seed, createdAt: now, updatedAt: now })),
        )
      }
      const all = await db.promptTemplates.toArray()
      set({ templates: all, loaded: true })
    }
  },

  getActive: (key: PromptModuleKey): PromptTemplate => {
    const list = get().templates
    // 优先用户激活的
    const userActive = list.find(t => t.moduleKey === key && t.scope === 'user' && t.isActive)
    if (userActive) return userActive
    // 其次系统激活的
    const sysActive = list.find(t => t.moduleKey === key && t.scope === 'system' && t.isActive)
    if (sysActive) return sysActive
    // 再次任意同 key 模板
    const any = list.find(t => t.moduleKey === key)
    if (any) return any
    // 最后兜底：seed 数组（store 未初始化时保命用）
    const seed = SYSTEM_PROMPT_SEEDS.find(s => s.moduleKey === key)
    if (seed) {
      const now = Date.now()
      return { ...seed, createdAt: now, updatedAt: now }
    }
    throw new Error(`[prompt-store] no template found for moduleKey: ${key}`)
  },

  saveTemplate: async (t: PromptTemplate): Promise<number> => {
    const now = Date.now()
    const row: PromptTemplate = { ...t, updatedAt: now, createdAt: t.createdAt || now }
    const id = await db.promptTemplates.put(row)
    await get().reload()
    return id as number
  },

  cloneTemplate: async (id: number, newName?: string): Promise<number> => {
    const src = await db.promptTemplates.get(id)
    if (!src) throw new Error(`template ${id} not found`)
    const now = Date.now()
    const { id: _drop, ...rest } = src
    void _drop
    const cloneRow: PromptTemplate = {
      ...rest,
      scope: 'user',
      name: newName || `${src.name} (副本)`,
      parentId: src.id,
      isActive: false,
      createdAt: now,
      updatedAt: now,
    }
    const newId = await db.promptTemplates.add(cloneRow)
    await get().reload()
    return newId as number
  },

  setActive: async (id: number): Promise<void> => {
    const target = await db.promptTemplates.get(id)
    if (!target) throw new Error(`template ${id} not found`)
    // 同 moduleKey 的其他模板取消激活
    const siblings = await db.promptTemplates.where('moduleKey').equals(target.moduleKey).toArray()
    const now = Date.now()
    await db.transaction('rw', db.promptTemplates, async () => {
      for (const s of siblings) {
        if (s.id === id) {
          await db.promptTemplates.update(s.id!, { isActive: true, updatedAt: now })
        } else if (s.isActive) {
          await db.promptTemplates.update(s.id!, { isActive: false, updatedAt: now })
        }
      }
    })
    await get().reload()
  },

  reload: async () => {
    const all = await db.promptTemplates.toArray()
    set({ templates: all })
  },
}))
