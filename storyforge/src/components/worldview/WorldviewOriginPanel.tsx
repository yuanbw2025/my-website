import { useState, useEffect, useCallback } from 'react'
import { Sparkles } from 'lucide-react'
import { useWorldviewStore } from '../../stores/worldview'
import { InlineTextarea } from '../shared/InlineEdit'
import { useAIStream } from '../../hooks/useAIStream'
import { buildWorldviewPrompt } from '../../lib/ai/adapters/worldview-adapter'
import { buildWorldRulesContext } from '../../lib/ai/world-rules-manifest'
import AIStreamOutput from '../shared/AIStreamOutput'
import PromptRunPanel from '../shared/PromptRunPanel'
import type { Project, DivineDesign } from '../../lib/types'

// ── 常量 ───────────────────────────────────────────────────────

type FieldKey = 'origin' | 'power' | 'divine'

const FIELDS: { key: FieldKey; label: string; icon: string; desc: string }[] = [
  { key: 'origin', label: '世界来源', icon: '🌌', desc: '创世神话 / 历史时期 / 文明起源……世界从何而来？' },
  { key: 'power',  label: '力量层次', icon: '⚡', desc: '修真等级 / 社会等级 / 科技层级……力量如何分层、怎么晋升？' },
  { key: 'divine', label: '神明与信仰', icon: '🌟', desc: '是否存在神明或宗教？神明 / 信仰的层级、名号、规则与限制。' },
]

interface Props {
  project: Project
}

// ── 主面板 ─────────────────────────────────────────────────────

/** v3 §2.1 — 世界观.世界起源（三个子模块） */
export default function WorldviewOriginPanel({ project }: Props) {
  const { worldview, saveWorldview, loadAll } = useWorldviewStore()

  const [active, setActive] = useState<FieldKey>('origin')
  const [worldOrigin, setWorldOrigin] = useState('')
  const [powerHierarchy, setPowerHierarchy] = useState('')
  const [divineDesign, setDivineDesign] = useState<DivineDesign>({
    hasDivinity: false,
    divineRank: '',
    divineNames: '',
    divineRules: '',
  })
  const [streamingKeys, setStreamingKeys] = useState<Set<string>>(new Set())

  useEffect(() => { loadAll(project.id!) }, [project.id, loadAll])

  // 同步 store -> 本地 state
  useEffect(() => {
    if (!worldview) return
    setWorldOrigin(worldview.worldOrigin || '')
    setPowerHierarchy(worldview.powerHierarchy || '')
    setDivineDesign(worldview.divineDesign || {
      hasDivinity: false, divineRank: '', divineNames: '', divineRules: '',
    })
  }, [worldview])

  // 通用保存
  const save = (patch: Partial<typeof worldview>) =>
    saveWorldview({ projectId: project.id!, ...patch })

  // AI 上下文（排除当前字段）
  const buildCtx = useCallback((excludeKey: string): string => {
    const parts: string[] = []
    if (excludeKey !== 'origin' && worldOrigin) parts.push(`【世界来源】${worldOrigin.slice(0, 200)}`)
    if (excludeKey !== 'power'  && powerHierarchy) parts.push(`【力量层次】${powerHierarchy.slice(0, 200)}`)
    if (excludeKey !== 'divine' && divineDesign.hasDivinity) {
      parts.push(`【神明与信仰】${divineDesign.divineNames || ''}：${divineDesign.divineRules?.slice(0, 100) || ''}`)
    }
    return parts.join('\n')
  }, [worldOrigin, powerHierarchy, divineDesign])

  const handleStreamingChange = useCallback((key: string, streaming: boolean) => {
    setStreamingKeys(prev => {
      if (prev.has(key) === streaming) return prev
      const next = new Set(prev)
      if (streaming) next.add(key)
      else next.delete(key)
      return next
    })
  }, [])

  return (
    <div className="flex flex-col w-full max-w-5xl space-y-4">
      {/* 顶部 */}
      <div className="pb-4 border-b border-border/40">
        <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
          🌌 世界起源与核心设定
        </h2>
        <p className="text-xs text-text-muted mt-0.5">
          定义世界的起源、力量层次与信仰体系。如需声明真实与幻想的规则，请前往「⚖️ 真实与幻想」面板。
        </p>
      </div>

      <div className="flex gap-4">
        {/* ── 左侧边栏 ── */}
        <div className="w-44 shrink-0 space-y-0.5 pt-1">
          {FIELDS.map(f => {
            const isActive = active === f.key
            const isFieldStreaming = streamingKeys.has(f.key)
            return (
              <button
                key={f.key}
                onClick={() => setActive(f.key)}
                className={`w-full flex items-center gap-2.5 px-2 py-2.5 rounded-lg text-left transition-all ${
                  isActive
                    ? 'bg-accent/8 border-l-2 border-accent'
                    : 'hover:bg-bg-hover border-l-2 border-transparent'
                }`}
              >
                <span className="text-base shrink-0">{f.icon}</span>
                <span className={`text-sm font-medium truncate flex-1 ${isActive ? 'text-accent' : 'text-text-primary'}`}>
                  {f.label}
                </span>
                {isFieldStreaming && !isActive && (
                  <span className="w-2 h-2 rounded-full bg-accent animate-pulse shrink-0" />
                )}
              </button>
            )
          })}
        </div>

        {/* ── 右侧：所有字段同时渲染，hidden 控制显示 ── */}
        <div className="flex-1 min-w-0">
          {/* 世界来源 */}
          <div className={active === 'origin' ? '' : 'hidden'}>
            <TextFieldEditor
              field={FIELDS[0]}
              value={worldOrigin}
              onChange={v => { setWorldOrigin(v); save({ worldOrigin: v }) }}
              project={project}
              contextSummary={buildCtx('origin')}
              onStreamingChange={streaming => handleStreamingChange('origin', streaming)}
            />
          </div>

          {/* 力量层次 */}
          <div className={active === 'power' ? '' : 'hidden'}>
            <TextFieldEditor
              field={FIELDS[1]}
              value={powerHierarchy}
              onChange={v => { setPowerHierarchy(v); save({ powerHierarchy: v }) }}
              project={project}
              contextSummary={buildCtx('power')}
              onStreamingChange={streaming => handleStreamingChange('power', streaming)}
            />
          </div>

          {/* 神明与信仰 */}
          <div className={active === 'divine' ? '' : 'hidden'}>
            <DivineFieldEditor
              field={FIELDS[2]}
              divineDesign={divineDesign}
              onDivineChange={(next) => { setDivineDesign(next); save({ divineDesign: next }) }}
              project={project}
              contextSummary={buildCtx('divine')}
              onStreamingChange={streaming => handleStreamingChange('divine', streaming)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 文本字段编辑器（世界来源 / 力量层次） ────────────────────────

function TextFieldEditor({
  field, value, onChange, project, contextSummary, onStreamingChange,
}: {
  field: typeof FIELDS[number]
  value: string
  onChange: (v: string) => void
  project: Project
  contextSummary: string
  onStreamingChange: (streaming: boolean) => void
}) {
  const [hint, setHint] = useState('')
  const [parameterValues, setParameterValues] = useState<Record<string, unknown>>({})
  const [systemOverride, setSystemOverride] = useState<string | null>(null)
  const [userOverride, setUserOverride] = useState<string | null>(null)
  const ai = useAIStream()

  useEffect(() => {
    onStreamingChange(ai.isStreaming)
  }, [ai.isStreaming, onStreamingChange])

  const handleGenerate = async () => {
    // Phase 32: 注入世界规则
    const rulesCtx = await buildWorldRulesContext(project.id!)
    const opts = {
      parameterValues: {
        ...parameterValues,
        worldRulesContext: rulesCtx,
      },
      overrides: (systemOverride != null || userOverride != null) ? {
        systemPrompt: systemOverride ?? undefined,
        userPromptTemplate: userOverride ?? undefined,
      } : undefined,
    }
    const messages = buildWorldviewPrompt(
      field.label, project.name, project.genre || '', contextSummary, hint, opts,
    )
    ai.start(messages)
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
          <span>{field.icon}</span> {field.label}
        </h2>
        <p className="text-xs text-text-muted mt-0.5">{field.desc}</p>
      </div>

      <div className="bg-bg-surface border border-border rounded-lg p-4">
        <InlineTextarea value={value} onChange={onChange} placeholder={field.desc} />
      </div>

      <div className="flex items-center gap-2">
        <input
          value={hint} onChange={e => setHint(e.target.value)}
          placeholder="给 AI 的补充说明（可选）"
          className="flex-1 px-2 py-1.5 bg-bg-base border border-border rounded text-xs text-text-primary focus:outline-none focus:border-accent"
        />
        <button onClick={handleGenerate} disabled={ai.isStreaming}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded disabled:opacity-50 bg-accent/10 text-accent hover:bg-accent/20">
          <Sparkles className="w-3.5 h-3.5" /> AI 生成
        </button>
      </div>

      <PromptRunPanel moduleKey="worldview.dimension" parameterValues={parameterValues}
        onParamChange={setParameterValues} systemOverride={systemOverride}
        onSystemOverrideChange={setSystemOverride} userOverride={userOverride}
        onUserOverrideChange={setUserOverride} />

      {(ai.output || ai.isStreaming || ai.error) && (
        <AIStreamOutput output={ai.output} isStreaming={ai.isStreaming} error={ai.error}
          tokenUsage={ai.tokenUsage} onStop={ai.stop}
          onAccept={(text: string) => { onChange(text); ai.reset() }}
          onRetry={handleGenerate} moduleKey="worldview.dimension" />
      )}
    </div>
  )
}

// ── 神明与信仰编辑器（独立 AI 流） ─────────────────────────────────

function DivineFieldEditor({
  field, divineDesign, onDivineChange, project, contextSummary, onStreamingChange,
}: {
  field: typeof FIELDS[number]
  divineDesign: DivineDesign
  onDivineChange: (next: DivineDesign) => void
  project: Project
  contextSummary: string
  onStreamingChange: (streaming: boolean) => void
}) {
  const [hint, setHint] = useState('')
  const [parameterValues, setParameterValues] = useState<Record<string, unknown>>({})
  const [systemOverride, setSystemOverride] = useState<string | null>(null)
  const [userOverride, setUserOverride] = useState<string | null>(null)
  const ai = useAIStream()

  useEffect(() => {
    onStreamingChange(ai.isStreaming)
  }, [ai.isStreaming, onStreamingChange])

  const handleGenerate = async () => {
    const rulesCtx = await buildWorldRulesContext(project.id!)
    const opts = {
      parameterValues: {
        ...parameterValues,
        worldRulesContext: rulesCtx,
      },
      overrides: (systemOverride != null || userOverride != null) ? {
        systemPrompt: systemOverride ?? undefined,
        userPromptTemplate: userOverride ?? undefined,
      } : undefined,
    }
    const messages = buildWorldviewPrompt(
      '神明与信仰设定',
      project.name, project.genre || '', contextSummary,
      hint || '请设计完整的信仰体系，包含：1）主流信仰与层级 2）主要神明/信仰名号与职司 3）规则、风俗与禁忌。分三个小节输出。',
      opts,
    )
    ai.start(messages)
  }

  const handleAccept = (text: string) => {
    const sections = text.split(/(?:#{1,3}\s*|(?:\*\*))(?:神明层级|层级|主要神明|神明名号|国教|主流信仰|民间信仰|规则|限制|风俗|禁忌|避讳)/i)
    let next: DivineDesign
    if (sections.length >= 4) {
      next = {
        hasDivinity: true,
        divineRank: sections[1]?.replace(/\*\*/g, '').trim() || text,
        divineNames: sections[2]?.replace(/\*\*/g, '').trim() || '',
        divineRules: sections[3]?.replace(/\*\*/g, '').trim() || '',
      }
    } else {
      next = {
        hasDivinity: true,
        divineRank: text,
        divineNames: divineDesign.divineNames,
        divineRules: divineDesign.divineRules,
      }
    }
    onDivineChange(next)
    ai.reset()
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
          <span>{field.icon}</span> {field.label}
        </h2>
        <p className="text-xs text-text-muted mt-0.5">{field.desc}</p>
      </div>

      {/* 存在神明/信仰 checkbox */}
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={divineDesign.hasDivinity}
          onChange={e => {
            onDivineChange({ ...divineDesign, hasDivinity: e.target.checked })
          }}
          className="accent-accent"
        />
        <span className="text-text-secondary">存在神明或宗教信仰</span>
      </label>

      {divineDesign.hasDivinity && (
        <div className="space-y-0 divide-y divide-border/40">
          <div className="flex gap-4 py-3 first:pt-0">
            <span className="w-24 shrink-0 text-xs text-text-muted pt-0.5 text-right">信仰层级</span>
            <div className="flex-1 min-w-0">
              <InlineTextarea
                value={divineDesign.divineRank}
                onChange={v => onDivineChange({ ...divineDesign, divineRank: v })}
                placeholder="例：主神 / 次神 / 半神 / 国教 / 民间信仰 ..."
              />
            </div>
          </div>
          <div className="flex gap-4 py-3">
            <span className="w-24 shrink-0 text-xs text-text-muted pt-0.5 text-right">名号与职司</span>
            <div className="flex-1 min-w-0">
              <InlineTextarea
                value={divineDesign.divineNames}
                onChange={v => onDivineChange({ ...divineDesign, divineNames: v })}
                placeholder="例：天帝 · 创世神；关帝信仰；妈祖信仰 ..."
              />
            </div>
          </div>
          <div className="flex gap-4 py-3">
            <span className="w-24 shrink-0 text-xs text-text-muted pt-0.5 text-right">规则与禁忌</span>
            <div className="flex-1 min-w-0">
              <InlineTextarea
                value={divineDesign.divineRules}
                onChange={v => onDivineChange({ ...divineDesign, divineRules: v })}
                placeholder="例：不可直接干涉凡间 / 避讳字 / 祭祀风俗 ..."
              />
            </div>
          </div>
        </div>
      )}

      {/* AI 生成 */}
      <div className="flex items-center gap-2">
        <input
          value={hint} onChange={e => setHint(e.target.value)}
          placeholder="给 AI 的补充说明（可选）"
          className="flex-1 px-2 py-1.5 bg-bg-base border border-border rounded text-xs text-text-primary focus:outline-none focus:border-accent"
        />
        <button onClick={handleGenerate} disabled={ai.isStreaming}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded disabled:opacity-50 bg-accent/10 text-accent hover:bg-accent/20">
          <Sparkles className="w-3.5 h-3.5" /> AI 生成信仰体系
        </button>
      </div>

      <PromptRunPanel moduleKey="worldview.dimension" parameterValues={parameterValues}
        onParamChange={setParameterValues} systemOverride={systemOverride}
        onSystemOverrideChange={setSystemOverride} userOverride={userOverride}
        onUserOverrideChange={setUserOverride} />

      {(ai.output || ai.isStreaming || ai.error) && (
        <AIStreamOutput output={ai.output} isStreaming={ai.isStreaming} error={ai.error}
          tokenUsage={ai.tokenUsage} onStop={ai.stop}
          onAccept={handleAccept}
          onRetry={handleGenerate} moduleKey="worldview.dimension" />
      )}
    </div>
  )
}
