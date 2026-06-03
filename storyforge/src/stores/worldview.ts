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
    if (worldview?.id) {
      await db.worldviews.update(worldview.id, { ...data, updatedAt: now() })
      set({ worldview: { ...worldview, ...data, updatedAt: now() } })
    } else if (data.projectId) {
      const newWv: Worldview = {
        projectId: data.projectId,
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
    if (storyCore?.id) {
      await db.storyCores.update(storyCore.id, { ...data, updatedAt: now() })
      set({ storyCore: { ...storyCore, ...data, updatedAt: now() } })
    } else if (data.projectId) {
      const newSc: StoryCore = {
        projectId: data.projectId,
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
    if (powerSystem?.id) {
      await db.powerSystems.update(powerSystem.id, { ...data, updatedAt: now() })
      set({ powerSystem: { ...powerSystem, ...data, updatedAt: now() } })
    } else if (data.projectId) {
      const newPs: PowerSystem = {
        projectId: data.projectId,
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
