import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AuthGate } from './auth'

type PublicComment = { id: string; displayName: string; body: string; createdAt: string }
const reasons = [
  ['child_safety', '涉及未成年人安全'], ['sexual_violence', '性暴力'],
  ['violence_threat', '暴力威胁'], ['hate', '仇恨与歧视'],
  ['privacy', '隐私泄露'], ['copyright', '版权问题'],
  ['illegal_trade', '违法交易'], ['other', '其他'],
] as const

function WriteComment({ slug, onSubmitted, session }: {
  slug: string; onSubmitted: () => void; session: Session
}) {
  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const key = useRef(crypto.randomUUID())
  const submit = async () => {
    if (busy || !name.trim() || !body.trim()) return
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/community/v1/comments', {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, displayName: name.trim(), body: body.trim(), idempotencyKey: key.current }),
      })
      if (!response.ok) throw new Error('comment_unavailable')
      const result = await response.json() as { status?: string }
      if (result.status !== 'pending') throw new Error('invalid_receipt')
      key.current = crypto.randomUUID(); setBody('')
      setMessage('评论已提交，人工审核通过后会显示。')
      onSubmitted()
    } catch { setMessage('提交结果暂时无法确认。请保留内容，稍后重试。') }
    finally { setBusy(false) }
  }
  return <div className="community-form">
    <label>公开昵称<input value={name} maxLength={80} onChange={event => setName(event.target.value)} /></label>
    <label>评论内容<textarea value={body} maxLength={1200} onChange={event => setBody(event.target.value)} /></label>
    <p className="muted">评论先由人工审核。不要发布私人信息、侵权内容或伤害他人的内容。</p>
    <button type="button" disabled={busy || !name.trim() || !body.trim()} onClick={() => void submit()}>
      {busy ? '正在提交…' : '提交评论审核'}
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

export function Comments({ slug }: { slug: string }) {
  const [items, setItems] = useState<PublicComment[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [more, setMore] = useState(false)
  const [compose, setCompose] = useState(false)
  const [report, setReport] = useState(false)
  const [reportedComment, setReportedComment] = useState<string | null>(null)
  const nextOffset = useRef(0)
  const load = async (reset: boolean) => {
    if (reset) { nextOffset.current = 0; setItems([]) }
    setState('loading')
    try {
      const response = await fetch(`/api/community/v1/comments?slug=${slug}&offset=${nextOffset.current}`, {
        headers: { Accept: 'application/json' }, cache: 'no-store',
      })
      if (!response.ok) throw new Error('comments_unavailable')
      const result = await response.json() as { items?: PublicComment[] }
      if (!Array.isArray(result.items) || result.items.length > 50 || result.items.some(item =>
        typeof item?.id !== 'string' || typeof item.displayName !== 'string' ||
        typeof item.body !== 'string' || typeof item.createdAt !== 'string')) throw new Error('invalid_comments')
      setItems(current => reset ? result.items! : [...current, ...result.items!])
      nextOffset.current += result.items.length
      setMore(result.items.length === 50)
      setState('ready')
    } catch { setState('error') }
  }
  useEffect(() => { void load(true) }, [slug])
  return <section className="community-comments" aria-labelledby="comments-heading">
    <div className="section-head"><h2 id="comments-heading">读者交流</h2><span>审核后公开</span></div>
    {state === 'loading' && <p role="status">正在读取评论…</p>}
    {state === 'error' && <p role="alert">评论暂时无法读取。</p>}
    {state === 'ready' && items.length === 0 && <p className="muted">还没有公开评论。</p>}
    {items.map(item => <article className="comment-card" key={item.id}>
      <div><strong>{item.displayName}</strong><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString('zh-CN')}</time></div>
      <p>{item.body}</p>
      <button type="button" aria-expanded={reportedComment === item.id}
        onClick={() => setReportedComment(current => current === item.id ? null : item.id)}>举报这条评论</button>
      {reportedComment === item.id && <AuthGate>{session => <ReportComment id={item.id} session={session} />}</AuthGate>}
    </article>)}
    {state === 'ready' && more && <button type="button" onClick={() => void load(false)}>加载更多评论</button>}
    <div className="community-actions">
      <button type="button" aria-expanded={compose} onClick={() => { setCompose(value => !value); setReport(false) }}>发表评论</button>
      <button type="button" aria-expanded={report} onClick={() => { setReport(value => !value); setCompose(false) }}>举报作品</button>
    </div>
    {compose && <AuthGate>{session => <WriteComment slug={slug} session={session} onSubmitted={() => void load(true)} />}</AuthGate>}
    {report && <AuthGate>{session => <ReportWork slug={slug} session={session} />}</AuthGate>}
  </section>
}
