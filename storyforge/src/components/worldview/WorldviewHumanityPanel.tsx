import { useState, useEffect } from 'react'
import { useWorldviewStore } from '../../stores/worldview'
import WorldviewFieldEditor from './WorldviewFieldEditor'
import type { Project } from '../../lib/types'

interface Props {
  project: Project
}

/** v3 §2.1 — 世界观.人文环境（7 字段） */
export default function WorldviewHumanityPanel({ project }: Props) {
  const { worldview, saveWorldview, loadAll } = useWorldviewStore()

  const [historyLine, setHistoryLine] = useState('')
  const [worldEvents, setWorldEvents] = useState('')
  const [races, setRaces] = useState('')
  const [factionLayout, setFactionLayout] = useState('')
  const [politicsEconomyCulture, setPoliticsEconomyCulture] = useState('')
  const [internalConflicts, setInternalConflicts] = useState('')
  const [itemDesign, setItemDesign] = useState('')

  useEffect(() => { loadAll(project.id!) }, [project.id, loadAll])

  useEffect(() => {
    if (!worldview) return
    setHistoryLine(worldview.historyLine || '')
    setWorldEvents(worldview.worldEvents || '')
    setRaces(worldview.races || '')
    setFactionLayout(worldview.factionLayout || '')
    setPoliticsEconomyCulture(worldview.politicsEconomyCulture || '')
    setInternalConflicts(worldview.internalConflicts || '')
    setItemDesign(worldview.itemDesign || '')
  }, [worldview])

  const save = (patch: Partial<typeof worldview>) =>
    saveWorldview({ projectId: project.id!, ...patch })

  /** 拼其他字段（含世界起源 + 自然环境的关键值）做 AI 上下文 */
  const buildCtx = (skipKey: string): string => {
    const parts: string[] = []
    // 先带一些上游设定（让 AI 知道世界基本盘）
    if (worldview?.worldOrigin) parts.push(`【世界起源】${worldview.worldOrigin.slice(0, 200)}`)
    if (worldview?.powerHierarchy) parts.push(`【力量层次】${worldview.powerHierarchy.slice(0, 150)}`)
    if (worldview?.continentLayout) parts.push(`【大陆分布】${worldview.continentLayout.slice(0, 150)}`)
    // 再加同 panel 其他字段
    const map: [string, string, string][] = [
      ['history',   '世界历史线',  historyLine],
      ['events',    '世界大事记',  worldEvents],
      ['races',     '种族设定',    races],
      ['factions',  '势力分布',    factionLayout],
      ['pec',       '政治经济文化', politicsEconomyCulture],
      ['conflicts', '矛盾冲突',    internalConflicts],
      ['items',     '道具设计',    itemDesign],
    ]
    for (const [k, label, val] of map) {
      if (k !== skipKey && val) parts.push(`【${label}】${val.slice(0, 150)}`)
    }
    return parts.join('\n')
  }

  return (
    <div className="max-w-4xl p-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold text-text-primary mb-1">🏛 人文环境</h2>
        <p className="text-sm text-text-muted">历史 / 大事记 / 种族 / 势力 / 政经文 / 矛盾冲突 / 道具 — 让世界活起来。</p>
      </div>

      <WorldviewFieldEditor
        label="📜 世界历史线"
        description="从远古到当下的时间脉络（朝代 / 时代 / 关键节点）。"
        value={historyLine}
        onChange={setHistoryLine}
        onSave={v => save({ historyLine: v })}
        project={project}
        contextSummary={buildCtx('history')}
        rows={5}
      />

      <WorldviewFieldEditor
        label="📅 世界大事记"
        description="改变世界格局的重大事件（神战、王朝兴替、灾劫……）。"
        value={worldEvents}
        onChange={setWorldEvents}
        onSave={v => save({ worldEvents: v })}
        project={project}
        contextSummary={buildCtx('events')}
        rows={5}
      />

      <WorldviewFieldEditor
        label="🧬 种族设定"
        description="人类 / 妖族 / 神族 / 异种……每个种族的特征、能力、栖息地、历史。"
        value={races}
        onChange={setRaces}
        onSave={v => save({ races: v })}
        project={project}
        contextSummary={buildCtx('races')}
        rows={5}
      />

      <WorldviewFieldEditor
        label="⚔ 势力分布"
        description="主要门派 / 王朝 / 商会 / 教派……势力间的格局和敌友关系。"
        value={factionLayout}
        onChange={setFactionLayout}
        onSave={v => save({ factionLayout: v })}
        project={project}
        contextSummary={buildCtx('factions')}
        rows={5}
      />

      <WorldviewFieldEditor
        label="🏛 政治 / 经济 / 文化"
        description="政体 / 货币流通 / 阶层制度 / 宗教信仰 / 风俗节庆。"
        value={politicsEconomyCulture}
        onChange={setPoliticsEconomyCulture}
        onSave={v => save({ politicsEconomyCulture: v })}
        project={project}
        contextSummary={buildCtx('pec')}
        rows={5}
      />

      <WorldviewFieldEditor
        label="🔥 矛盾冲突"
        description="社会内在矛盾 / 阶级冲突 / 个体与集体冲突 / 与外部世界的张力。"
        value={internalConflicts}
        onChange={setInternalConflicts}
        onSave={v => save({ internalConflicts: v })}
        project={project}
        contextSummary={buildCtx('conflicts')}
        rows={4}
      />

      <WorldviewFieldEditor
        label="🗡 道具设计"
        description="武器 / 法器 / 灵药 / 神器……物品的来源、品级、规则。"
        value={itemDesign}
        onChange={setItemDesign}
        onSave={v => save({ itemDesign: v })}
        project={project}
        contextSummary={buildCtx('items')}
        rows={5}
      />
    </div>
  )
}
