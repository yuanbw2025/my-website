import { useState, useEffect } from 'react'
import { useWorldviewStore } from '../../stores/worldview'
import AIFieldCard from '../shared/AIFieldCard'
import { buildStoryGeneratePrompt } from '../../lib/ai/adapters/story-adapter'
import type { Project } from '../../lib/types'

interface Props {
  project: Project
}

/** v3 §2.1 — 故事设计（7 字段，每个带 AI 生成） */
export default function StoryCorePanel({ project }: Props) {
  const { storyCore, worldview, saveStoryCore, loadAll } = useWorldviewStore()

  const [logline, setLogline] = useState('')
  const [concept, setConcept] = useState('')
  const [theme, setTheme] = useState('')
  const [centralConflict, setCentralConflict] = useState('')
  const [plotPattern, setPlotPattern] = useState('')
  const [mainPlot, setMainPlot] = useState('')
  const [subPlots, setSubPlots] = useState('')

  useEffect(() => { loadAll(project.id!) }, [project.id, loadAll])

  useEffect(() => {
    if (!storyCore) return
    setLogline(storyCore.logline || '')
    setConcept(storyCore.concept || '')
    setTheme(storyCore.theme || '')
    setCentralConflict(storyCore.centralConflict || '')
    setPlotPattern(storyCore.plotPattern || '')
    setMainPlot(storyCore.mainPlot || storyCore.storyLines || '')
    setSubPlots(storyCore.subPlots || '')
  }, [storyCore])

  const save = (patch: Partial<typeof storyCore>) =>
    saveStoryCore({ projectId: project.id!, ...patch })

  /** 拼世界观摘要供 AI 上下文 */
  const worldCtx = (): string => {
    if (!worldview) return ''
    const parts: string[] = []
    if (worldview.summary) parts.push(`【世界观摘要】${worldview.summary.slice(0, 300)}`)
    else if (worldview.worldOrigin) parts.push(`【世界起源】${worldview.worldOrigin.slice(0, 200)}`)
    return parts.join('\n')
  }

  const mkBuilder = (dimension: string) =>
    (hint: string, options?: { parameterValues?: Record<string, unknown>; overrides?: { systemPrompt?: string; userPromptTemplate?: string } }) =>
      buildStoryGeneratePrompt(dimension, project.name, project.genre || '', worldCtx(), hint, options)

  return (
    <div className="max-w-4xl p-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold text-text-primary mb-1">📖 故事设计</h2>
        <p className="text-sm text-text-muted">7 个维度勾勒故事核心 — 每个都可以一键 AI 生成。</p>
      </div>

      <AIFieldCard
        label="📜 一句话故事"
        description="用一句话讲清楚你的故事是什么。"
        value={logline} onChange={setLogline} onSave={v => save({ logline: v })}
        moduleKey="story.generate"
        buildMessages={mkBuilder('一句话故事（logline）')}
        rows={2} resetKey="logline"
      />
      <AIFieldCard
        label="💡 故事概念"
        description="独特设定或反差点：'如果……会怎么样？'"
        value={concept} onChange={setConcept} onSave={v => save({ concept: v })}
        moduleKey="story.generate"
        buildMessages={mkBuilder('故事概念（high concept）')}
        rows={3} resetKey="concept"
      />
      <AIFieldCard
        label="🎯 故事主题"
        description="想探讨的人性/价值观主题。"
        value={theme} onChange={setTheme} onSave={v => save({ theme: v })}
        moduleKey="story.generate"
        buildMessages={mkBuilder('故事主题')}
        rows={3} resetKey="theme"
      />
      <AIFieldCard
        label="⚔️ 核心冲突"
        description="主角面对的最大矛盾（外在 + 内在）。"
        value={centralConflict} onChange={setCentralConflict} onSave={v => save({ centralConflict: v })}
        moduleKey="story.generate"
        buildMessages={mkBuilder('核心冲突')}
        rows={4} resetKey="conflict"
      />
      <AIFieldCard
        label="📊 故事模式"
        description="线性 / 莲花地图 / 多线并行 / 蒙太奇 等。"
        value={plotPattern} onChange={setPlotPattern} onSave={v => save({ plotPattern: v })}
        moduleKey="story.generate"
        buildMessages={mkBuilder('故事模式')}
        rows={3} resetKey="pattern"
      />
      <AIFieldCard
        label="🛤 故事主线"
        description="核心情节线 — 主角的目标与阻碍。"
        value={mainPlot} onChange={setMainPlot} onSave={v => save({ mainPlot: v })}
        moduleKey="story.generate"
        buildMessages={mkBuilder('故事主线')}
        rows={5} resetKey="main"
      />
      <AIFieldCard
        label="🎼 故事复线"
        description="副线情节（情感线 / 配角线 / 暗线 / 悬念线）。"
        value={subPlots} onChange={setSubPlots} onSave={v => save({ subPlots: v })}
        moduleKey="story.generate"
        buildMessages={mkBuilder('故事复线')}
        rows={4} resetKey="sub"
      />
    </div>
  )
}
