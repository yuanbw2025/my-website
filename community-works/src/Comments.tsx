import { useEffect, useId, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AuthGate, useCommunitySession } from './auth'
import { socialJson, action, SocialError } from './social'
import type { ReadingAnchor } from '../shared/anchors.js'

type PublicComment = { id: string; displayName: string; body: string; createdAt: string; anchor: ReadingAnchor | null; parentId: string | null; isAuthor: boolean; mine: boolean; replies: number }
const reasons = [
  ['child_safety', '涉及未成年人安全'], ['sexual_violence', '性暴力'],
  ['violence_threat', '暴力威胁'], ['hate', '仇恨与歧视'],
  ['privacy', '隐私泄露'], ['copyright', '版权问题'],
  ['illegal_trade', '违法交易'], ['other', '其他'],
] as const

function WriteComment({ slug, onSubmitted, session, anchor = null, parentId = null }: {
  slug: string; onSubmitted: (receipt: string) => void; session: Session; anchor?: ReadingAnchor | null; parentId?: string | null
}) {
  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [message, setMessage] = useState('')
  const key = useRef(crypto.randomUUID())
  const submit = async () => {
    if (busy || !name.trim() || !body.trim()) return
    setBusy(true); setMessage('')
    try {
      const result = await socialJson<{ status: string }>('conversation', session, {
        slug, displayName: name.trim(), body: body.trim(), idempotencyKey: key.current, anchor, parentId,
      })
      if (!['pending','approved','rejected','taken_down'].includes(result.status)) throw new SocialError('invalid_receipt',true)
      key.current = crypto.randomUUID(); setBody(''); setUncertain(false)
      const receipt = result.status === 'pending' ? '已提交，审核通过后会公开并通知对方。' : '已找到本次评论的处理记录，请刷新查看。'
      setMessage(receipt)
      onSubmitted(receipt)
    } catch (error) { setUncertain(error instanceof SocialError && error.uncertain); setMessage(error instanceof Error ? error.message : '提交未完成。') }
    finally { setBusy(false) }
  }
  return <div className="community-form">
    {anchor && <p className="anchor-context">{anchor.kind === 'section' ? '讨论本章 / 本条分析' : `针对原文：${anchor.quote}`}</p>}
    <label>公开昵称<input value={name} maxLength={80} disabled={busy || uncertain} onChange={event => { setName(event.target.value); key.current=crypto.randomUUID() }} /></label>
    <label>{parentId ? '回复内容' : '评论内容'}<textarea value={body} maxLength={1200} disabled={busy || uncertain} onChange={event => { setBody(event.target.value); key.current=crypto.randomUUID() }} /></label>
    <p className="muted">评论和回复审核后公开，每个账号每天最多 10 条。不要发布隐私、侵权或伤害他人的内容。</p>
    <button type="button" disabled={busy || !name.trim() || !body.trim()} onClick={() => void submit()}>
      {busy ? '正在提交…' : uncertain ? '确认上次提交结果' : '提交审核'}
    </button>
    {message && <p role="status">{message}</p>}
  </div>
}

function ReportWork({ slug, session }: { slug: string; session: Session }) {
  const [reason, setReason] = useState<(typeof reasons)[number][0]>('other')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const submit = async () => {
    if (busy) return
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/community/v1/reports', {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, reasonCode: reason, details }),
      })
      if (!response.ok) throw new Error('report_unavailable')
      const result = await response.json() as { status?: string }
      if (result.status !== 'open') throw new Error('invalid_receipt')
      setDetails(''); setMessage('举报已收到，审核员会复核。')
    } catch { setMessage('举报暂时无法提交，请稍后重试。') }
    finally { setBusy(false) }
  }
  return <div className="community-form">
    <label>举报原因<select value={reason} onChange={event => setReason(event.target.value as typeof reason)}>
      {reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>
    <label>补充说明（可选）<textarea value={details} maxLength={2000}
      onChange={event => setDetails(event.target.value)} /></label>
    <button type="button" disabled={busy} onClick={() => void submit()}>{busy ? '正在提交…' : '提交举报'}</button>
    {message && <p role="status">{message}</p>}
  </div>
}

function ReportComment({ id, session }: { id: string; session: Session }) {
  const [reason, setReason] = useState('other')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const submit = async () => {
    if (busy) return
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/community/v1/comment-reports', {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId: id, reasonCode: reason, details }),
      })
      if (!response.ok) throw new Error('report_unavailable')
      const result = await response.json() as { status?: string }
      if (result.status !== 'open') throw new Error('invalid_receipt')
      setDetails(''); setMessage('评论举报已收到，审核员会复核。')
    } catch { setMessage('举报暂时无法提交，请稍后重试。') }
    finally { setBusy(false) }
  }
  return <div className="community-form">
    <label>举报原因<select value={reason} onChange={event => setReason(event.target.value)}>
      {reasons.filter(([value]) => value !== 'copyright' && value !== 'illegal_trade').map(([value, label]) =>
        <option key={value} value={value}>{label}</option>)}</select></label>
    <label>补充说明（可选）<textarea value={details} maxLength={2000}
      onChange={event => setDetails(event.target.value)} /></label>
    <button type="button" disabled={busy} onClick={() => void submit()}>{busy ? '正在提交…' : '提交评论举报'}</button>
    {message && <p role="status">{message}</p>}
  </div>
}

export function Comments({ slug, anchor = null, parentId = null, initialCompose = false, focusId }: {
  slug: string; anchor?: ReadingAnchor | null; parentId?: string | null; initialCompose?: boolean; focusId?: string
}) {
  const session = useCommunitySession()
  const headingId = useId()
  const [items, setItems] = useState<PublicComment[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [more, setMore] = useState(false)
  const [compose, setCompose] = useState(initialCompose)
  const [report, setReport] = useState(false)
  const [reportedComment, setReportedComment] = useState<string | null>(null)
  const [replyTo, setReplyTo] = useState<PublicComment | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const nextOffset = useRef(0)
  const generation = useRef(0)
  const filterKey = `${anchor?.section ?? ''}:${anchor?.entry ?? ''}:${anchor?.block ?? ''}`
  const load = async (reset: boolean, signal?: AbortSignal) => {
    const version = generation.current
    if (reset) { nextOffset.current = 0; setItems([]) }
    setState('loading')
    try {
      const params = new URLSearchParams({ slug, offset: String(nextOffset.current) })
      if (parentId) params.set('parent',parentId)
      if (focusId) params.set('commentId',focusId)
      if (anchor) { params.set('section',String(anchor.section)); params.set('entry',String(anchor.entry)); if (anchor.block !== undefined) params.set('block',String(anchor.block)) }
      const result = await socialJson<{ items: PublicComment[] }>(`conversation?${params}`, session, undefined, signal)
      if (signal?.aborted || version !== generation.current) return
      if (!Array.isArray(result.items) || result.items.length > 50) throw new Error('invalid_comments')
      setItems(current => reset ? result.items : [...current,...result.items.filter(item=>!current.some(old=>old.id===item.id))])
      nextOffset.current += result.items.length; setMore(result.items.length === 50); setState('ready')
    } catch { if (!signal?.aborted && version === generation.current) setState('error') }
  }
  useEffect(() => { const controller = new AbortController(); generation.current++; void load(true,controller.signal)
    return () => { generation.current++; controller.abort() }
  }, [slug, filterKey, parentId, focusId, session?.access_token])
  const mutate = async (name: 'block'|'withdraw-comment', id: string) => {
    if (!session || busy) return
    setBusy(true); setMessage('')
    try { await action(session,{action:name,data:{commentId:id}}); setMessage(name==='block' ? '已屏蔽这位读者，可在阅读空间中解除。' : '评论已撤回。'); await load(true) }
    catch(error) { setMessage(error instanceof Error ? error.message : '操作未完成。') } finally { setBusy(false) }
  }
  return <section className={parentId ? 'comment-replies' : 'community-comments'} aria-labelledby={headingId}>
    <div className="section-head"><h2 id={headingId}>{parentId ? '回复' : anchor ? (anchor.kind === 'section' ? '章节 / 分析交流' : '这段文字的讨论') : focusId ? '消息中的讨论' : '作品讨论'}</h2><span>审核后公开</span></div>
    {state === 'loading' && <p role="status">正在读取评论…</p>}
    {state === 'error' && <p role="alert">评论暂时无法读取。<button onClick={()=>void load(true)}>重试</button></p>}
    {state === 'ready' && !items.length && <p className="muted">还没有公开评论。</p>}
    {message && <p role="status">{message}</p>}
    {items.map(item => <article className="comment-card" key={item.id} id={`comment-${item.id}`}>
      <div><strong>{item.displayName}</strong>{item.isAuthor && <span className="author-badge">作者</span>}
        <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('zh-CN')}</time></div>
      {item.anchor?.quote && <blockquote>{item.anchor.quote}</blockquote>}<p>{item.body}</p>
      <div className="community-actions">
        {!parentId && <button onClick={()=>setReplyTo(replyTo?.id===item.id ? null : item)}>回复</button>}
        {!parentId && item.replies > 0 && <button onClick={()=>setExpanded(expanded===item.id ? null : item.id)}>{expanded===item.id ? '收起回复' : `查看 ${item.replies} 条回复`}</button>}
        <button aria-expanded={reportedComment===item.id} onClick={()=>setReportedComment(reportedComment===item.id ? null : item.id)}>举报</button>
        {session && !item.mine && <button disabled={busy} onClick={()=> { if(window.confirm('屏蔽后，你们的评论与回复将互相隐藏。是否继续？')) void mutate('block',item.id) }}>屏蔽读者</button>}
        {session && item.mine && <button disabled={busy} onClick={()=> { if(window.confirm('撤回这条评论及其讨论入口？')) void mutate('withdraw-comment',item.id) }}>撤回</button>}
      </div>
      {reportedComment===item.id && <AuthGate>{account=><ReportComment id={item.id} session={account} />}</AuthGate>}
      {replyTo?.id===item.id && <AuthGate>{account=><WriteComment key={item.id} slug={slug} parentId={item.parentId ?? item.id} anchor={item.anchor} session={account} onSubmitted={receipt=>{ setMessage(receipt); setReplyTo(null); void load(true) }} />}</AuthGate>}
      {expanded===item.id && <Comments slug={slug} parentId={item.id} />}
    </article>)}
    {state==='ready' && more && <button onClick={()=>void load(false)}>加载更多评论</button>}
    {!parentId && <><div className="community-actions">
      <button aria-expanded={compose} onClick={()=> { setCompose(value=>!value); setReport(false) }}>发表评论</button>
      {!anchor && <button aria-expanded={report} onClick={()=> { setReport(value=>!value); setCompose(false) }}>举报作品</button>}
    </div>
    {compose && <AuthGate>{account=><WriteComment key={JSON.stringify(anchor)} slug={slug} anchor={anchor} session={account} onSubmitted={()=>void load(true)} />}</AuthGate>}
    {report && <AuthGate>{account=><ReportWork slug={slug} session={account} />}</AuthGate>}</>}
  </section>
}
