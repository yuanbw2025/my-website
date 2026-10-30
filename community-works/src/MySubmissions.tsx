import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AuthGate } from './auth'

type Submission = { id: string; kind: 'novel' | 'book-analysis'; status: string;
  sha256: string; created_at: string; updated_at: string }
type Appeal = { id: string; submission_id: string; from_status: string; reason: string;
  status: string; reviewer_note: string; created_at: string }
const appealable = new Set(['needs_changes', 'rejected', 'taken_down'])
const active = new Set(['submitted', 'human_review', 'needs_changes', 'rejected', 'approved', 'published', 'taken_down'])

async function privateJson(path: string, token: string, body?: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST', cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`社区服务暂时不可用（${response.status}）`)
  const data: unknown = await response.json()
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('服务返回无效')
  return data as Record<string, unknown>
}

function Workspace({ session }: { session: Session }) {
  const [items, setItems] = useState<Submission[]>([])
  const [appeals, setAppeals] = useState<Appeal[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [appealId, setAppealId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const refresh = async () => {
    setState('loading')
    try {
      const [submissions, decisions] = await Promise.all([
        privateJson('/api/community/v1/my-submissions', session.access_token),
        privateJson('/api/community/v1/appeals', session.access_token),
      ])
      if (!Array.isArray(submissions.items) || !Array.isArray(decisions.items)) throw new Error('记录无效')
      setItems(submissions.items as Submission[]); setAppeals(decisions.items as Appeal[]); setState('ready')
    } catch { setState('error') }
  }
  useEffect(() => { void refresh() }, [session.access_token])

  const action = async (item: Submission, kind: 'withdraw' | 'appeal') => {
    if (busy) return
    if (kind === 'withdraw' && !window.confirm('撤回后作品会立即从公开页面隐藏，确定继续吗？')) return
    if (kind === 'appeal' && !reason.trim()) return
    setBusy(true); setMessage('')
    try {
      const result = await privateJson('/api/community/v1/submission-action', session.access_token, {
        submissionId: item.id, revisionSha256: item.sha256, action: kind,
        ...(kind === 'appeal' ? { reason: reason.trim() } : {}),
      })
      if (kind === 'withdraw' && result.status !== 'withdrawn') throw new Error('撤回回执无效')
      if (kind === 'appeal' && result.status !== 'open') throw new Error('申诉回执无效')
      setMessage(kind === 'withdraw' ? '投稿已撤回。' : '申诉已提交；审核结果不会自动重新发布作品。')
      setAppealId(null); setReason(''); await refresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : '操作暂时失败') }
    finally { setBusy(false) }
  }
  return <main id="main-content" className="review-shell">
    <a className="back-link" href="/community-works/">← 返回作品集</a>
    <p className="eyebrow">MY SUBMISSIONS</p><h1>我的投稿</h1>
    <p>这里显示当前社区账号的最近 50 份投稿。撤回会隐藏已公开作品；申诉由审核员复核。</p>
    <button type="button" onClick={() => void refresh()}>刷新记录</button>
    {state === 'loading' && <p role="status">正在读取投稿…</p>}
    {state === 'error' && <p role="alert">投稿记录暂时无法读取。</p>}
    {message && <p role="status">{message}</p>}
    {state === 'ready' && items.length === 0 && <p>此账号还没有投稿。</p>}
    {items.map(item => {
      const currentAppeal = appeals.find(value => value.submission_id === item.id)
      return <article className="review-detail" key={item.id}>
        <h2>{item.kind === 'novel' ? '原创小说' : '拆书分析'} · {item.status}</h2>
        <p>编号：<code>{item.id}</code></p>
        <p>提交时间：{new Date(item.created_at).toLocaleString('zh-CN')}</p>
        <div className="review-actions">
          {active.has(item.status) && <button type="button" disabled={busy}
            onClick={() => void action(item, 'withdraw')}>撤回投稿</button>}
          {appealable.has(item.status) && !currentAppeal && <button type="button" disabled={busy}
            onClick={() => setAppealId(item.id)}>提出申诉</button>}
        </div>
        {currentAppeal && <p>申诉状态：{currentAppeal.status}
          {currentAppeal.reviewer_note ? ` · 审核意见：${currentAppeal.reviewer_note}` : ''}</p>}
        {appealId === item.id && <div className="community-form">
          <p>请具体说明需要复核的地方。申诉通过后仍需重新提交待审版本。</p>
          <label>申诉理由<textarea maxLength={2000} value={reason}
            onChange={event => setReason(event.target.value)} /></label>
          <button type="button" disabled={busy || !reason.trim()} onClick={() => void action(item, 'appeal')}>提交申诉</button>
        </div>}
      </article>
    })}
  </main>
}

export function MySubmissions() {
  return <AuthGate>{session => <Workspace session={session} />}</AuthGate>
}
