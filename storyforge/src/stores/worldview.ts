import { create } from 'zustand'
import { db } from '../lib/db/schema'
import type { Worldview, StoryCore, PowerSystem } from '../lib/types'

interface WorldviewStore {
  worldview: Worldview | null
  storyCore: StoryCore | null
  powerSystem: PowerSystem | null
  loading: boolean
  /** 当前加载的世界组（null = 单世界模式 / 未指定） */
  activeWorldGroupId: number | null

  loadAll: (projectId: number, worldGroupId?: number | null) => Promise<void>

  saveWorldview: (data: Partial<Worldview>) => Promise<void>
  saveStoryCore: (data: Partial<StoryCore>) => Promise<void>
  savePowerSystem: (data: Partial<PowerSystem>) => Promise<void>
}

const now = () => Date.now()

export const useWorldviewStore = create<WorldviewStore>((set, get) => ({
  worldview: null,
  storyCore: null,
  powerSystem: null,
  loading: false,
  activeWorldGroupId: null,

  loadAll: async (projectId: number, worldGroupId: number | null = null) => {
    set({ loading: true, activeWorldGroupId: worldGroupId })
    const [wvList, sc, psList] = await Promise.all([
      db.worldviews.where('projectId').equals(projectId).toArray(),
      db.storyCores.where('projectId').equals(projectId).first(),
      db.powerSystems.where('projectId').equals(projectId).toArray(),
    ])
    // 单世界模式（worldGroupId == null）：取第一条
    // 多世界模式：取匹配该世界组的记录
    const wv = worldGroupId == null
      ? wvList[0]
      : wvList.find(w => w.worldGroupId === worldGroupId)
    const ps = worldGroupId == null
      ? psList[0]
      : psList.find(p => p.worldGroupId === worldGroupId)
    set({
      worldview: wv || null,
      storyCore: sc || null,   // 故事核心是项目级，不分世界
      powerSystem: ps || null,
      loading: false,
    })
  },

  saveWorldview: async (data: Partial<Worldview>) => {
    const { worldview, activeWorldGroupId } = get()
    const projectId = data.projectId ?? worldview?.projectId
    // 以 DB 为准定位既有记录，避免内存为 null/陈旧时误新增第二条导致"采纳后世界观为空"
    let target = worldview
    if (!target?.id && projectId != null) {
      const list = await db.worldviews.where('projectId').equals(projectId).toArray()
      target = (activeWorldGroupId == null
        ? (list.find(w => w.worldGroupId == null) ?? list[0])
        : list.find(w => w.worldGroupId === activeWorldGroupId)) ?? null
    }
    if (target?.id) {
      await db.worldviews.update(target.id, { ...data, updatedAt: now() })
      set({ worldview: { ...target, ...data, updatedAt: now() } })
    } else if (projectId != null) {
      const newWv: Worldview = {
        projectId,
        geography: '', history: '', society: '',
        culture: '', economy: '', rules: '', summary: '',
        worldGroupId: activeWorldGroupId,   // 多世界模式下盖章当前世界组
        createdAt: now(), updatedAt: now(),
        ...data,
      }
      const id = await db.worldviews.add(newWv)
      set({ worldview: { ...newWv, id: id as number } })
    }
  },

  saveStoryCore: async (data: Partial<StoryCore>) => {
    const { storyCore } = get()
    const projectId = data.projectId ?? storyCore?.projectId
    let target = storyCore
    if (!target?.id && projectId != null) {
      target = await db.storyCores.where('projectId').equals(projectId).first() ?? null
    }
    if (target?.id) {
      await db.storyCores.update(target.id, { ...data, updatedAt: now() })
      set({ storyCore: { ...target, ...data, updatedAt: now() } })
    } else if (projectId != null) {
      const newSc: StoryCore = {
        projectId,
        theme: '', centralConflict: '', plotPattern: '', storyLines: '',
        createdAt: now(), updatedAt: now(),
        ...data,
      }
      const id = await db.storyCores.add(newSc)
      set({ storyCore: { ...newSc, id: id as number } })
    }
  },

  savePowerSystem: async (data: Partial<PowerSystem>) => {
    const { powerSystem, activeWorldGroupId } = get()
    const projectId = data.projectId ?? powerSystem?.projectId
    let target = powerSystem
    if (!target?.id && projectId != null) {
      const list = await db.powerSystems.where('projectId').equals(projectId).toArray()
      target = (activeWorldGroupId == null
        ? (list.find(p => p.worldGroupId == null) ?? list[0])
        : list.find(p => p.worldGroupId === activeWorldGroupId)) ?? null
    }
    if (target?.id) {
      await db.powerSystems.update(target.id, { ...data, updatedAt: now() })
      set({ powerSystem: { ...target, ...data, updatedAt: now() } })
    } else if (projectId != null) {
      const newPs: PowerSystem = {
        projectId,
        name: '', description: '', levels: '', rules: '',
        worldGroupId: activeWorldGroupId,   // 多世界模式下盖章当前世界组
        createdAt: now(), updatedAt: now(),
        ...data,
      }
      const id = await db.powerSystems.add(newPs)
      set({ powerSystem: { ...newPs, id: id as number } })
    }
  },
}))
