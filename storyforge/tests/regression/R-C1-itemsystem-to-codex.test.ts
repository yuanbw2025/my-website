/**
 * Stage C1 回归 · 道具系统下线迁移(先迁移后删 · 零丢失)
 *
 * 锁定:旧 itemSystems 数据 → 「人工器物」词条 + 人文 itemDesign,
 * 迁移后旧行清空,且幂等(重复运行不重复建)。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db } from '../../src/lib/db/schema'
import { migrateItemSystemToCodex } from '../../src/lib/migrations/item-system-to-codex'
import { parseFieldSchema } from '../../src/lib/types/codex'

async function seedProjectWithItemSystem(): Promise<number> {
  const now = Date.now()
  const projectId = await db.projects.add({
    name: 'C1', genre: '', description: '', targetWordCount: 0,
    enableMultiWorld: false, createdAt: now, updatedAt: now,
  } as any) as number
  await db.worldviews.add({ projectId, itemDesign: '', createdAt: now, updatedAt: now } as any)
  await db.itemSystems.add({
    projectId,
    overview: '本世界以灵器为尊，凡铁难入法眼。',
    items: JSON.stringify([
      { id: 'a', name: '玄铁重剑', type: 'weapon', rank: '地阶', description: '极重之剑',
        abilities: '破甲', origin: '陨铁所铸', owner: '主角', significance: '主角本命兵器', order: 0 },
      { id: 'b', name: '九转还魂丹', type: 'pill', rank: '天阶', description: '续命丹药',
        abilities: '起死回生', origin: '丹宗秘传', owner: '', significance: '关键剧情道具', order: 1 },
    ]),
    createdAt: now, updatedAt: now,
  } as any)
  return projectId
}

describe('Stage C1 · 道具系统下线迁移', () => {
  beforeEach(async () => { await db.delete(); await db.open() })
  afterEach(async () => { db.close() })

  it('道具 → 人工器物词条;总述 → 人文 itemDesign;旧行清空', async () => {
    const projectId = await seedProjectWithItemSystem()
    await migrateItemSystemToCodex(projectId)

    // 人工器物分类
    const artifact = (await db.codexCategories.where('projectId').equals(projectId).toArray())
      .find(c => c.builtInKey === 'artifact')!
    expect(artifact).toBeTruthy()

    const entries = (await db.codexEntries.where('projectId').equals(projectId).toArray())
      .filter(e => e.categoryId === artifact.id)
    expect(entries.map(e => e.name).sort()).toEqual(['九转还魂丹', '玄铁重剑'])

    // 字段映射正确(type 中文化 / abilities→effect / owner / rank)
    const sword = entries.find(e => e.name === '玄铁重剑')!
    const f = JSON.parse(sword.fields)
    expect(f.type).toBe('武器')
    expect(f.rank).toBe('地阶')
    expect(f.effect).toBe('破甲')
    expect(f.owner).toBe('主角')
    expect(sword.summary).toBe('主角本命兵器')   // significance → summary
    expect(sword.description).toBe('极重之剑')

    // 总述并入人文 itemDesign
    const wv = await db.worldviews.where('projectId').equals(projectId).first()
    expect(wv!.itemDesign).toContain('本世界以灵器为尊')

    // 先迁移后删:旧 itemSystems 行已清空
    const remaining = await db.itemSystems.where('projectId').equals(projectId).count()
    expect(remaining).toBe(0)

    // 人工器物词条的 fieldSchema 与导入字段对得上(type/rank/effect/origin/owner 均为合法 key)
    const schemaKeys = parseFieldSchema(artifact.fieldSchema).map(d => d.key)
    for (const k of ['type', 'rank', 'effect', 'origin', 'owner']) {
      expect(schemaKeys).toContain(k)
    }
  })

  it('幂等:重复迁移不重复建条目,不重复追加总述', async () => {
    const projectId = await seedProjectWithItemSystem()
    await migrateItemSystemToCodex(projectId)
    // 二次:itemSystems 已空,应为 no-op
    await migrateItemSystemToCodex(projectId)

    const artifact = (await db.codexCategories.where('projectId').equals(projectId).toArray())
      .find(c => c.builtInKey === 'artifact')!
    const entries = (await db.codexEntries.where('projectId').equals(projectId).toArray())
      .filter(e => e.categoryId === artifact.id)
    expect(entries.length).toBe(2)   // 不翻倍

    const wv = await db.worldviews.where('projectId').equals(projectId).first()
    const occurrences = (wv!.itemDesign!.match(/本世界以灵器为尊/g) || []).length
    expect(occurrences).toBe(1)      // 总述只追加一次
  })

  it('空道具系统:无害,直接清掉空行', async () => {
    const now = Date.now()
    const projectId = await db.projects.add({
      name: 'C1empty', genre: '', description: '', targetWordCount: 0,
      enableMultiWorld: false, createdAt: now, updatedAt: now,
    } as any) as number
    await db.itemSystems.add({ projectId, overview: '', items: '[]', createdAt: now, updatedAt: now } as any)
    await migrateItemSystemToCodex(projectId)
    expect(await db.itemSystems.where('projectId').equals(projectId).count()).toBe(0)
  })
})
