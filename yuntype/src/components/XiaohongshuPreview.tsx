// 小红书预览组件 — 缩略图网格 + 大图预览

import { useState, useMemo, useRef, useEffect, type ReactNode } from 'react'
import { splitToPagesV2, renderXhsPageV2, XHS_PRESETS, type XhsConfig, type PageTemplateType, type PageElement } from '../lib/render/xiaohongshu'
import { exportAllPagesAsZip, downloadSinglePage } from '../lib/export/image'
import type { StyleComboV2, AtomIdsV2 } from '../lib/atoms'
import type { ColorOverride } from '../lib/atoms/colors'
import ColorCustomDialog from './ColorCustomDialog'

const TEMPLATE_OPTIONS: { value: PageTemplateType; label: string }[] = [
  { value: 'standard',       label: '📄 标准' },
  { value: 'card-list',      label: '🃏 卡片列表' },
  { value: 'feature-grid',   label: '🔲 特性网格' },
  { value: 'workflow',       label: '🔢 流程步骤' },
  { value: 'text-highlight', label: '💬 文字高亮' },
]

interface XhsPreviewProps {
  markdown: string
  style: StyleComboV2
  comboName: string
  atomIdsV2?: AtomIdsV2
  onColorChange?: (colorId: string, override?: ColorOverride) => void
  onShuffle?: () => void
}

type AspectRatio = '3:4' | '16:9'

export default function XiaohongshuPreview({ markdown, style, comboName, atomIdsV2, onColorChange, onShuffle }: XhsPreviewProps) {
  const [ratio, setRatio] = useState<AspectRatio>('3:4')
  const [colorDialogOpen, setColorDialogOpen] = useState(false)
  const [selectedPage, setSelectedPage] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [pageOrder, setPageOrder] = useState<number[]>([])
  const [templateOverrides, setTemplateOverrides] = useState<Record<number, PageTemplateType>>({})
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [textOverrides, setTextOverrides] = useState<Record<string, string>>({})
  const [elementsOverride, setElementsOverride] = useState<Record<number, PageElement[]>>({})
  const [editMode, setEditMode] = useState(false)
  type Snapshot = {
    pageOrder: number[]
    templateOverrides: Record<number, PageTemplateType>
    textOverrides: Record<string, string>
    elementsOverride: Record<number, PageElement[]>
  }
  const [history, setHistory] = useState<Snapshot[]>([])
  const [future, setFuture] = useState<Snapshot[]>([])
  const dragItemRef = useRef<number | null>(null)
  const dragOverRef = useRef<number | null>(null)
  const [previewEl, setPreviewEl] = useState<HTMLDivElement | null>(null)
  const snapshotRef = useRef<() => Snapshot>(() => ({ pageOrder: [], templateOverrides: {}, textOverrides: {}, elementsOverride: {} }))

  const config: XhsConfig = XHS_PRESETS[ratio]

  const rawPages = useMemo(() => {
    if (!markdown.trim()) return []
    return splitToPagesV2(markdown, config, style)
  }, [markdown, config, style])

  // 页面排序 + 模板覆盖 + 文本编辑：当原始页面变化时重置
  useMemo(() => {
    setPageOrder(rawPages.map((_, i) => i))
    setTemplateOverrides({})
    setTextOverrides({})
    setElementsOverride({})
    setHistory([])
    setFuture([])
    setShowTemplatePicker(false)
  }, [rawPages.length])

  // 按用户排列顺序得到的页面
  const pages = useMemo(() => {
    if (pageOrder.length !== rawPages.length) return rawPages
    return pageOrder.map(i => rawPages[i]).filter(Boolean)
  }, [rawPages, pageOrder])

  // 应用块级/模板/文本覆盖
  const pagesWithOverrides = useMemo(() => {
    return pages.map((page, i) => {
      const hasText = Object.keys(textOverrides).length > 0
      let next = page
      // 块级覆盖（重排/删除/复制）
      const elOv = elementsOverride[page.pageIndex]
      if (elOv && page.type === 'content') {
        next = { ...page, elements: elOv }
      }
      if (hasText) {
        const pi = next.pageIndex
        if (next.type === 'cover') {
          const t = textOverrides['cover-title']
          const s = textOverrides['cover-summary']
          if (t !== undefined || s !== undefined) {
            const els = next.elements.map((el, j) => {
              if (j === 0 && t !== undefined) return { ...el, content: t }
              if (j === 1 && s !== undefined) return { ...el, content: s }
              return el
            })
            next = { ...next, elements: els }
          }
        } else if (next.type === 'content') {
          const els = next.elements.map((el, j) => {
            const baseId = `p${pi}-e${j}`
            if (el.type === 'list') {
              const items = (el.items ?? []).map((v, k) => textOverrides[`${baseId}-${k}`] ?? v)
              return { ...el, items }
            }
            const v = textOverrides[baseId]
            return v !== undefined ? { ...el, content: v } : el
          })
          next = { ...next, elements: els }
        }
      }
      if (next.type !== 'content') return next
      const override = templateOverrides[i]
      if (!override) return next
      return { ...next, templateType: override }
    })
  }, [pages, templateOverrides, textOverrides, elementsOverride])

  // ─── 历史快照 ──────────────────────────
  const snapshot = (): Snapshot => ({
    pageOrder: [...pageOrder],
    templateOverrides: { ...templateOverrides },
    textOverrides: { ...textOverrides },
    elementsOverride: { ...elementsOverride },
  })
  snapshotRef.current = snapshot
  const applySnapshot = (s: Snapshot) => {
    setPageOrder(s.pageOrder)
    setTemplateOverrides(s.templateOverrides)
    setTextOverrides(s.textOverrides)
    setElementsOverride(s.elementsOverride)
  }
  const commit = (fn: () => void) => {
    setHistory(h => [...h.slice(-49), snapshot()])
    setFuture([])
    fn()
  }
  const undo = () => {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    setHistory(h => h.slice(0, -1))
    setFuture(f => [snapshot(), ...f].slice(0, 50))
    applySnapshot(prev)
  }
  const redo = () => {
    if (future.length === 0) return
    const next = future[0]
    setFuture(f => f.slice(1))
    setHistory(h => [...h, snapshot()].slice(-50))
    applySnapshot(next)
  }

  // Ctrl/Cmd+Z / Shift+Z
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  // 拖拽排序
  const handleDragStart = (idx: number) => { dragItemRef.current = idx }
  const handleDragEnter = (idx: number) => { dragOverRef.current = idx }
  const handleDragEnd = () => {
    if (dragItemRef.current === null || dragOverRef.current === null) return
    if (dragItemRef.current === dragOverRef.current) return
    commit(() => {
      const newOrder = [...pageOrder]
      const [removed] = newOrder.splice(dragItemRef.current!, 1)
      newOrder.splice(dragOverRef.current!, 0, removed)
      setPageOrder(newOrder)
      setSelectedPage(dragOverRef.current!)
    })
    dragItemRef.current = null
    dragOverRef.current = null
  }

  // 监听 contenteditable 失焦 → 保存文本覆盖
  useEffect(() => {
    const el = previewEl
    if (!el) return
    const handler = (ev: FocusEvent) => {
      const target = ev.target as HTMLElement | null
      if (!target || !target.getAttribute) return
      const id = target.getAttribute('data-edit-id')
      if (!id) return
      const mode = target.getAttribute('data-edit-mode') ?? 'html'
      const raw = mode === 'text'
        ? (target.textContent ?? '').trim()
        : (target.innerHTML ?? '').trim()
      const snap = snapshotRef.current()
      if (snap.textOverrides[id] === raw) return
      setHistory(h => [...h.slice(-49), snap])
      setFuture([])
      setTextOverrides(prev => ({ ...prev, [id]: raw }))
    }
    el.addEventListener('focusout', handler, true)
    return () => el.removeEventListener('focusout', handler, true)
  }, [previewEl])

  // 编辑模式关闭时，禁用页面里的 contenteditable（通过 CSS pointer-events 不够，直接切换属性）
  useEffect(() => {
    const el = previewEl
    if (!el) return
    const nodes = el.querySelectorAll('[data-edit-id]')
    nodes.forEach(n => {
      (n as HTMLElement).setAttribute('contenteditable', editMode ? 'true' : 'false')
      ;(n as HTMLElement).style.cursor = editMode ? 'text' : 'default'
      ;(n as HTMLElement).style.background = editMode ? 'rgba(79,70,229,0.06)' : 'transparent'
      ;(n as HTMLElement).style.borderRadius = editMode ? '4px' : ''
    })
  })

  // 当前页（已套用所有 overrides）
  const currentPage = pagesWithOverrides[Math.min(selectedPage, pagesWithOverrides.length - 1)]

  // 块级动作：作用于原始 page（pageOrder 空间内）的 elements，写入以 pageIndex 为键的 override
  function mutateElements(pageIndex: number, mutator: (els: PageElement[]) => PageElement[]) {
    const basePage = rawPages.find(p => p.pageIndex === pageIndex)
    if (!basePage) return
    const current = elementsOverride[pageIndex] ?? basePage.elements
    const next = mutator(current.slice())
    commit(() => {
      setElementsOverride(prev => ({ ...prev, [pageIndex]: next }))
      // 块重排 → 同页的文本覆盖会失效，清理之
      setTextOverrides(prev => Object.fromEntries(
        Object.entries(prev).filter(([k]) => !k.startsWith(`p${pageIndex}-e`))
      ))
    })
  }
  const blockUp = (pi: number, i: number) => mutateElements(pi, els => {
    if (i <= 0) return els
    ;[els[i - 1], els[i]] = [els[i], els[i - 1]]
    return els
  })
  const blockDown = (pi: number, i: number) => mutateElements(pi, els => {
    if (i >= els.length - 1) return els
    ;[els[i + 1], els[i]] = [els[i], els[i + 1]]
    return els
  })
  const blockDuplicate = (pi: number, i: number) => mutateElements(pi, els => {
    const copy: PageElement = JSON.parse(JSON.stringify(els[i]))
    els.splice(i + 1, 0, copy)
    return els
  })
  const blockDelete = (pi: number, i: number) => mutateElements(pi, els => {
    els.splice(i, 1)
    return els
  })
  const blockAdd = (pi: number, type: PageElement['type']) => mutateElements(pi, els => {
    const defaults: Record<string, PageElement> = {
      heading:    { type: 'heading',    level: 2,    content: '新标题',        estimatedHeight: 80 },
      paragraph:  { type: 'paragraph',              content: '在这里输入内容', estimatedHeight: 60 },
      list:       { type: 'list',       ordered: false, items: ['列表项 1', '列表项 2'], content: '', estimatedHeight: 80 },
      blockquote: { type: 'blockquote',             content: '新引用',        estimatedHeight: 60 },
      hr:         { type: 'hr',                      content: '',              estimatedHeight: 20 },
    }
    const el = defaults[type]
    if (el) els.push({ ...el })
    return els
  })
  const resetPageBlocks = (pi: number) => {
    commit(() => {
      setElementsOverride(prev => {
        const n = { ...prev }; delete n[pi]; return n
      })
    })
  }

  const selectedPageHtml = useMemo(() => {
    if (pagesWithOverrides.length === 0) return ''
    const page = pagesWithOverrides[Math.min(selectedPage, pagesWithOverrides.length - 1)]
    return renderXhsPageV2(page, style, config)
  }, [pagesWithOverrides, selectedPage, style, config])

  const handleExportZip = async () => {
    if (pagesWithOverrides.length === 0) return
    setExporting(true)
    setProgress(0)
    try {
      await exportAllPagesAsZip(pagesWithOverrides, style, config, (p) => setProgress(p))
    } catch (e) {
      console.error('导出失败:', e)
    } finally {
      setExporting(false)
    }
  }

  const handleDownloadSingle = async () => {
    if (pagesWithOverrides.length === 0) return
    const page = pagesWithOverrides[Math.min(selectedPage, pagesWithOverrides.length - 1)]
    setExporting(true)
    try {
      await downloadSinglePage(page, style, config)
    } catch (e) {
      console.error('下载失败:', e)
    } finally {
      setExporting(false)
    }
  }

  const activeColors = style.color.colors

  // 缩略图尺寸
  const thumbW = 100
  const thumbH = Math.round(thumbW * (config.height / config.width))
  const previewScale = Math.min(400 / config.width, 550 / config.height, 1)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#f5f5f5',
    }}>
      {/* 顶部工具栏 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 16px',
        background: '#fff',
        borderBottom: '1px solid #e5e5e5',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#333' }}>📸 小红书图片组</span>
          <span style={{ fontSize: '12px', color: '#999' }}>
            {pagesWithOverrides.length > 0 ? `${pagesWithOverrides.length} 张` : '暂无'}
          </span>
        </div>

        {/* 快捷工具 */}
        <div style={{ display: 'flex', gap: '6px', marginRight: '8px' }}>
          {onShuffle && (
            <button
              onClick={onShuffle}
              title="随机换一套排版 (Ctrl+Shift+R)"
              style={{
                padding: '4px 10px', fontSize: '11px', fontWeight: 600,
                color: '#4F46E5', background: '#EEF2FF',
                border: '1px solid #E0E7FF', borderRadius: '4px', cursor: 'pointer',
              }}
            >
              🎲 随机
            </button>
          )}
          {atomIdsV2 && onColorChange && (
            <button
              onClick={() => setColorDialogOpen(true)}
              title="自定义配色"
              style={{
                padding: '4px 10px', fontSize: '11px', fontWeight: 600,
                color: '#4F46E5', background: '#EEF2FF',
                border: '1px solid #E0E7FF', borderRadius: '4px', cursor: 'pointer',
              }}
            >
              🎨 配色{atomIdsV2.colorOverride ? ' ✓' : ''}
            </button>
          )}
          <button
            onClick={undo}
            disabled={history.length === 0}
            title="撤销 (Ctrl/Cmd+Z)"
            style={{
              padding: '4px 8px', fontSize: '12px', fontWeight: 600,
              color: history.length === 0 ? '#ccc' : '#555',
              background: '#fff', border: '1px solid #ddd',
              borderRadius: '4px', cursor: history.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >↶</button>
          <button
            onClick={redo}
            disabled={future.length === 0}
            title="重做 (Ctrl/Cmd+Shift+Z)"
            style={{
              padding: '4px 8px', fontSize: '12px', fontWeight: 600,
              color: future.length === 0 ? '#ccc' : '#555',
              background: '#fff', border: '1px solid #ddd',
              borderRadius: '4px', cursor: future.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >↷</button>
          <button
            onClick={() => setEditMode(m => !m)}
            title="开启后可直接点击图上文字修改"
            style={{
              padding: '4px 10px', fontSize: '11px', fontWeight: 600,
              color: editMode ? '#fff' : '#4F46E5',
              background: editMode ? '#4F46E5' : '#EEF2FF',
              border: '1px solid #E0E7FF', borderRadius: '4px', cursor: 'pointer',
            }}
          >
            ✏️ {editMode ? '编辑中' : '编辑文字'}
            {Object.keys(textOverrides).length > 0 && !editMode ? ' ✓' : ''}
          </button>
          {Object.keys(textOverrides).length > 0 && (
            <button
              onClick={() => { if (confirm('恢复所有已编辑的文字为原文？')) commit(() => setTextOverrides({})) }}
              title="恢复原文"
              style={{
                padding: '4px 10px', fontSize: '11px', fontWeight: 600,
                color: '#999', background: '#f0f0f0',
                border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer',
              }}
            >
              ↩ 恢复
            </button>
          )}
        </div>

        {/* 比例选择 */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['3:4', '16:9'] as AspectRatio[]).map((r) => (
            <button
              key={r}
              onClick={() => { setRatio(r); setSelectedPage(0) }}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: ratio === r ? 700 : 400,
                color: ratio === r ? '#fff' : '#666',
                background: ratio === r ? '#4F46E5' : '#f0f0f0',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* 主内容区 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 左侧：缩略图列表 */}
        <div style={{
          width: `${thumbW + 24}px`,
          flexShrink: 0,
          overflow: 'auto',
          padding: '12px',
          background: '#fafafa',
          borderRight: '1px solid #e5e5e5',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          {pagesWithOverrides.length === 0 ? (
            <div style={{ fontSize: '11px', color: '#999', textAlign: 'center', padding: '20px 0' }}>
              输入文章后<br />自动分页
            </div>
          ) : (
            pagesWithOverrides.map((page, i) => (
              <div
                key={`page-${i}`}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragEnter={() => handleDragEnter(i)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => setSelectedPage(i)}
                style={{
                  width: `${thumbW}px`,
                  height: `${thumbH}px`,
                  background: activeColors.pageBg,
                  border: `2px solid ${selectedPage === i ? '#4F46E5' : '#ddd'}`,
                  borderRadius: '4px',
                  cursor: 'grab',
                  position: 'relative',
                  overflow: 'hidden',
                  flexShrink: 0,
                  transition: 'transform 0.15s',
                }}
              >
                {/* 页码标签 */}
                <div style={{
                  position: 'absolute',
                  bottom: '2px',
                  right: '4px',
                  fontSize: '10px',
                  color: activeColors.textMuted,
                  fontWeight: 600,
                }}>
                  {page.type === 'cover' ? '封面' : page.type === 'ending' ? '尾页' : `${i + 1}`}
                </div>
                {/* 简易内容示意 */}
                <div style={{
                  padding: '6px',
                  fontSize: '6px',
                  lineHeight: '1.4',
                  color: activeColors.text,
                  overflow: 'hidden',
                }}>
                  {page.type === 'cover' && (
                    <div style={{ fontWeight: 700, fontSize: '8px', textAlign: 'center', marginTop: '10px' }}>
                      {page.elements[0]?.content.slice(0, 20)}
                    </div>
                  )}
                  {page.type === 'content' && page.elements.map((el, j) => (
                    <div key={j} style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginBottom: '1px',
                    }}>
                      {el.content.slice(0, 30)}
                    </div>
                  ))}
                  {page.type === 'ending' && (
                    <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '10px' }}>✨</div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* 右侧：大图预览 */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          {selectedPageHtml ? (
            <>
              {/* 模板切换工具栏（仅 content 页显示） */}
              {(() => {
                const curPage = pagesWithOverrides[Math.min(selectedPage, pagesWithOverrides.length - 1)]
                if (!curPage || curPage.type !== 'content') return null
                const curTemplate = curPage.templateType ?? 'standard'
                const curLabel = TEMPLATE_OPTIONS.find(o => o.value === curTemplate)?.label ?? '模板'
                const hasOverride = templateOverrides[selectedPage] !== undefined
                return (
                  <div style={{ position: 'relative', marginBottom: '8px', alignSelf: 'flex-end' }}>
                    <button
                      onClick={() => setShowTemplatePicker(p => !p)}
                      style={{
                        padding: '5px 12px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: hasOverride ? '#4F46E5' : '#666',
                        background: hasOverride ? '#EEF0FF' : '#f0f0f0',
                        border: `1px solid ${hasOverride ? '#4F46E5' : '#ddd'}`,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      🔄 {curLabel}
                      {hasOverride && <span style={{ fontSize: '9px', color: '#4F46E5' }}>已覆盖</span>}
                    </button>
                    {showTemplatePicker && (
                      <div style={{
                        position: 'absolute',
                        right: 0,
                        top: '100%',
                        marginTop: '4px',
                        background: '#fff',
                        border: '1px solid #e5e5e5',
                        borderRadius: '8px',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                        zIndex: 100,
                        minWidth: '160px',
                        overflow: 'hidden',
                      }}>
                        {TEMPLATE_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => {
                              commit(() => setTemplateOverrides(prev => ({ ...prev, [selectedPage]: opt.value })))
                              setShowTemplatePicker(false)
                            }}
                            style={{
                              display: 'block',
                              width: '100%',
                              textAlign: 'left',
                              padding: '8px 14px',
                              fontSize: '12px',
                              fontWeight: opt.value === curTemplate ? 700 : 400,
                              color: opt.value === curTemplate ? '#4F46E5' : '#333',
                              background: opt.value === curTemplate ? '#EEF0FF' : 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                        {hasOverride && (
                          <>
                            <div style={{ height: '1px', background: '#e5e5e5', margin: '2px 0' }} />
                            <button
                              onClick={() => {
                                commit(() => setTemplateOverrides(prev => {
                                  const next = { ...prev }
                                  delete next[selectedPage]
                                  return next
                                }))
                                setShowTemplatePicker(false)
                              }}
                              style={{
                                display: 'block',
                                width: '100%',
                                textAlign: 'left',
                                padding: '8px 14px',
                                fontSize: '11px',
                                color: '#999',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                              }}
                            >
                              ↩ 恢复自动模板
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })()}

              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div
                  onClick={() => setShowTemplatePicker(false)}
                  style={{
                    width: `${Math.round(config.width * previewScale)}px`,
                    height: `${Math.round(config.height * previewScale)}px`,
                    position: 'relative',
                    flexShrink: 0,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{
                    width: `${config.width}px`,
                    height: `${config.height}px`,
                    transform: `scale(${previewScale})`,
                    transformOrigin: 'top left',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                  }}>
                    <div
                      ref={setPreviewEl}
                      dangerouslySetInnerHTML={{ __html: selectedPageHtml }}
                      style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15)', borderRadius: '8px', overflow: 'hidden' }}
                    />
                  </div>
                </div>
                {editMode && currentPage?.type === 'content' && (
                  <BlockEditorPanel
                    page={currentPage}
                    overridden={elementsOverride[currentPage.pageIndex] !== undefined}
                    onUp={(i) => blockUp(currentPage.pageIndex, i)}
                    onDown={(i) => blockDown(currentPage.pageIndex, i)}
                    onDup={(i) => blockDuplicate(currentPage.pageIndex, i)}
                    onDel={(i) => blockDelete(currentPage.pageIndex, i)}
                    onAdd={(t) => blockAdd(currentPage.pageIndex, t)}
                    onReset={() => resetPageBlocks(currentPage.pageIndex)}
                  />
                )}
              </div>
            </>
          ) : (
            <div style={{
              textAlign: 'center',
              color: '#999',
              fontSize: '14px',
              marginTop: '80px',
            }}>
              在左侧输入文章后，小红书图片组将显示在这里
            </div>
          )}
        </div>
      </div>

      {/* 底部导出栏 */}
      <div style={{
        display: 'flex',
        gap: '8px',
        padding: '12px 16px',
        background: '#fff',
        borderTop: '1px solid #e5e5e5',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '11px', color: '#999', marginRight: 'auto' }}>
          {comboName} · {ratio} · {config.width}×{config.height}
        </span>

        {exporting && (
          <div style={{
            fontSize: '12px',
            color: '#4F46E5',
            fontWeight: 600,
          }}>
            {Math.round(progress * 100)}%
          </div>
        )}

        <button
          onClick={handleDownloadSingle}
          disabled={pagesWithOverrides.length === 0 || exporting}
          style={{
            padding: '8px 14px',
            fontSize: '12px',
            fontWeight: 600,
            background: pagesWithOverrides.length === 0 ? '#eee' : '#f0f0f0',
            color: pagesWithOverrides.length === 0 ? '#999' : '#333',
            border: '1px solid #ddd',
            borderRadius: '6px',
            cursor: pagesWithOverrides.length === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          📥 下载当前页
        </button>

        <button
          onClick={handleExportZip}
          disabled={pagesWithOverrides.length === 0 || exporting}
          style={{
            padding: '8px 14px',
            fontSize: '12px',
            fontWeight: 600,
            background: pagesWithOverrides.length === 0 ? '#ccc' : '#4F46E5',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: pagesWithOverrides.length === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {exporting ? '⏳ 导出中...' : `📦 打包下载 ZIP (${pagesWithOverrides.length}张)`}
        </button>
      </div>

      {/* 配色自定义弹窗 */}
      {atomIdsV2 && onColorChange && (
        <ColorCustomDialog
          visible={colorDialogOpen}
          onClose={() => setColorDialogOpen(false)}
          colorId={atomIdsV2.colorId}
          colorOverride={atomIdsV2.colorOverride}
          onChange={(id, override) => onColorChange(id, override)}
        />
      )}
    </div>
  )
}

// ─── 块编辑面板 ──────────────────────────
function BlockEditorPanel({
  page, overridden, onUp, onDown, onDup, onDel, onAdd, onReset,
}: {
  page: { elements: PageElement[]; pageIndex: number }
  overridden: boolean
  onUp: (i: number) => void
  onDown: (i: number) => void
  onDup: (i: number) => void
  onDel: (i: number) => void
  onAdd: (t: PageElement['type']) => void
  onReset: () => void
}) {
  const typeLabel = (t: PageElement['type']) => ({
    heading: '标题', paragraph: '段落', list: '列表', blockquote: '引用',
    code: '代码', hr: '分隔', table: '表格',
  }[t] ?? t)
  const preview = (el: PageElement) => {
    if (el.type === 'list') return (el.items ?? []).join(' · ').slice(0, 40)
    return (el.content ?? '').replace(/\s+/g, ' ').slice(0, 40)
  }
  return (
    <div style={{
      width: '220px', flexShrink: 0, background: '#fff', border: '1px solid #e5e5e5',
      borderRadius: '8px', padding: '10px', maxHeight: '80vh', overflow: 'auto',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid #eee',
      }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#333' }}>
          🧱 块编辑 {overridden && <span style={{ color: '#4F46E5', fontSize: '10px' }}>已改</span>}
        </span>
        {overridden && (
          <button
            onClick={onReset}
            title="恢复本页原始块顺序"
            style={{
              padding: '2px 8px', fontSize: '10px', color: '#999',
              background: 'transparent', border: '1px solid #ddd',
              borderRadius: '4px', cursor: 'pointer',
            }}
          >↩ 恢复</button>
        )}
      </div>
      {page.elements.length === 0 ? (
        <div style={{ fontSize: '11px', color: '#999', padding: '10px', textAlign: 'center' }}>
          本页无可编辑块
        </div>
      ) : page.elements.map((el, i) => (
        <div key={i} style={{
          padding: '6px 8px', borderRadius: '6px', background: '#fafafa',
          border: '1px solid #eee', marginBottom: '6px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#4F46E5' }}>
              {i + 1}. {typeLabel(el.type)}
            </span>
            <div style={{ display: 'flex', gap: '2px' }}>
              <IconBtn label="上移" onClick={() => onUp(i)} disabled={i === 0}>↑</IconBtn>
              <IconBtn label="下移" onClick={() => onDown(i)} disabled={i === page.elements.length - 1}>↓</IconBtn>
              <IconBtn label="复制" onClick={() => onDup(i)}>⎘</IconBtn>
              <IconBtn label="删除" onClick={() => onDel(i)} danger>×</IconBtn>
            </div>
          </div>
          <div style={{
            fontSize: '10px', color: '#666', lineHeight: 1.4,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {preview(el) || <span style={{ color: '#bbb' }}>（空）</span>}
          </div>
        </div>
      ))}
      <div style={{ borderTop: '1px dashed #e5e5e5', paddingTop: '8px', marginTop: '4px' }}>
        <div style={{ fontSize: '10px', color: '#999', marginBottom: '4px' }}>追加新块：</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {([
            ['heading', '+ 标题'],
            ['paragraph', '+ 段落'],
            ['list', '+ 列表'],
            ['blockquote', '+ 引用'],
            ['hr', '+ 分隔'],
          ] as [PageElement['type'], string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => onAdd(t)}
              style={{
                padding: '3px 8px', fontSize: '10px', fontWeight: 600,
                color: '#4F46E5', background: '#EEF2FF',
                border: '1px solid #E0E7FF', borderRadius: '4px', cursor: 'pointer',
              }}
            >{label}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

function IconBtn({
  children, onClick, disabled, danger, label,
}: { children: ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      style={{
        width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '12px', fontWeight: 700,
        color: disabled ? '#ccc' : danger ? '#EF4444' : '#4F46E5',
        background: disabled ? '#f5f5f5' : '#fff',
        border: `1px solid ${disabled ? '#eee' : danger ? '#FEE2E2' : '#E0E7FF'}`,
        borderRadius: '4px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        padding: 0,
      }}
    >{children}</button>
  )
}
