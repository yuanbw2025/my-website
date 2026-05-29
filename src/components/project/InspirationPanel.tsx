/**
 * Phase 26.4 — 灵感反推面板
 *
 * 用户写碎片灵感 → AI 反向生成世界观草稿 + 故事核心 + 初始角色卡 → 选择性采纳
 */

import { useState, useEffect } from 'react'
import {
  Lightbulb, Sparkles, Loader2, Check, ChevronDown, ChevronRight,
  Globe, BookOpen, UserCircle, ArrowDownToLine,
} from 'lucide-react'
import { useWorldviewStore } from '../../stores/worldview'
import { useCharacterStore } from '../../stores/character'
import { useAIStream } from '../../hooks/useAIStream'
import {
  buildInspirationReversePrompt,
  parseReverseOutput,
  type ReverseResult,
  type ReverseCharacter,
} from '../../lib/ai/inspiration-reverse'
import AIStreamOutput from '../shared/AIStreamOutput'
import AutoResizeTextarea from '../shared/AutoResizeTextarea'
import type { Project } from '../../lib/types'
import type { CharacterRole } from '../../lib/types/character'

interface Props {
  project: Project
}

const ROLE_MAP: Record<string, CharacterRole> = {
  protagonist: 'protagonist',
  antagonist: 'antagonist',
  supporting: 'supporting',
}

const ROLE_LABELS: Record<string, string> = {
  protagonist: '主角',
  antagonist: '反派',
  supporting: '配角',
}

export default function InspirationPanel({ project }: Props) {
  const wvStore = useWorldviewStore()
  const chStore = useCharacterStore()
  const ai = useAIStream()

  const [inspiration, setInspiration] = useState('')
  const [userHint, setUserHint] = useState('')
  const [result, setResult] = useState<ReverseResult | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['worldview', 'storyCore', 'characters']))
  const [adoptedSections, setAdoptedSections] = useState<Set<string>>(new Set())
  const [selectedChars, setSelectedChars] = useState<Set<number>>(new Set())
  const [adopting, setAdopting] = useState(false)

  // 解析 AI 输出
  useEffect(() => {
    if (!ai.isStreaming && ai.output) {
      const parsed = parseReverseOutput(ai.output)
      if (parsed) {
        setResult(parsed)
        setSelectedChars(new Set(parsed.characters.map((_, i) => i)))
      }
    }
  }, [ai.isStreaming, ai.output])

  const handleGenerate = async () => {
    if (!inspiration.trim()) return
    setResult(null)
    setAdoptedSections(new Set())

    const messages = buildInspirationReversePrompt(
      project.name,
      project.genres?.join('/') || project.genre || '',
      inspiration,
      userHint || undefined,
    )
    await ai.start(messages)
  }

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const toggleChar = (idx: number) => {
    setSelectedChars(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  // ── 采纳世界观 ─────────────────────────────────
  const handleAdoptWorldview = async () => {
    if (!result || adoptedSections.has('worldview')) return
    setAdopting(true)
    const wv = result.worldview
    await wvStore.saveWorldview({
      projectId: project.id!,
      summary: wv.summary || undefined,
      geography: wv.geography || undefined,
      society: wv.society || undefined,
      rules: wv.rules || undefined,
    })
    setAdoptedSections(prev => new Set(prev).add('worldview'))
    setAdopting(false)
  }

  // ── 采纳故事核心 ─────────────────────────────────
  const handleAdoptStoryCore = async () => {
    if (!result || adoptedSections.has('storyCore')) return
    setAdopting(true)
    const sc = result.storyCore
    await wvStore.saveStoryCore({
      projectId: project.id!,
      theme: sc.theme || undefined,
      centralConflict: sc.centralConflict || undefined,
      plotPattern: sc.plotPattern || undefined,
      mainPlot: sc.mainPlot || undefined,
      logline: sc.logline || undefined,
    })
    setAdoptedSections(prev => new Set(prev).add('storyCore'))
    setAdopting(false)
  }

  // ── 采纳角色 ─────────────────────────────────────
  const handleAdoptCharacters = async () => {
    if (!result || adoptedSections.has('characters')) return
    setAdopting(true)
    for (const idx of Array.from(selectedChars).sort()) {
      const c = result.characters[idx]
      if (!c || !c.name) continue
      await chStore.addCharacter({
        projectId: project.id!,
        name: c.name,
        role: ROLE_MAP[c.role] || 'supporting',
        shortDescription: c.shortDescription || '',
        appearance: '',
        personality: c.personality || '',
        background: c.background || '',
        motivation: c.motivation || '',
        abilities: '',
        relationships: '',
        arc: c.arc || '',
      })
    }
    setAdoptedSections(prev => new Set(prev).add('characters'))
    setAdopting(false)
  }

  // ── 一键全部采纳 ─────────────────────────────────
  const handleAdoptAll = async () => {
    if (!result) return
    setAdopting(true)
    if (!adoptedSections.has('worldview')) await handleAdoptWorldview()
    if (!adoptedSections.has('storyCore')) await handleAdoptStoryCore()
    if (!adoptedSections.has('characters')) await handleAdoptCharacters()
    setAdopting(false)
  }

  const allAdopted = adoptedSections.has('worldview') && adoptedSections.has('storyCore') && adoptedSections.has('characters')

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 顶部标题 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border-default bg-bg-surface">
        <Lightbulb className="w-5 h-5 text-yellow-500" />
        <h2 className="text-lg font-semibold text-text-primary">灵感反推</h2>
        <span className="text-xs text-text-muted ml-2">从碎片想法反推完整故事框架</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* ── 灵感输入 ────────────────────────────── */}
        <section>
          <label className="block text-sm font-medium text-text-primary mb-2">
            写下你的灵感
          </label>
          <AutoResizeTextarea
            value={inspiration}
            onChange={e => setInspiration(e.target.value)}
            placeholder={"随便写点什么...\n\n例如：\n- 一个在末世废墟中寻找失踪妹妹的退役军人\n- 古代宫廷里，一个替身公主发现了皇帝的秘密\n- 赛博朋克 + 修仙，用代码修炼的程序员\n- 甚至只是几个关键词：深海、孤岛、失忆、怪物"}
            className="w-full text-sm bg-bg-input border border-border-default rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted resize-none"
            minRows={5}
          />
        </section>

        {/* ── 补充说明 ────────────────────────────── */}
        <section>
          <label className="block text-xs text-text-muted mb-1">补充说明（可选）</label>
          <AutoResizeTextarea
            value={userHint}
            onChange={e => setUserHint(e.target.value)}
            placeholder="例如：偏黑暗风格、需要感情线、主角要有反转..."
            className="w-full text-sm bg-bg-input border border-border-default rounded px-3 py-2 text-text-primary placeholder:text-text-muted resize-none"
            minRows={2}
          />
        </section>

        {/* ── 生成按钮 ────────────────────────────── */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={!inspiration.trim() || ai.isStreaming}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-medium hover:bg-brand-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {ai.isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {ai.isStreaming ? '推演中...' : '开始反推'}
          </button>
          {ai.isStreaming && (
            <button onClick={ai.stop} className="text-xs text-text-muted hover:text-red-500 transition-colors">
              停止
            </button>
          )}
        </div>

        {/* ── AI 流式输出 ────────────────────────── */}
        {(ai.output || ai.isStreaming || ai.error) && (
          <AIStreamOutput
            output={ai.output}
            isStreaming={ai.isStreaming}
            error={ai.error}
            tokenUsage={ai.tokenUsage}
            onStop={ai.stop}
            onAccept={() => {
              const parsed = parseReverseOutput(ai.output)
              if (parsed) {
                setResult(parsed)
                setSelectedChars(new Set(parsed.characters.map((_, i) => i)))
              }
            }}
            onRetry={handleGenerate}
            placeholder="等待 AI 反推故事框架..."
            moduleKey="inspiration.reverse"
          />
        )}

        {/* ── 结构化结果预览 ─────────────────────── */}
        {result && !ai.isStreaming && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-text-primary">反推结果</h3>
              {!allAdopted && (
                <button
                  onClick={handleAdoptAll}
                  disabled={adopting}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:opacity-40 transition-colors"
                >
                  {adopting ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowDownToLine className="w-3 h-3" />}
                  一键全部采纳
                </button>
              )}
            </div>

            {/* ── 世界观卡片 ──────────────────────── */}
            <ResultCard
              title="世界观草稿"
              icon={<Globe className="w-4 h-4 text-blue-500" />}
              expanded={expandedSections.has('worldview')}
              onToggle={() => toggleSection('worldview')}
              adopted={adoptedSections.has('worldview')}
              onAdopt={handleAdoptWorldview}
              adopting={adopting}
              adoptLabel="写入世界观"
            >
              <div className="space-y-2 text-sm">
                {result.worldview.summary && (
                  <FieldRow label="摘要" value={result.worldview.summary} />
                )}
                {result.worldview.geography && (
                  <FieldRow label="地理" value={result.worldview.geography} />
                )}
                {result.worldview.society && (
                  <FieldRow label="社会" value={result.worldview.society} />
                )}
                {result.worldview.rules && (
                  <FieldRow label="规则" value={result.worldview.rules} />
                )}
              </div>
            </ResultCard>

            {/* ── 故事核心卡片 ────────────────────── */}
            <ResultCard
              title="故事核心"
              icon={<BookOpen className="w-4 h-4 text-purple-500" />}
              expanded={expandedSections.has('storyCore')}
              onToggle={() => toggleSection('storyCore')}
              adopted={adoptedSections.has('storyCore')}
              onAdopt={handleAdoptStoryCore}
              adopting={adopting}
              adoptLabel="写入故事设计"
            >
              <div className="space-y-2 text-sm">
                {result.storyCore.logline && (
                  <FieldRow label="一句话故事" value={result.storyCore.logline} highlight />
                )}
                {result.storyCore.theme && (
                  <FieldRow label="主题" value={result.storyCore.theme} />
                )}
                {result.storyCore.centralConflict && (
                  <FieldRow label="核心冲突" value={result.storyCore.centralConflict} />
                )}
                {result.storyCore.plotPattern && (
                  <FieldRow label="情节模式" value={result.storyCore.plotPattern} />
                )}
                {result.storyCore.mainPlot && (
                  <FieldRow label="主线" value={result.storyCore.mainPlot} />
                )}
              </div>
            </ResultCard>

            {/* ── 角色卡片 ────────────────────────── */}
            <ResultCard
              title={`初始角色（${result.characters.length} 个）`}
              icon={<UserCircle className="w-4 h-4 text-orange-500" />}
              expanded={expandedSections.has('characters')}
              onToggle={() => toggleSection('characters')}
              adopted={adoptedSections.has('characters')}
              onAdopt={handleAdoptCharacters}
              adopting={adopting}
              adoptLabel={`写入角色库（${selectedChars.size} 个）`}
            >
              <div className="space-y-3">
                {result.characters.map((ch, i) => (
                  <CharacterCard
                    key={i}
                    char={ch}
                    selected={selectedChars.has(i)}
                    onToggle={() => toggleChar(i)}
                    adopted={adoptedSections.has('characters')}
                  />
                ))}
              </div>
            </ResultCard>
          </section>
        )}
      </div>
    </div>
  )
}

// ── 子组件 ──────────────────────────────────────────────────────────────

function ResultCard({
  title, icon, expanded, onToggle, adopted, onAdopt, adopting, adoptLabel, children,
}: {
  title: string
  icon: React.ReactNode
  expanded: boolean
  onToggle: () => void
  adopted: boolean
  onAdopt: () => void
  adopting: boolean
  adoptLabel: string
  children: React.ReactNode
}) {
  return (
    <div className="border border-border-default rounded-lg overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-2.5 bg-bg-surface cursor-pointer hover:bg-bg-hover transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-text-muted" /> : <ChevronRight className="w-3.5 h-3.5 text-text-muted" />}
          {icon}
          <span className="text-sm font-medium text-text-primary">{title}</span>
        </div>
        {adopted ? (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <Check className="w-3.5 h-3.5" /> 已采纳
          </span>
        ) : (
          <button
            onClick={e => { e.stopPropagation(); onAdopt() }}
            disabled={adopting}
            className="flex items-center gap-1 px-2.5 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-40 transition-colors"
          >
            {adopting ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowDownToLine className="w-3 h-3" />}
            {adoptLabel}
          </button>
        )}
      </div>
      {expanded && (
        <div className="px-4 py-3 border-t border-border-default">
          {children}
        </div>
      )}
    </div>
  )
}

function FieldRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <span className="text-xs text-text-muted">{label}：</span>
      <span className={`text-text-primary ${highlight ? 'font-medium text-brand-primary' : ''}`}>
        {value}
      </span>
    </div>
  )
}

function CharacterCard({
  char, selected, onToggle, adopted,
}: {
  char: ReverseCharacter
  selected: boolean
  onToggle: () => void
  adopted: boolean
}) {
  return (
    <div className={`border rounded-lg p-3 transition-colors ${selected ? 'border-brand-primary bg-brand-primary/5' : 'border-border-default'}`}>
      <div className="flex items-center gap-2 mb-2">
        {!adopted && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="accent-brand-primary"
          />
        )}
        <span className="text-sm font-medium text-text-primary">{char.name}</span>
        <span className="text-xs px-1.5 py-0.5 bg-bg-hover rounded text-text-muted">
          {ROLE_LABELS[char.role] || char.role}
        </span>
      </div>
      {char.shortDescription && (
        <p className="text-xs text-brand-primary mb-1">{char.shortDescription}</p>
      )}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-text-muted">
        {char.personality && <span>性格：{char.personality}</span>}
        {char.motivation && <span>动机：{char.motivation}</span>}
        {char.background && <span className="col-span-2">背景：{char.background}</span>}
        {char.arc && <span className="col-span-2">弧光：{char.arc}</span>}
      </div>
    </div>
  )
}
