import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AuthGate } from './auth'
import { ReviewerGate } from './ReviewerGate'
import { validPublicSnapshotV1 } from '../supabase/functions/_shared/snapshot'

type ReviewItem = { id: string; kind: 'novel' | 'book-analysis'; status: string;
  sha256: string; created_at: string; public_pen_name: string }
type ReportItem = { id: string; publication_id: string; reason_code: string;
  details: string; status: string; created_at: string }
type CommentItem = { id: string; publication_id: string; author_uid: string;
  display_name: string; body: string; status: string; created_at: string }
type CommentReportItem = { id: string; comment_id: string; reason_code: string;
  details: string; status: string; created_at: string }
type AppealItem = { id: string; submission_id: string; owner_uid: string;
  revision_sha256: string; community_submissions: { kind: 'novel' | 'book-analysis' };
  from_status: string; reason: string; status: string; created_at: string }
type Snapshot = Record<string, unknown>
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

async function privateJson(path: string, token: string, options: RequestInit = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`服务暂时不可用（${response.status}）`)
  return response.json() as Promise<unknown>
}

function ReviewWorkspace({ session }: { session: Session }) {
  const [queue, setQueue] = useState<ReviewItem[]>([])
  const [reports, setReports] = useState<ReportItem[]>([])
  const [comments, setComments] = useState<CommentItem[]>([])
  const [commentReports, setCommentReports] = useState<CommentReportItem[]>([])
  const [appeals, setAppeals] = useState<AppealItem[]>([])
  const [selected, setSelected] = useState<ReviewItem | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [chapterIndex, setChapterIndex] = useState(0)
  const [reasonCode, setReasonCode] = useState('content_reviewed')
  const [privateNote, setPrivateNote] = useState('')
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [reportDecision, setReportDecision] = useState('')
  const [commentDecision, setCommentDecision] = useState('')
  const [commentReportDecision, setCommentReportDecision] = useState('')
  const [appealDecision, setAppealDecision] = useState('')

  const refresh = async () => {
    setState('loading')
    try {
      const [workResponse, reportResponse, commentResponse, commentReportResponse, appealResponse] = await Promise.all([
        privateJson('/api/community/v1/review', session.access_token),
        privateJson('/api/community/v1/reports?scope=queue', session.access_token),
        privateJson('/api/community/v1/comments?scope=queue', session.access_token),
        privateJson('/api/community/v1/comment-reports?scope=queue', session.access_token),
        privateJson('/api/community/v1/appeals?scope=queue', session.access_token),
      ]) as [{ items?: ReviewItem[] }, { items?: ReportItem[] }, { items?: CommentItem[] },
        { items?: CommentReportItem[] }, { items?: AppealItem[] }]
      if (!Array.isArray(workResponse?.items) || !Array.isArray(reportResponse?.items) ||
          !Array.isArray(commentResponse?.items) || !Array.isArray(commentReportResponse?.items) ||
          !Array.isArray(appealResponse?.items)) throw new Error('队列格式无效')
      setQueue(workResponse.items.filter(item => uuid.test(item.id)))
      setReports(reportResponse.items.filter(item => uuid.test(item.id)))
      setComments(commentResponse.items.filter(item => uuid.test(item.id)))
      setCommentReports(commentReportResponse.items.filter(item => uuid.test(item.id)))
      setAppeals(appealResponse.items.filter(item => uuid.test(item.id)))
      setState('ready')
    } catch { setState('error') }
  }
  useEffect(() => { void refresh() }, [session.access_token])

  const open = async (item: ReviewItem) => {
    setSelected(item); setSnapshot(null); setMessage(''); setChapterIndex(0); setBusy(true)
    try {
      const detail = await privateJson(`/api/community/v1/review?id=${item.id}`, session.access_token) as {
        submission?: { sha256?: string }; snapshotUrl?: string
      }
      if (detail.submission?.sha256 !== item.sha256 || typeof detail.snapshotUrl !== 'string') throw new Error('修订已变化')
      const signed = new URL(detail.snapshotUrl)
      const storageOrigin = new URL(import.meta.env.VITE_COMMUNITY_R2_ORIGIN).origin
      const storageBucket = import.meta.env.VITE_COMMUNITY_R2_BUCKET
      if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(storageBucket ?? '') ||
          signed.origin !== storageOrigin ||
          !signed.pathname.startsWith(`/${storageBucket}/`) ||
          !/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/){2}snapshot\.json$/.test(
            signed.pathname.slice(storageBucket.length + 2)) ||
          !signed.searchParams.has('X-Amz-Signature')) {
        throw new Error('审核文件地址无效')
      }
      const file = await fetch(signed, { cache: 'no-store' })
      if (!file.ok) throw new Error('审核文件暂时无法下载')
      const bytes = await file.arrayBuffer()
      if (bytes.byteLength > 32 * 1024 * 1024) throw new Error('审核文件超出预算')
      const actual = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
        byte => byte.toString(16).padStart(2, '0')).join('')
      if (actual !== item.sha256) throw new Error('审核文件校验失败')
      const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
      if (!validPublicSnapshotV1(parsed) || (parsed as Snapshot).kind !== item.kind) throw new Error('审核文件格式无效')
      setSnapshot(parsed as Snapshot)
    } catch (error) { setMessage(error instanceof Error ? error.message : '无法打开审核文件') }
    finally { setBusy(false) }
  }

  const decide = async (decision: string) => {
    if (!selected || !snapshot || busy) return
    setBusy(true); setMessage('')
    try {
      const result = await privateJson(`/api/community/v1/review?id=${selected.id}`, session.access_token, {
        method: 'POST', body: JSON.stringify({ decision, revisionSha256: selected.sha256,
          reasonCode, privateNote }),
      }) as { status?: string }
      setMessage(`审核状态已更新：${result.status ?? '已处理'}`)
      setSnapshot(null); setSelected(null); setPrivateNote('')
      await refresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : '审核失败') }
    finally { setBusy(false) }
  }

  const decideReport = async (reportId: string, decision: string) => {
    if (busy) return
    setBusy(true); setReportDecision('')
    try {
      const result = await privateJson('/api/community/v1/report-decision', session.access_token, {
        method: 'POST', body: JSON.stringify({ reportId, decision,
          reasonCode: decision === 'take_down' ? 'confirmed_harm' : 'report_reviewed', privateNote }),
      }) as { status?: string }
      setReportDecision(`举报已处理：${result.status ?? '已处理'}`)
      await refresh()
    } catch (error) { setReportDecision(error instanceof Error ? error.message : '举报处理失败') }
    finally { setBusy(false) }
  }

  const decideComment = async (commentId: string, decision: string) => {
    if (busy) return
    setBusy(true); setCommentDecision('')
    try {
      const result = await privateJson('/api/community/v1/comment-decision', session.access_token, {
        method: 'POST', body: JSON.stringify({ commentId, decision,
          reasonCode: decision === 'approve' ? 'reviewed_content' : 'policy_violation', privateNote }),
      }) as { status?: string }
      setCommentDecision(`评论已处理：${result.status ?? '已处理'}`)
      await refresh()
    } catch (error) { setCommentDecision(error instanceof Error ? error.message : '评论处理失败') }
    finally { setBusy(false) }
  }

  const decideCommentReport = async (reportId: string, decision: string) => {
    if (busy) return
    setBusy(true); setCommentReportDecision('')
    try {
      const result = await privateJson('/api/community/v1/comment-report-decision', session.access_token, {
        method: 'POST', body: JSON.stringify({ reportId, decision,
          reasonCode: decision === 'take_down' ? 'confirmed_harm' : 'report_reviewed', privateNote }),
      }) as { status?: string }
      setCommentReportDecision(`评论举报已处理：${result.status ?? '已处理'}`)
      await refresh()
    } catch (error) { setCommentReportDecision(error instanceof Error ? error.message : '评论举报处理失败') }
    finally { setBusy(false) }
  }

  const decideAppeal = async (appealId: string, decision: string) => {
    if (busy || !privateNote.trim()) { setAppealDecision('处理申诉需要填写具体审核意见。'); return }
    setBusy(true); setAppealDecision('')
    try {
      const result = await privateJson('/api/community/v1/appeal-decision', session.access_token, {
        method: 'POST', body: JSON.stringify({ appealId, decision, reviewerNote: privateNote.trim() }),
      }) as { status?: string }
      setAppealDecision(`申诉已处理：${result.status ?? '已处理'}`)
      await refresh()
    } catch (error) { setAppealDecision(error instanceof Error ? error.message : '申诉处理失败') }
    finally { setBusy(false) }
  }

  const chapters = snapshot?.kind === 'novel' ? snapshot.chapters as Array<{ title: string; content: string }> : []
  const dimensions = snapshot?.kind === 'book-analysis' ? snapshot.dimensions as Array<{
    key: string; selected: boolean; entries: Array<{ label: string; text: string }>
  }> : []
  return <main id="main-content" className="review-shell">
    <a className="back-link" href="/community-works/">← 返回作品集</a>
    <p className="eyebrow">PRIVATE REVIEW / STORYFORGE</p><h1>作品审核</h1>
    <p>此处仅供获授权的审核员使用。每个决定绑定当前修订的 SHA-256，发布需要单独启用服务端开关。</p>
    <button type="button" onClick={() => void refresh()}>刷新待办</button>
    <label className="review-note">内部审核备注（适用于下面的处理动作）
      <textarea value={privateNote} onChange={event => setPrivateNote(event.target.value)} maxLength={2000} />
    </label>
    {state === 'loading' && <p role="status">正在读取待办…</p>}
    {state === 'error' && <p role="alert">审核服务不可用或账号没有审核权限。</p>}
    {message && <p role="status">{message}</p>}
    {state === 'ready' && <div className="review-columns">
      <section><h2>待审投稿（{queue.length}）</h2>
        {queue.length === 0 && <p>当前没有待审投稿。</p>}
        {queue.map(item => <button className="review-list-item" key={item.id} type="button"
          onClick={() => void open(item)}><strong>{item.kind === 'novel' ? '原创小说' : '拆书分析'}</strong>
          <span>{item.public_pen_name} · {item.status}</span><small>{item.id}</small></button>)}
      </section>
      <section><h2>举报待办（{reports.length}）</h2>
        {reports.length === 0 && <p>当前没有未处理举报。</p>}
        {reports.map(report => <article className="review-list-item" key={report.id}>
          <strong>{report.reason_code}</strong><p>{report.details}</p><small>{report.publication_id}</small>
          <div className="review-actions">
            <button type="button" disabled={busy} onClick={() => void decideReport(report.id, 'escalate')}>升级处理</button>
            <button type="button" disabled={busy} onClick={() => void decideReport(report.id, 'dismiss')}>驳回举报</button>
            <button type="button" disabled={busy} onClick={() => void decideReport(report.id, 'take_down')}>下架作品</button>
          </div></article>)}
        {reportDecision && <p role="status">{reportDecision}</p>}
      </section>
      <section><h2>评论待审（{comments.length}）</h2>
        {comments.length === 0 && <p>当前没有待审评论。</p>}
        {comments.map(comment => <article className="review-list-item" key={comment.id}>
          <strong>{comment.display_name}</strong><p className="review-manuscript">{comment.body}</p>
          <small>作品 {comment.publication_id} · 评论 {comment.id}</small>
          <div className="review-actions">
            <button type="button" disabled={busy} onClick={() => void decideComment(comment.id, 'approve')}>批准评论</button>
            <button type="button" disabled={busy} onClick={() => void decideComment(comment.id, 'reject')}>拒绝评论</button>
          </div>
        </article>)}
        {commentDecision && <p role="status">{commentDecision}</p>}
      </section>
      <section><h2>评论举报（{commentReports.length}）</h2>
        {commentReports.length === 0 && <p>当前没有评论举报。</p>}
        {commentReports.map(report => <article className="review-list-item" key={report.id}>
          <strong>{report.reason_code}</strong><p>{report.details}</p><small>评论 {report.comment_id}</small>
          <div className="review-actions">
            <button type="button" disabled={busy} onClick={() => void decideCommentReport(report.id, 'dismiss')}>驳回举报</button>
            <button type="button" disabled={busy} onClick={() => void decideCommentReport(report.id, 'take_down')}>下架评论</button>
          </div>
        </article>)}
        {commentReportDecision && <p role="status">{commentReportDecision}</p>}
      </section>
      <section><h2>作者申诉（{appeals.length}）</h2>
        {appeals.length === 0 && <p>当前没有待处理申诉。</p>}
        {appeals.map(appeal => <article className="review-list-item" key={appeal.id}>
          <strong>{appeal.from_status} · 作品 {appeal.submission_id}</strong>
          <p className="review-manuscript">{appeal.reason}</p>
          <div className="review-actions">
            <button type="button" disabled={busy} onClick={() => void open({
              id: appeal.submission_id, kind: appeal.community_submissions.kind,
              sha256: appeal.revision_sha256, status: appeal.from_status,
              created_at: appeal.created_at, public_pen_name: '',
            })}>查看原稿</button>
            <button type="button" disabled={busy || !privateNote.trim()} onClick={() => void decideAppeal(appeal.id, 'upheld')}>支持申诉</button>
            <button type="button" disabled={busy || !privateNote.trim()} onClick={() => void decideAppeal(appeal.id, 'denied')}>驳回申诉</button>
          </div>
        </article>)}
        {appealDecision && <p role="status">{appealDecision}</p>}
      </section>
    </div>}
    {selected && <section className="review-detail"><h2>审核投稿 {selected.id}</h2>
      <p>状态：{selected.status} · 修订 SHA-256：<code>{selected.sha256}</code></p>
      {busy && <p role="status">正在校验私有快照…</p>}
      {snapshot?.kind === 'novel' && <>
        <h3>{String(snapshot.title)}</h3><p>{String(snapshot.description)}</p>
        <label>查看章节<select value={chapterIndex} onChange={event => setChapterIndex(Number(event.target.value))}>
          {chapters.map((chapter, index) => <option key={index} value={index}>{index + 1}. {chapter.title}</option>)}
        </select></label>
        <article className="review-manuscript"><h4>{chapters[chapterIndex]?.title}</h4>
          <p>{chapters[chapterIndex]?.content}</p></article>
      </>}
      {snapshot?.kind === 'book-analysis' && <>
        <h3>{String((snapshot.book as { title: string }).title)} · 拆书分析</h3>
        {dimensions.map((dimension, index) => <details key={dimension.key}>
          <summary>{index + 1}. {dimension.key} · {dimension.selected ? `${dimension.entries.length} 条` : '未选择'}</summary>
          {dimension.entries.map((entry, position) => <article className="review-manuscript" key={position}>
            <h4>{entry.label}</h4><p>{entry.text}</p></article>)}
        </details>)}
        <h4>作者点评</h4><p>{String(snapshot.authorCommentary)}</p>
      </>}
      {snapshot && <div className="review-decision">
        <label>决定理由代码<input value={reasonCode} onChange={event => setReasonCode(event.target.value)} /></label>
        <label>内部备注<textarea value={privateNote} onChange={event => setPrivateNote(event.target.value)} maxLength={4000} /></label>
        <div className="review-actions">
          {selected.status === 'submitted' && <button disabled={busy} onClick={() => void decide('begin_review')}>开始人工审核</button>}
          {selected.status === 'human_review' && <>
            <button disabled={busy} onClick={() => void decide('approve')}>批准此修订</button>
            <button disabled={busy} onClick={() => void decide('needs_changes')}>要求修改</button>
            <button disabled={busy} onClick={() => void decide('reject')}>拒绝投稿</button>
          </>}
          {selected.status === 'approved' && <button disabled={busy} onClick={() => void decide('publish')}>发布已批准修订</button>}
        </div>
      </div>}
    </section>}
  </main>
}

export function ReviewPage() {
  return <AuthGate>{session => <ReviewerGate key={session.user.id} session={session}>
    {verified => <ReviewWorkspace session={verified} />}
  </ReviewerGate>}</AuthGate>
}
