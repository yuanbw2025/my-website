import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AuthGate, useCommunitySession } from './auth'
import { action, socialJson, SocialError, type SocialState, type Wallet } from './social'

type FlowerRequest = { action: 'claim' | 'gift'; idempotencyKey: string; slug?: string; amount?: number }
function FlowerBasket({ session, slug, isAuthor = false, onChange }: { session: Session; slug?: string; isAuthor?: boolean; onChange?: () => void }) {
  const storageKey = `community-flower-pending:${session.user.id}`
  const [pending, setPending] = useState<FlowerRequest | null>(() => {
    try { const value = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as FlowerRequest | null
      return value && ['claim','gift'].includes(value.action) && typeof value.idempotencyKey === 'string' ? value : null
    } catch { return null }
  })
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [amount, setAmount] = useState(1)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const refresh = () => socialJson<Wallet>('social?scope=wallet', session).then(setWallet)
  useEffect(() => { void refresh().catch(() => setMessage('花篮暂时无法读取。')) }, [session.access_token])
  const send = async (request: FlowerRequest) => {
    if (busy) return
    setBusy(true); setMessage('')
    try {
      // Persist the exact operation before sending. Unknown outcomes never create a new gift key.
      localStorage.setItem(storageKey, JSON.stringify(request)); setPending(request)
      await action(session, request)
      localStorage.removeItem(storageKey); setPending(null)
      setMessage(request.action === 'claim' ? '领取成功，3 朵鲜花已入花篮。' : '鲜花已送出，谢谢你的鼓励！')
      onChange?.()
      await refresh().catch(()=>setMessage('操作已完成，花篮暂时无法刷新；请刷新页面查看余额。'))
    } catch (error) {
      if (error instanceof SocialError && !error.uncertain) { localStorage.removeItem(storageKey); setPending(null) }
      setMessage(error instanceof Error ? error.message : '花篮暂时不可用。')
    } finally { setBusy(false) }
  }
  return <section className="flower-basket" aria-label="我的花篮">
    <h3>我的花篮 <span>{wallet ? `${wallet.balance} 朵` : '…'}</span></h3>
    <p className="muted">每天免费领 3 朵，最多存 30 朵。每天北京时间 0 点重置；鲜花不收费、不能提现。</p>
    {pending ? <div role="status"><p>有一笔操作尚待确认：{pending.action === 'claim' ? '领取今日鲜花' : `赠送 ${pending.amount} 朵鲜花`}。重试会查询或完成同一笔操作。</p>
      <button disabled={busy} onClick={() => void send(pending)}>确认这笔操作的结果</button></div> : <div className="community-actions">
      <button disabled={busy || !wallet || wallet.claimed} onClick={() => void send({ action: 'claim', idempotencyKey: crypto.randomUUID() })}>{wallet?.claimed ? '今天已领取' : '领取今日鲜花'}</button>
      {slug && !isAuthor && <><label>送花数量 <select value={amount} onChange={event => setAmount(Number(event.target.value))}>{[1,2,3].map(n => <option key={n} value={n}>{n} 朵</option>)}</select></label>
        <button disabled={busy || !wallet || wallet.balance < amount} onClick={() => void send({ action: 'gift', slug, amount, idempotencyKey: crypto.randomUUID() })}>送给这部作品</button></>}
      {isAuthor && <span className="muted">自己的作品不能送花。</span>}
    </div>}
    {message && <p role="status">{message}</p>}
    {!slug && wallet && <details><summary>最近 50 笔收支</summary><ul className="activity-list">{wallet.items.map(item => <li key={item.id}>
      {item.kind === 'claim' ? '每日领取' : `送给「${item.title ?? '暂不可访问的作品'}」`} · {item.amount > 0 ? '+' : ''}{item.amount} 朵
      <time>{new Date(item.createdAt).toLocaleString('zh-CN')}</time></li>)}</ul></details>}
  </section>
}

export function WorkSocial({ slug }: { slug: string }) {
  const session = useCommunitySession()
  const [state, setState] = useState<SocialState | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const refresh = () => socialJson<SocialState>(`social?slug=${slug}`, session).then(setState)
  useEffect(() => { setState(null); void refresh().catch(() => setMessage('互动信息暂时无法读取。')) }, [slug, session?.access_token])
  const toggle = async (name: 'like'|'save'|'follow', value: boolean) => {
    if (!session) { setOpen(true); return }
    if (busy) return
    setBusy(true); setMessage('')
    try { await action(session, { action: name, slug, value }); await refresh() }
    catch (error) { setMessage(error instanceof Error ? error.message : '操作未完成。') }
    finally { setBusy(false) }
  }
  return <aside className="work-social" aria-label="作品互动">
    {state?.currentSlug && state.currentSlug !== slug && <p>你正在阅读历史公开版本。<a href={`/community-works/work/${state.currentSlug}`}>查看最新版本 →</a></p>}
    <div className="community-actions">
      <button disabled={busy || !state} aria-pressed={state?.liked ?? false} onClick={() => void toggle('like', !state?.liked)}>{state?.liked ? '♥ 已点赞' : '♡ 点赞'} · {state?.likes ?? '—'}</button>
      <button disabled={busy || !state} aria-pressed={state?.saved ?? false} onClick={() => void toggle('save', !state?.saved)}>{state?.saved ? '已收藏 · 移出书架' : '收藏到书架'}</button>
      {state?.saved && <button disabled={busy} aria-pressed={state.following} onClick={() => void toggle('follow', !state.following)}>{state.following ? '已追更 · 关闭提醒' : '开启追更提醒'}</button>}
      <button aria-expanded={open} onClick={() => setOpen(value => !value)}>✿ 送花 · {state?.flowers ?? '—'}</button>
    </div>
    {message && <p role="status">{message}</p>}
    {open && <AuthGate>{account => <FlowerBasket key={account.user.id} session={account} slug={slug} isAuthor={state?.isAuthor} onChange={() => void refresh().catch(()=>setMessage('送花已完成，统计暂时无法刷新。'))} />}</AuthGate>}
  </aside>
}

type ShelfItem = { workId: string; title: string; slug: string|null; resumeSlug: string|null; following: boolean; updated: boolean; section: number|null; entry: number|null; block: number|null }
type Notice = { submissionId: string | null; reviewStatus: string | null; id: string; kind: string; title: string; slug: string|null; commentId: string|null; quantity: number; readAt: string|null; createdAt: string }
type Block = { id: string; displayName: string; createdAt: string }
const reviewLabels:Record<string,string>={approved:'审核通过，待发布',published:'已公开',needs_changes:'需要修改',rejected:'未通过审核',withdrawn:'已撤回',taken_down:'已下架'}
const noticeLabels: Record<string,string> = { review:'投稿状态更新', update: '作品更新了', comment: '作品收到新评论', reply: '有人回复了你的评论', flowers: '作品收到鲜花' }

function ReaderWorkspace({ session }: { session: Session }) {
  const [tab, setTab] = useState<'shelf'|'notifications'|'wallet'|'blocks'>('shelf')
  const [items, setItems] = useState<Array<ShelfItem|Notice|Block>>([])
  const [offset, setOffset] = useState(0)
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const refresh = async (start = 0, signal?: AbortSignal) => {
    setBusy(true); setMessage('')
    try {
      const result = await socialJson<{ items: Array<ShelfItem|Notice|Block> }>(`social?scope=${tab}&offset=${start}`, session, undefined, signal)
      if (signal?.aborted) return
      setItems(old => start ? [...old,...result.items] : result.items); setOffset(start + result.items.length); setMore(result.items.length === 50)
    } catch (error) { if (!signal?.aborted) setMessage(error instanceof Error ? error.message : '无法读取。') }
    finally { if (!signal?.aborted) setBusy(false) }
  }
  useEffect(() => { const controller = new AbortController(); setItems([]); setMore(false)
    if (tab !== 'wallet') void refresh(0,controller.signal)
    return () => controller.abort()
  }, [tab,session.access_token])
  const mutate = async (body: unknown) => { setBusy(true); try { await action(session,body); await refresh() }
    catch(error) { setMessage(error instanceof Error ? error.message : '操作未完成。') } finally { setBusy(false) } }
  return <main id="main-content" className="community-page reading-workspace"><div className="page-heading"><div><h1>我的阅读空间</h1>
    <p>书架、阅读位置、消息和花篮只对你可见。</p></div><a className="secondary-link" href="/community-works/">发现作品 →</a></div>
    <nav className="reader-tabs" aria-label="阅读空间">{([['shelf','我的书架'],['notifications','站内消息'],['wallet','我的花篮'],['blocks','屏蔽管理']] as const).map(([key,label]) =>
      <button key={key} aria-pressed={tab===key} onClick={() => setTab(key)}>{label}</button>)}</nav>
    {tab === 'wallet' ? <FlowerBasket key={session.user.id} session={session} /> : <>
      {message && <p role="alert">{message} <button onClick={() => void refresh()}>重试</button></p>}
      {busy && <p role="status">正在读取…</p>}{!busy && !message && !items.length && <p className="empty-state">{tab === 'shelf' ? '书架还是空的，在作品页点击“收藏到书架”即可加入。' : tab === 'notifications' ? '暂时没有站内消息。回复、追更和投稿状态更新会出现在这里。' : '暂时没有屏蔽记录。'}</p>}
      <div className={`workspace-list workspace-list--${tab}`}>{items.map(raw => {
        if (tab === 'shelf') { const item = raw as ShelfItem; return <article className="shelf-card" key={item.workId}><h2>{item.title}</h2>
          {item.updated && <span className="kind-tag">有新版本</span>}<div className="community-actions">
            {item.slug && <a href={`/community-works/work/${item.slug}`}>阅读最新版本 →</a>}
            {item.resumeSlug && <a href={`/community-works/work/${item.resumeSlug}?section=${item.section}&entry=${item.entry}&block=${item.block}`}>继续上次阅读</a>}
            <button disabled={busy} onClick={() => void mutate({ action:'unsave',data:{workId:item.workId} })}>移出书架</button>
          </div><p className="muted">{item.following ? '已开启更新提醒' : '未开启更新提醒'}</p></article> }
        if (tab === 'notifications') { const item = raw as Notice; return <article className="shelf-card" key={item.id}><h2>{noticeLabels[item.kind] ?? '社区消息'}{item.kind==='flowers' ? ` · ${item.quantity} 朵` : ''}</h2>
          <p>{item.title}{item.reviewStatus ? ` · ${reviewLabels[item.reviewStatus] ?? item.reviewStatus}` : ''}</p><time>{new Date(item.createdAt).toLocaleString('zh-CN')}</time><div className="community-actions">
            {item.submissionId && <a href="/community-works/me">查看我的投稿 →</a>}
            {item.slug && <a href={`/community-works/work/${item.slug}${item.commentId ? `?comment=${item.commentId}` : ''}`}>查看作品 →</a>}
            {!item.readAt && <button disabled={busy} onClick={() => void mutate({action:'read-notification',data:{notificationId:item.id}})}>标为已读</button>}
            {item.readAt && <span className="muted">已读</span>}</div></article> }
        const item = raw as Block; return <article className="shelf-card" key={item.id}><p>{item.displayName} · {new Date(item.createdAt).toLocaleString('zh-CN')}</p>
          <button disabled={busy} onClick={() => void mutate({ action:'unblock',data:{blockId:item.id} })}>解除屏蔽</button></article>
      })}</div>
      {more && <button disabled={busy} onClick={() => void refresh(offset)}>加载更多</button>}
    </>}
  </main>
}
export function ReadingSpace() { return <AuthGate>{session => <ReaderWorkspace key={session.user.id} session={session} />}</AuthGate> }
