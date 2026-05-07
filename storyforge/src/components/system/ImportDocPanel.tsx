import { useState } from 'react'
import {
  Upload, Sparkles, Check, AlertTriangle, FileText, Users, Globe, BookOpen,
} from 'lucide-react'
import { useAIStream } from '../../hooks/useAIStream'
import { buildImportParsePrompt, extractJSON, type ImportParseType } from '../../lib/ai/adapters/import-adapter'
import { useCharacterStore } from '../../stores/character'
import { useWorldviewStore } from '../../stores/worldview'
import { useOutlineStore } from '../../stores/outline'
import type { Project, CharacterRole } from '../../lib/types'

interface Props {
  project: Project
}

const TYPE_OPTIONS: { value: ImportParseType; label: string; icon: typeof Users; desc: string }[] = [
  { value: 'character', label: '角色', icon: Users, desc: '从角色设定文档批量导入角色卡片' },
  { value: 'worldview', label: '世界观', icon: Globe, desc: '从设定集导入世界观字段（合并到现有）' },
  { value: 'outline',   label: '大纲', icon: BookOpen, desc: '从大纲文档导入卷/章节结构' },
]

const ACCEPTED_EXTENSIONS = '.txt,.md,.csv'

/** v3 §6 Phase 10 — AI 文档解析导入 */
export default function ImportDocPanel({ project }: Props) {
  const [type, setType] = useState<ImportParseType>('character')
  const [rawText, setRawText] = useState('')
  const [filename, setFilename] = useState<string>('')
  const [parsed, setParsed] = useState<unknown>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importDone, setImportDone] = useState<string | null>(null)
  const ai = useAIStream()

  const { addCharacter } = useCharacterStore()
  const { saveWorldview, worldview, loadAll: loadWorldview } = useWorldviewStore()
  const { addNode, loadAll: loadOutline } = useOutlineStore()

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFilename(f.name)
    const text = await f.text()
    setRawText(text)
    setParsed(null)
    setImportDone(null)
    e.target.value = ''
  }

  const handleParse = async () => {
    setParsed(null)
    setParseError(null)
    setImportDone(null)
    const messages = buildImportParsePrompt(type, rawText)
    const fullOutput = await ai.start(messages)
    if (!fullOutput) return
    try {
      const obj = extractJSON(fullOutput)
      setParsed(obj)
    } catch (e) {
      setParseError(`AI 输出无法解析为 JSON：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const handleImport = async () => {
    if (!parsed) return
    setImporting(true)
    setImportDone(null)
    try {
      let summary = ''
      if (type === 'character' && Array.isArray(parsed)) {
        let count = 0
        for (const raw of parsed) {
          const c = raw as Record<string, unknown>
          if (typeof c.name !== 'string' || !c.name) continue
          const role = (c.role as CharacterRole) || 'minor'
          await addCharacter({
            projectId: project.id!,
            name: c.name,
            role,
            shortDescription: String(c.shortDescription || ''),
            appearance: String(c.appearance || ''),
            personality: String(c.personality || ''),
            background: String(c.background || ''),
            motivation: String(c.motivation || ''),
            abilities: String(c.abilities || ''),
            relationships: String(c.relationships || ''),
            arc: String(c.arc || ''),
          })
          count++
        }
        summary = `已导入 ${count} 个角色`
      } else if (type === 'worldview' && typeof parsed === 'object' && parsed !== null) {
        await loadWorldview(project.id!)
        const fields = parsed as Record<string, unknown>
        const patch: Record<string, string> = {}
        for (const [k, v] of Object.entries(fields)) {
          if (typeof v === 'string' && v.trim()) {
            // 合并：已有内容时追加，否则直接写
            const existing = (worldview?.[k as keyof typeof worldview] as string) || ''
            patch[k] = existing ? `${existing}\n\n${v}` : v
          }
        }
        await saveWorldview({ projectId: project.id!, ...patch })
        summary = `已合并 ${Object.keys(patch).length} 个世界观字段`
      } else if (type === 'outline' && Array.isArray(parsed)) {
        let count = 0
        let chapterOrder = 0
        let volumeOrder = 0
        const writeNode = async (
          node: Record<string, unknown>,
          parentId: number | null,
        ): Promise<void> => {
          if (typeof node.title !== 'string') return
          const isVolume = node.type === 'volume' || (Array.isArray(node.children) && node.children.length > 0)
          const order = isVolume ? volumeOrder++ : chapterOrder++
          const id = await addNode({
            projectId: project.id!,
            parentId,
            type: isVolume ? 'volume' : 'chapter',
            title: node.title,
            summary: String(node.summary || ''),
            order,
          })
          count++
          if (Array.isArray(node.children)) {
            for (const child of node.children) {
              await writeNode(child as Record<string, unknown>, id)
            }
          }
        }
        for (const n of parsed) {
          await writeNode(n as Record<string, unknown>, null)
        }
        await loadOutline(project.id!)
        summary = `已导入 ${count} 个大纲节点`
      } else {
        summary = '解析结果格式不符合预期，跳过写入'
      }
      setImportDone(summary)
    } catch (e) {
      alert(`导入失败：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="max-w-4xl p-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold text-text-primary mb-1">📥 AI 文档解析导入</h2>
        <p className="text-sm text-text-muted">
          上传或粘贴你已有的角色卡 / 世界观设定 / 大纲文档，AI 自动结构化后批量入库。当前支持 .txt / .md / .csv（其他格式请先转纯文本）。
        </p>
      </div>

      {/* 类型选择 */}
      <div>
        <label className="block text-xs text-text-secondary mb-1.5">导入类型</label>
        <div className="grid grid-cols-3 gap-2">
          {TYPE_OPTIONS.map(opt => {
            const Icon = opt.icon
            const active = type === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => setType(opt.value)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  active ? 'border-accent bg-accent/10' : 'border-border bg-bg-surface hover:border-text-muted'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 ${active ? 'text-accent' : 'text-text-secondary'}`} />
                  <span className={`text-sm font-medium ${active ? 'text-accent' : 'text-text-primary'}`}>
                    {opt.label}
                  </span>
                </div>
                <p className="text-xs text-text-muted">{opt.desc}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* 上传 / 粘贴 */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-text-secondary">文档内容</label>
          <label className="flex items-center gap-1 px-2 py-1 text-xs text-accent hover:bg-accent/10 rounded cursor-pointer">
            <Upload className="w-3 h-3" />
            上传文件
            <input type="file" accept={ACCEPTED_EXTENSIONS} className="hidden" onChange={handleFile} />
          </label>
        </div>
        {filename && (
          <p className="text-xs text-text-muted mb-1.5 flex items-center gap-1">
            <FileText className="w-3 h-3" /> {filename} ({rawText.length.toLocaleString()} 字符)
          </p>
        )}
        <textarea
          value={rawText}
          onChange={e => { setRawText(e.target.value); setParsed(null); setImportDone(null) }}
          placeholder="把文档内容粘贴在这里，或上方点「上传文件」..."
          rows={10}
          className="w-full px-3 py-2 bg-bg-base border border-border rounded text-sm text-text-primary font-mono resize-y focus:outline-none focus:border-accent"
        />
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleParse}
          disabled={!rawText.trim() || ai.isStreaming}
          className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white text-sm rounded hover:bg-accent-hover disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          {ai.isStreaming ? 'AI 解析中...' : 'AI 解析'}
        </button>
        {ai.isStreaming && (
          <button
            onClick={ai.stop}
            className="px-3 py-2 text-text-secondary text-sm rounded hover:bg-bg-hover"
          >
            停止
          </button>
        )}
        {parsed != null && !importing && !importDone && (
          <button
            onClick={handleImport}
            className="flex items-center gap-1.5 px-4 py-2 bg-success text-white text-sm rounded hover:bg-success/90"
          >
            <Check className="w-4 h-4" />
            确认导入
          </button>
        )}
      </div>

      {/* AI 输出 */}
      {(ai.output || ai.error) && !parsed && (
        <div className="bg-bg-surface border border-border rounded-xl p-3">
          <div className="text-xs text-text-secondary mb-1">AI 原始输出{ai.isStreaming ? '（流式中...）' : ''}</div>
          {ai.error && (
            <div className="text-error text-sm mb-2 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> {ai.error}
            </div>
          )}
          <pre className="text-xs text-text-primary font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
            {ai.output}
          </pre>
        </div>
      )}

      {/* JSON 预览 */}
      {parseError && (
        <div className="bg-error/10 border border-error/30 rounded-xl p-3 text-sm text-error">
          {parseError}
          <pre className="mt-2 text-xs font-mono whitespace-pre-wrap text-text-primary opacity-80 max-h-40 overflow-y-auto">
            {ai.output}
          </pre>
        </div>
      )}

      {parsed != null && (
        <div className="bg-bg-surface border border-success/40 rounded-xl p-3">
          <div className="text-xs text-success mb-1.5">
            ✓ 解析成功 · {Array.isArray(parsed) ? `${parsed.length} 项` : '1 个对象'}
          </div>
          <pre className="text-xs text-text-primary font-mono whitespace-pre-wrap max-h-64 overflow-y-auto bg-bg-base p-2 rounded">
            {JSON.stringify(parsed, null, 2)}
          </pre>
        </div>
      )}

      {importDone && (
        <div className="bg-success/10 border border-success/30 rounded-xl p-3 text-sm text-success flex items-center gap-2">
          <Check className="w-4 h-4" /> {importDone}
        </div>
      )}
    </div>
  )
}
