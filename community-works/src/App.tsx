import { useEffect, useState } from 'react'
import { apiRoot, loadJson, loadTextParts, parseChapterPage, parseDetail, parseEntryPage, parseList, type PublicDimension, type PublicWorkCard, type PublicWorkDetail, type WorkKind } from './publications'
import { ReviewPage } from './ReviewPage'
import { Comments } from './Comments'
import { MySubmissions } from './MySubmissions'

function Header() {
  return <header className="site-header">
    <a className="brand" href="/community-works/" aria-label="社区作品集首页"><span className="brand-mark">S</span><span>StoryForge <strong>社区作品集</strong></span></a>
    <nav aria-label="主要导航"><a href="/community-works/me">我的投稿</a> · <a href="https://storyforge-lab.com/">返回 StoryForge 官网 ↗</a></nav>
  </header>
}

function Home() {
  const [kind, setKind] = useState<WorkKind | 'all'>('all')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<PublicWorkCard[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  useEffect(() => {
    const controller = new AbortController()
    setState('loading')
    const params = new URLSearchParams()
    if (kind !== 'all') params.set('kind', kind)
    if (query.trim()) params.set('q', query.trim())
    loadJson(`${apiRoot}?${params}`, controller.signal).then(data => {
      setItems(parseList(data))
      setState('ready')
    }).catch(error => { if (error instanceof DOMException && error.name === 'AbortError') return; setState('error') })
    return () => controller.abort()
  }, [kind, query])

  return <>
    <section className="hero"><p className="eyebrow">STORYFORGE / COMMUNITY WORKS</p><h1>让写下的故事，<br /><em>遇见更多读者。</em></h1><p>这里收录作者自愿分享、经过审核的原创小说和拆书分析。每一篇作品都来自作者明确选择的公开版本。</p></section>
    <main id="main-content" className="content-shell"><div className="section-head"><div><p className="eyebrow">EXPLORE THE LIBRARY</p><h2>浏览作品</h2></div><span>原创 · 阅读 · 交流</span></div>
      <div className="filters" role="group" aria-label="作品类型">{([['all', '全部作品'], ['novel', '原创小说'], ['book-analysis', '拆书分析']] as const).map(([value, label]) => <button key={value} type="button" className={kind === value ? 'selected' : ''} aria-pressed={kind === value} onClick={() => setKind(value)}>{label}</button>)}
        <label className="search"><span className="sr-only">搜索作品</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索标题或作者" /></label></div>
      {state === 'loading' && <p className="feedback" role="status">正在读取已公开作品…</p>}
      {state === 'error' && <div className="feedback" role="alert"><strong>暂时无法读取作品集</strong><p>请稍后再试。投稿和审核服务尚未开放时，这里不会显示示例作品。</p></div>}
      {state === 'ready' && items.length === 0 && <div className="feedback"><strong>还没有符合条件的公开作品</strong><p>作品经作者确认并审核通过后会出现在这里。</p></div>}
      {state === 'ready' && items.length > 0 && <div className="work-grid">{items.map(item => <a className="work-card" key={item.slug} href={`/community-works/work/${item.slug}`}><span className="kind-tag">{item.kind === 'novel' ? '原创小说' : '拆书分析'}</span><h3>{item.title}</h3><p>{item.description}</p><div className="card-foot"><span>{item.authorName}</span><span>阅读作品 ↗</span></div></a>)}</div>}
    </main>
  </>
}

function TextParts({ slug, section, entry }: { slug: string; section: number; entry: number }) {
  const [text, setText] = useState('')
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  useEffect(() => {
    const controller = new AbortController()
    setText('')
    setState('loading')
    loadTextParts(slug, section, entry, controller.signal).then(value => {
      setText(value)
      setState('ready')
    }).catch(error => {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setState('error')
    })
    return () => controller.abort()
  }, [slug, section, entry])
  if (state === 'loading') return <p role="status">正在读取正文…</p>
  if (state === 'error') return <p role="alert">正文暂时无法读取，请稍后重试。</p>
  return <>{text.split(/\n+/).map((paragraph, line) => <p key={line}>{paragraph}</p>)}</>
}

function NovelReader({ slug, initialChapters, chapterCount }: {
  slug: string; initialChapters: PublicWorkDetail['chapters']; chapterCount: number
}) {
  const chapterFromHash = () => {
    const match = window.location.hash.match(/^#chapter-(\d+)$/)
    const index = match ? Number(match[1]) - 1 : 0
    return Number.isSafeInteger(index) && index >= 0 && index < chapterCount ? index : 0
  }
  const [index, setIndex] = useState(chapterFromHash)
  const [chapters, setChapters] = useState(initialChapters)
  const [nextOffset, setNextOffset] = useState(initialChapters.length)
  const [directoryError, setDirectoryError] = useState(false)
  const readPage = async (offset: number, signal?: AbortSignal) => {
    const page = await loadJson(`${apiRoot}/${slug}/toc?section=-1&offset=${offset}&limit=100`, signal ?? new AbortController().signal)
    const parsed = parseChapterPage(page, offset)
    if (!parsed) throw new Error('章节目录无效')
    setChapters(current => [...new Map([...current, ...parsed].map(item => [item.index, item])).values()].sort((a, b) => a.index - b.index))
    return parsed
  }
  useEffect(() => {
    const onHashChange = () => setIndex(chapterFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [chapterCount])
  useEffect(() => {
    if (chapters.some(item => item.index === index)) return
    const controller = new AbortController()
    readPage(Math.floor(index / 100) * 100, controller.signal).catch(error => {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setDirectoryError(true)
    })
    return () => controller.abort()
  }, [index, chapters, slug])
  const choose = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= chapterCount) return
    setIndex(nextIndex)
    window.history.replaceState(null, '', `#chapter-${nextIndex + 1}`)
    document.getElementById('chapter-heading')?.scrollIntoView({ block: 'start' })
  }
  const chapter = chapters.find(item => item.index === index)
  return <>
    <div className="reader-tools">
      <label htmlFor="chapter-select">章节目录</label>
      <select id="chapter-select" value={index} onChange={event => choose(Number(event.target.value))}>
        {!chapter && <option value={index}>第 {index + 1} 章</option>}
        {chapters.map((item, chapterIndex) =>
          <option key={chapterIndex} value={item.index}>{item.index + 1}. {item.title}</option>)}
      </select>
      <span role="status">{index + 1} / {chapterCount}</span>
      {nextOffset < chapterCount && <button type="button" onClick={() => {
        readPage(nextOffset).then(page => setNextOffset(nextOffset + page.length)).catch(() => setDirectoryError(true))
      }}>加载更多目录</button>}
    </div>
    {directoryError && <p role="alert">目录暂时无法读取。</p>}
    <section className="reading-section">
      <h2 id="chapter-heading">{chapter?.title ?? `第 ${index + 1} 章`}</h2>
      <TextParts slug={slug} section={index} entry={0} />
    </section>
    <nav className="reader-pager" aria-label="章节导航">
      <button type="button" disabled={index === 0} onClick={() => choose(index - 1)}>← 上一章</button>
      <button type="button" disabled={index === chapterCount - 1} onClick={() => choose(index + 1)}>下一章 →</button>
    </nav>
  </>
}

function AnalysisEntry({ slug, dimensionIndex, index, label }: { slug: string; dimensionIndex: number; index: number; label: string }) {
  const [open, setOpen] = useState(false)
  return <details onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{label}</summary>
    {open && <TextParts slug={slug} section={dimensionIndex} entry={index} />}
  </details>
}

function AnalysisDimension({ slug, dimension }: { slug: string; dimension: PublicDimension }) {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<Array<{ index: number; label: string }>>([])
  const [state, setState] = useState<'ready' | 'loading' | 'error'>('ready')
  const loadMore = () => {
    if (state === 'loading' || entries.length >= dimension.entryCount) return
    setState('loading')
    loadJson(`${apiRoot}/${slug}/toc?section=${dimension.index}&offset=${entries.length}&limit=100`, new AbortController().signal)
      .then(value => {
        const page = parseEntryPage(value, entries.length, dimension.entryCount)
        if (!page) throw new Error('分析目录无效')
        setEntries(current => [...current, ...page])
        setState('ready')
      }).catch(() => setState('error'))
  }
  return <section className="reading-section" id={`dimension-${dimension.key}`}>
    <h2>{dimension.label}</h2>
    {!dimension.selected && <p className="muted">作者未选择公开此维度。</p>}
    {dimension.selected && dimension.entryCount === 0 && <p className="muted">所选范围在此维度没有内容。</p>}
    {dimension.selected && dimension.entryCount > 0 && <>
      <button type="button" onClick={() => { setOpen(value => !value); if (!open && !entries.length) loadMore() }}>
        {open ? '收起分析' : `展开分析（${dimension.entryCount} 条）`}
      </button>
      {open && <>
        {entries.map(entry => <AnalysisEntry key={entry.index} slug={slug} dimensionIndex={dimension.index} {...entry} />)}
        {entries.length < dimension.entryCount && state !== 'loading' && <button type="button" onClick={loadMore}>加载更多条目</button>}
        {state === 'loading' && <p role="status">正在读取分析目录…</p>}
        {state === 'error' && <p role="alert">分析目录暂时无法读取。</p>}
      </>}
    </>}
  </section>
}

function AnalysisReader({ slug, detail }: { slug: string; detail: PublicWorkDetail }) {
  return <>
    <nav className="toc" aria-label="分析目录"><h2>分析目录</h2>
      {detail.dimensions.map(dimension => <a key={dimension.key} href={`#dimension-${dimension.key}`}>{dimension.label}</a>)}
    </nav>
    {detail.dimensions.map(dimension => <AnalysisDimension key={dimension.key} slug={slug} dimension={dimension} />)}
    {detail.hasAuthorCommentary && <section className="reading-section"><h2>作者点评</h2><TextParts slug={slug} section={13} entry={0} /></section>}
  </>
}

function Detail({ slug }: { slug: string }) {
  const [detail, setDetail] = useState<PublicWorkDetail | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  useEffect(() => {
    const controller = new AbortController()
    loadJson(`${apiRoot}/${encodeURIComponent(slug)}`, controller.signal).then(data => {
      const parsed = parseDetail(data)
      if (!parsed) throw new Error('无效公开作品')
      setDetail(parsed)
      setState('ready')
    }).catch(error => { if (error instanceof DOMException && error.name === 'AbortError') return; setState('error') })
    return () => controller.abort()
  }, [slug])
  return <main id="main-content" className="detail-shell">
    <a className="back-link" href="/community-works/">← 返回作品集</a>
    {state === 'loading' && <p role="status">正在读取作品…</p>}
    {state === 'error' && <p role="alert">作品暂时不可访问，可能已下架或尚未通过审核。</p>}
    {state === 'ready' && detail && <article>
      <p className="eyebrow">{detail.kind === 'novel' ? 'ORIGINAL FICTION' : 'BOOK ANALYSIS'}</p>
      <h1>{detail.title}</h1>
      <p className="byline">{detail.authorName} · {detail.language}</p>
      <p className="lead">{detail.description}</p>
      {detail.kind === 'novel'
        ? <NovelReader slug={slug} initialChapters={detail.chapters} chapterCount={detail.chapterCount} />
        : <AnalysisReader slug={slug} detail={detail} />}
      <Comments slug={slug} />
    </article>}
  </main>
}

export function App() {
  const match = window.location.pathname.match(/^\/community-works\/work\/([a-z0-9-]{1,100})\/?$/)
  const review = /^\/community-works\/review\/?$/.test(window.location.pathname)
  const mine = /^\/community-works\/me\/?$/.test(window.location.pathname)
  return <><a className="skip-link" href="#main-content">跳到正文</a><Header />{review ? <ReviewPage /> : mine ? <MySubmissions /> : match ? <Detail slug={match[1]} /> : <Home />}<footer><span>StoryForge 社区作品集</span><span>只展示作者主动投稿且审核通过的版本</span></footer></>
}
