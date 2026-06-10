/**
 * Stage C1 — 「道具系统」下线迁移(先迁移后删)
 * ------------------------------------------------------------
 * 把旧 `itemSystems` 表的数据并入新词条体系,然后清空旧行:
 *   · 每个道具(Item) → 「人工器物」(artifact)词条条目
 *   · 体系总述(overview) → 人文世界观 `itemDesign` 字段(架构已预留此字段为替代位)
 *
 * 设计要点:
 *   - 幂等:按词条名去重,重复运行不会重复建条目;overview 用包含判断防重复追加。
 *   - 自愈:确保 artifact 内置分类存在(复用 codex store 的 ensureBuiltIns)。
 *   - 先迁移后删:全部迁移成功后才删除旧 itemSystems 行(铁律:绝不先删后补)。
 *   - 兼容旧备份:用户导入含 itemSystems 的旧导出文件后,下次加载会自动迁移。
 *     因此数据层(itemSystems 表 / 导出导入 / 本迁移)保留,仅下线 UI 入口。
 */
import { db } from '../db/schema'
import { useCodexStore } from '../../stores/codex'
import type { Item, ItemType } from '../types'

/** 旧 ItemType → 「人工器物」词条 type 字段的中文选项(对齐 BUILTIN_CATEGORIES.artifact.fields) */
const TYPE_LABEL: Record<ItemType, string> = {
  weapon: '武器',
  armor: '防具',
  artifact: '法器',
  pill: '丹药',
  material: '材料',
  manual: '功法秘籍',
  formation: '阵法',
  special: '其他',
  other: '其他',
}

export async function migrateItemSystemToCodex(projectId: number): Promise<void> {
  const sys = await db.itemSystems.where('projectId').equals(projectId).first()
  if (!sys) return

  let items: Item[] = []
  try {
    items = JSON.parse(sys.items || '[]')
  } catch {
    items = []
  }
  const overview = (sys.overview || '').trim()

  // 空数据:直接清掉空行,无需迁移
  if (items.length === 0 && !overview) {
    if (sys.id != null) await db.itemSystems.delete(sys.id)
    return
  }

  // 确保内置分类存在(自愈),再取「人工器物」分类
  await useCodexStore.getState().ensureBuiltIns(projectId)
  const artifact = await db.codexCategories
    .where('projectId').equals(projectId)
    .filter(c => c.builtInKey === 'artifact')
    .first()
  if (!artifact || artifact.id == null) {
    // 极端兜底:分类没建成则不删旧数据(先迁移后删),留待下次重试
    console.warn('[C1] 人工器物分类缺失,本次跳过道具迁移(保留旧数据待重试)')
    return
  }

  // 已有条目(按名去重,保证幂等)
  const existing = await db.codexEntries
    .where('projectId').equals(projectId)
    .filter(e => e.categoryId === artifact.id)
    .toArray()
  const existingNames = new Set(existing.map(e => e.name))

  const ts = Date.now()
  let order = existing.length
  for (const it of items) {
    const name = (it.name || '').trim()
    if (!name || existingNames.has(name)) continue
    const fields: Record<string, string> = {
      type: TYPE_LABEL[it.type] ?? '其他',
      rank: it.rank || '',
      effect: it.abilities || '',
      origin: it.origin || '',
      owner: it.owner || '',
    }
    await db.codexEntries.add({
      projectId,
      categoryId: artifact.id,
      name,
      summary: it.significance || '',
      description: it.description || '',
      fields: JSON.stringify(fields),
      order: order++,
      worldGroupId: null,
      createdAt: ts,
      updatedAt: ts,
    } as any)
    existingNames.add(name)
  }

  // 体系总述 → 人文 itemDesign(包含判断防重复追加)
  if (overview) {
    const wv = await db.worldviews.where('projectId').equals(projectId).first()
    if (wv && wv.id != null) {
      const cur = wv.itemDesign || ''
      if (!cur.includes(overview)) {
        const merged = cur ? `${cur}\n\n${overview}` : overview
        await db.worldviews.update(wv.id, { itemDesign: merged, updatedAt: ts } as any)
      }
    }
  }

  // 先迁移后删:全部并入成功后清掉旧行
  if (sys.id != null) await db.itemSystems.delete(sys.id)
  console.log('[C1] 道具系统已迁移到人工器物词条:', items.length, '项')
}
