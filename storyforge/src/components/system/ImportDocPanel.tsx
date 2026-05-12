import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Upload, Sparkles, AlertTriangle, FileText, Wand2, Info,
  PauseCircle, PlayCircle, StopCircle, History,
} from 'lucide-react'
import {
  extractTextFromFile, ACCEPT_ATTR, FILE_LIMIT_HINTS,
} from '../../lib/doc-parser'
import { chunkDocument, quickHash, type ChunkPlan } from '../../lib/import/chunker'
import {
  runSession, pausePipeline, cancelPipeline, retryFailedChunks,
  registerChunkTexts, hasChunkTexts, clearChunkTexts,
} from '../../lib/import/pipeline'
import { useImportSessionStore } from '../../stores/import-session'
import { useImportStatusStore } from '../../stores/import-status'
import ImportConfirmModal from './import/ImportConfirmModal'
import ImportReportModal from './import/ImportReportModal'
import ImportStatusBar from './import/ImportStatusBar'
import ImportProgressPanel from './import/ImportProgressPanel'
import ImportActivityLog from './import/ImportActivityLog'
import type { Project } from '../../lib/types'
import type { ImportSession, ChunkState } from '../../lib/types/import-session'

interface Props { project: Project }

const DEFAULT_CHUNK_SIZE = 50000

/**
 * v3 §6 Phase 18 — 大文档分块解析导入（重写版）
 *
 * 用户只要上传一个文件 → 预览确认 → AI 串行分块解析 → 实时入库 → 汇报结果。
 * 支持百万～千万字文档，断点续跑，自动重试，跨块角色合并。
 */
export default function ImportDocPanel({ project }: Props) {
  const [filename, setFilename] = useState('')
  const [rawText, setRawText] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)
  const [loadingFile, setLoadingFile] = useState(false)
  const [extractInfo, setExtractInfo] = useState<string | null>(null)

  // 切块结果 + confirm modal
  const [plans, setPlans] = useState<ChunkPlan[] | null>(null)
  const [chunkSize, setChunkSize] = useState(DEFAULT_CHUNK_SIZE)
  const [showConfirm, setShowConfirm] = useState(false)

  // 报告 modal + 未完成会话
  const [reportSession, setReportSession] = useState<ImportSession | null>(null)
  const [unfinished, setUnfinished] = useState<ImportSession | null>(null)

  const status = useImportStatusStore()
  const phase = status.phase
  const isRunning = phase === 'running' || phase === 'merging' || phase === 'preparing'
  const isPaused = phase === 'paused'

  // ── 初始：扫描项目内未完成会话 ─────────────────────────────
  useEffect(() => {
    let cancelled = false
    const scan = async () => {
      const s = await useImportSessionStore.getState().findUnfinished(project.id!)
      if (!cancelled) setUnfinished(s)
    }
    scan()
    return () => { cancelled = true }
  }, [project.id])

  // ── phase 变成 done/failed 时自动弹 ReportModal ─────────────
  const autoReportShown = useRef<number | null>(null)
  useEffect(() => {
    const showReport = async () => {
      if ((phase === 'done' || phase === 'failed') && status.sessionId
          && autoReportShown.current !== status.sessionId) {
        autoReportShown.current = status.sessionId
        const s = await useImportSessionStore.getState().load(status.sessionId)
        if (s) setReportSession(s)
      }
    }
    showReport()
  }, [phase, status.sessionId])

  // ── 文件上传 ──────────────────────────────────────────────
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setFileError(null)
    setExtractInfo(null)
    setFilename(f.name)
    setRawText('')
    setPlans(null)
    setLoadingFile(true)
    try {
      const result = await extractTextFromFile(f)
      setRawText(result.text)
      const sizeMB = (f.size / 1024 / 1024).toFixed(2)
      const parts = [
        `文件 ${sizeMB} MB`,
        `抽取 ${result.rawChars.toLocaleString()} 字符`,
      ]
      if (result.pageCount) parts.push(`${result.pageCount} 页`)
      setExtractInfo(parts.join(' · '))
    } catch (err) {
      setFilename('')
      setFileError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoadingFile(false)
    }
  }

  // ── 点击"开始解析" ───────────────────────────────────────
  const handleStart = () => {
    if (!rawText.trim()) return
    const p = chunkDocument(rawText, { targetChars: chunkSize })
    setPlans(p)
    setShowConfirm(true)
  }

  // 改 chunkSize 时重新切
  const handleChunkSizeChange = (size: number) => {
    setChunkSize(size)
    if (rawText.trim()) {
      const p = chunkDocument(rawText, { targetChars: size })
      setPlans(p)
    }
  }

  // ── 在 Confirm Modal 里确认：创建 session 并启动 ───────────
  const handleConfirmStart = async () => {
    if (!plans) return
    setShowConfirm(false)

    useImportStatusStore.getState().reset()
    useImportStatusStore.getState().setPhase('preparing')

    const sessionData: Omit<ImportSession, 'id' | 'createdAt' | 'updatedAt'> = {
      projectId: project.id!,
      filename: filename || '未命名文档',
      fileHash: quickHash(rawText),
      totalChars: rawText.length,
      totalChunks: plans.length,
      chunkSize,
      chunks: plans.map<ChunkState>(p => ({
        index: p.index,
        startChar: p.startChar,
        endChar: p.endChar,
        charCount: p.charCount,
        label: p.label,
        status: 'pending',
        attempts: 0,
      })),
      merged: { worldview: {}, characters: [], outline: [] },
      rollingContext: '',
      status: 'pending',
    }

    const sessionId = await useImportSessionStore.getState().create(sessionData)
    registerChunkTexts(sessionId, plans.map(p => ({ index: p.index, text: p.text })))

    // 刷新未完成列表（新 session 本身就是未完成态）
    setUnfinished(null)
    autoReportShown.current = null
    setReportSession(null)

    // 启动流水线（不 await，让 UI 先渲染 StatusBar/ProgressPanel）
    runSession({ sessionId, projectId: project.id! }).catch(err => {
      console.error('[import] runSession 崩了：', err)
    })
  }

  // ── 续跑入口 ──────────────────────────────────────────────
  const handleResume = async () => {
    if (!unfinished?.id) return
    // 原文在内存里还在吗？
    if (!hasChunkTexts(unfinished.id)) {
      alert('⚠ 页面已刷新或浏览器已重开，内存里的原文丢失了。\n请重新上传同一文件，再点"开始解析"即可从断点续跑。')
      return
    }
    autoReportShown.current = null
    setReportSession(null)
    await runSession({ sessionId: unfinished.id, projectId: project.id! })
  }

  // ── 继续上一个（用当前上传的文件填上去） ────────────────
  const handleResumeWithUploaded = async () => {
    if (!unfinished?.id || !rawText) return
    // 如果 hash 能对上就用这次上传的文本覆盖 in-memory 原文，从断点续跑
    const newHash = quickHash(rawText)
    if (newHash !== unfinished.fileHash) {
      const ok = confirm(
        `⚠ 上传的文件与未完成任务的原文不一致。\n\n` +
        `原任务文件 hash: ${unfinished.fileHash}\n` +
        `当前上传 hash:   ${newHash}\n\n` +
        `仍要用当前文件继续吗？（强烈不建议 —— 可能会出现角色/章节错位）`,
      )
      if (!ok) return
    }
    // 重新切块得到原文
    const p = chunkDocument(rawText, { targetChars: unfinished.chunkSize })
    // 如果块数对得上才能 registerChunkTexts
    if (p.length !== unfinished.totalChunks) {
      alert(`⚠ 重新切块得到 ${p.length} 块，与原任务的 ${unfinished.totalChunks} 块不一致，无法续跑。\n建议：「清理」该任务后重新开始解析。`)
      return
    }
    registerChunkTexts(unfinished.id, p.map(c => ({ index: c.index, text: c.text })))
    setUnfinished(null)
    autoReportShown.current = null
    setReportSession(null)
    await runSession({ sessionId: unfinished.id, projectId: project.id! })
  }

  // ── Report Modal 里：重试失败块 / 关闭 / 清理 ─────────────
  const handleRetryFailed = async () => {
    if (!reportSession?.id) return
    if (!hasChunkTexts(reportSession.id)) {
      alert('⚠ 原文已从内存清除，请重新上传同一文件后才能重试失败块。')
      return
    }
    setReportSession(null)
    autoReportShown.current = null
    await retryFailedChunks({ sessionId: reportSession.id, projectId: project.id! })
  }
  const handleCloseReport = () => {
    setReportSession(null)
    // done 的会话：清内存原文释放内存
    if (reportSession?.id && reportSession.status === 'done') {
      clearChunkTexts(reportSession.id)
    }
  }
  const handleDiscardSession = async () => {
    if (!reportSession?.id) return
    if (!confirm('确认清理本次会话记录？已入库的解析数据不会被删除。')) return
    clearChunkTexts(reportSession.id)
    await useImportSessionStore.getState().deleteSession(reportSession.id)
    setReportSession(null)
    useImportStatusStore.getState().reset()
  }

  // ── 预览统计 ──────────────────────────────────────────────
  const previewPlans = useMemo(() => {
    if (!rawText.trim()) return null
    return plans || chunkDocument(rawText, { targetChars: chunkSize })
  }, [rawText, chunkSize, plans])

  return (
    <div className="max-w-4xl p-6 space-y-4">
      {/* 顶部状态条：流水线跑起来后常驻显示 */}
      {phase !== 'idle' && (
        <div className="sticky top-0 z-10 bg-bg-base pb-2 flex items-center justify-between gap-3">
          <ImportStatusBar />
          <div className="flex items-center gap-1">
            {isRunning && (
              <button
                onClick={pausePipeline}
                className="flex items-center gap-1 px-2 py-1 text-xs text-warn hover:bg-warn/10 rounded"
              >
                <PauseCircle className="w-3.5 h-3.5" /> 暂停
              </button>
            )}
            {isPaused && status.sessionId && (
              <button
                onClick={() => runSession({ sessionId: status.sessionId!, projectId: project.id! })}
                className="flex items-center gap-1 px-2 py-1 text-xs text-accent hover:bg-accent/10 rounded"
              >
                <PlayCircle className="w-3.5 h-3.5" /> 恢复
              </button>
            )}
            {(isRunning || isPaused) && (
              <button
                onClick={() => {
                  if (confirm('确认取消本次任务？已入库的解析数据不会被删除。')) {
                    cancelPipeline()
                  }
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs text-error hover:bg-error/10 rounded"
              >
                <StopCircle className="w-3.5 h-3.5" /> 取消
              </button>
            )}
          </div>
        </div>
      )}

      {/* 标题 + 介绍 */}
      <div>
        <h2 className="text-xl font-bold text-text-primary mb-1">📥 AI 分块文档解析</h2>
        <p className="text-sm text-text-muted">
          上传任意一份文档（设定集、成品小说、大纲草稿……甚至千万字长篇），AI 自动分块串行解析并入库
          <span className="text-accent">世界观 / 角色 / 大纲章节</span>。
        </p>
        <div className="mt-2 bg-bg-surface border border-border rounded-lg p-3 text-xs text-text-secondary">
          <div className="flex items-center gap-1.5 mb-1.5 text-text-primary">
            <Info className="w-3.5 h-3.5 text-accent" />
            <span className="font-medium">支持的文件格式与大小上限</span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {FILE_LIMIT_HINTS.map(h => (
              <div key={h.ext} className="text-center px-2 py-1.5 bg-bg-base rounded">
                <div className="text-xs font-mono text-accent">.{h.ext}</div>
                <div className="text-[10px] text-text-muted">{h.label}</div>
                <div className="text-xs text-text-primary font-medium">≤ {h.mb} MB</div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[11px] text-text-muted leading-relaxed">
            ⚠️ 大文档会自动按「章节边界」或「段落 / 字符数」切块，每块约 {chunkSize.toLocaleString()} 字，AI 串行处理。<br/>
            ⚠️ 页面刷新 / 关闭浏览器会丢内存里的原文，续跑时请重新上传同一份文件。
          </div>
        </div>
      </div>

      {/* 未完成会话提示 */}
      {unfinished && phase === 'idle' && (
        <div className="bg-warn/5 border border-warn/30 rounded-xl p-4 flex items-start gap-3">
          <History className="w-5 h-5 text-warn mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-warn mb-1">
              发现未完成的解析任务
            </div>
            <div className="text-xs text-text-secondary leading-relaxed">
              文件「<strong>{unfinished.filename}</strong>」还剩 {
                unfinished.chunks.filter(c => c.status !== 'done').length
              } 块未解析（共 {unfinished.totalChunks} 块 · 状态：{unfinished.status}）。
            </div>
            <div className="flex items-center gap-2 mt-2">
              {hasChunkTexts(unfinished.id!) ? (
                <button
                  onClick={handleResume}
                  className="flex items-center gap-1 px-3 py-1.5 bg-warn text-white text-xs rounded hover:bg-warn/90"
                >
                  <PlayCircle className="w-3.5 h-3.5" /> 立即续跑
                </button>
              ) : rawText.trim() ? (
                <button
                  onClick={handleResumeWithUploaded}
                  className="flex items-center gap-1 px-3 py-1.5 bg-warn text-white text-xs rounded hover:bg-warn/90"
                >
                  <PlayCircle className="w-3.5 h-3.5" /> 用当前文件续跑
                </button>
              ) : (
                <span className="text-xs text-text-muted">请先在下方重新上传同一文件</span>
              )}
              <button
                onClick={() => {
                  setReportSession(unfinished)
                }}
                className="px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover rounded"
              >
                查看详情
              </button>
              <button
                onClick={async () => {
                  if (!confirm('确认放弃这个未完成任务？已入库数据不会被删除。')) return
                  await useImportSessionStore.getState().deleteSession(unfinished.id!)
                  clearChunkTexts(unfinished.id!)
                  setUnfinished(null)
                }}
                className="px-3 py-1.5 text-xs text-text-muted hover:text-error rounded"
              >
                放弃
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 上传区 */}
      {phase === 'idle' && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-text-secondary">文档内容</label>
            <label className={`flex items-center gap-1 px-2 py-1 text-xs rounded cursor-pointer ${
              loadingFile ? 'text-text-muted bg-bg-hover' : 'text-accent hover:bg-accent/10'
            }`}>
              <Upload className="w-3 h-3" />
              {loadingFile ? '正在提取...' : '上传文件'}
              <input
                type="file"
                accept={ACCEPT_ATTR}
                disabled={loadingFile}
                className="hidden"
                onChange={handleFile}
              />
            </label>
          </div>
          {fileError && (
            <div className="mb-1.5 px-2 py-1.5 bg-error/10 border border-error/30 rounded text-xs text-error flex items-start gap-1.5">
              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {fileError}
            </div>
          )}
          {filename && !fileError && (
            <p className="text-xs text-text-muted mb-1.5 flex items-center gap-1">
              <FileText className="w-3 h-3" /> {filename}
              {extractInfo && <span className="ml-1 opacity-70">· {extractInfo}</span>}
            </p>
          )}
          <textarea
            value={rawText}
            onChange={e => { setRawText(e.target.value); setPlans(null) }}
            placeholder="把文档内容粘贴在这里，或上方点「上传文件」——AI 会自己判断是设定集 / 成品小说 / 大纲，哪怕千万字也没事。"
            rows={10}
            className="w-full px-3 py-2 bg-bg-base border border-border rounded text-sm text-text-primary font-mono resize-y focus:outline-none focus:border-accent"
          />

          {/* 预切块预览 */}
          {previewPlans && previewPlans.length > 0 && (
            <div className="mt-2 text-xs text-text-muted flex items-center gap-1">
              <Wand2 className="w-3 h-3 text-accent" />
              预计拆成 <strong className="text-accent">{previewPlans.length}</strong> 块
              （每块约 {chunkSize.toLocaleString()} 字 · 共 {rawText.length.toLocaleString()} 字）
            </div>
          )}

          {/* 开始按钮 */}
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleStart}
              disabled={!rawText.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white text-sm rounded hover:bg-accent-hover disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              开始解析
            </button>
          </div>
        </div>
      )}

      {/* 运行时：进度面板 + 活动日志 */}
      {phase !== 'idle' && (
        <div className="space-y-3">
          <ImportProgressPanel />
          <ImportActivityLog />
          {status.fatalError && (
            <div className="bg-error/10 border border-error/30 rounded-xl p-3 text-sm text-error">
              <AlertTriangle className="inline w-4 h-4 mr-1" />
              {status.fatalError}
            </div>
          )}
        </div>
      )}

      {/* Confirm Modal */}
      {showConfirm && plans && (
        <ImportConfirmModal
          filename={filename || '未命名文档'}
          totalChars={rawText.length}
          chunks={plans}
          chunkSize={chunkSize}
          onChunkSizeChange={handleChunkSizeChange}
          onConfirm={handleConfirmStart}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {/* Report Modal */}
      {reportSession && (
        <ImportReportModal
          session={reportSession}
          onRetryFailed={handleRetryFailed}
          onClose={handleCloseReport}
          onDiscard={handleDiscardSession}
        />
      )}
    </div>
  )
}
