import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { apiRoot, loadJson, parseChapterPage, parseDetail, parseEntryPage, parseListPage, type PublicDimension, type PublicWorkCard, type PublicWorkDetail, type WorkKind } from './publications'
const ReviewPage = lazy(()=>import('./ReviewPage').then(module=>({default:module.ReviewPage})))
const EmbeddedReview = lazy(()=>import('./EmbeddedReview').then(module=>({default:module.EmbeddedReview})))
import { Comments } from './Comments'
const MySubmissions = lazy(()=>import('./MySubmissions').then(module=>({default:module.MySubmissions})))
import { PolicyPage } from './PolicyPage'
import { ReadingText } from './ReadingText'
import { WorkSocial, ReadingSpace } from './ReaderSocial'
import { ReviewerNotice } from './AutomaticReview'

const SubmitPage = lazy(() => import('./SubmitPage').then(module => ({ default: module.SubmitPage })))

function Header() {
  return <header className="site-header">
    <a className="brand" href="/community-works/" aria-label="社区作品集首页"><span className="brand-mark">S</span><span>StoryForge <strong>社区作品集</strong></span></a>
    <nav aria-label="主要导航"><ReviewerNotice /><a className="submit-link" href="/community-works/submit" aria-current={window.location.pathname.replace(/\/$/, "") === "/community-works/submit" ? "page" : undefined}>我要投稿</a><a href="/community-works/library" aria-current={window.location.pathname.replace(/\/$/, "") === "/community-works/library" ? "page" : undefined}>阅读空间</a><a href="/community-works/me" aria-current={window.location.pathname.replace(/\/$/, "") === "/community-works/me" ? "page" : undefined}>我的投稿</a><a href="https://storyforge-lab.com/">返回 StoryForge 官网 ↗</a></nav>
  </header>
}

function Home() {
  const [kind, setKind] = useState<WorkKind | 'all'>('all')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<PublicWorkCard[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState(false)
  const moreController = useRef<AbortController | null>(null)
  const pageVersion = useRef(0)
  useEffect(() => {
    const controller = new AbortController()
    const version = ++pageVersion.current
    moreController.current?.abort()
    moreController.current = null
    setItems([])
    setNextOffset(null)
    setLoadingMore(false)
    setMoreError(false)
    setState('loading')
    const params = new URLSearchParams()
    if (kind !== 'all') params.set('kind', kind)
    if (query.trim()) params.set('q', query.trim())
    params.set('offset', '0')
    loadJson(`${apiRoot}?${params}`, controller.signal).then(data => {
      if (version !== pageVersion.current) return
      const page = parseListPage(data, 0)
      setItems(page.items)
      setNextOffset(page.nextOffset)
      setState('ready')
    }).catch(error => {
      if (version !== pageVersion.current || (error instanceof DOMException && error.name === 'AbortError')) return
      setState('error')
    })
    return () => { controller.abort(); moreController.current?.abort() }
  }, [kind, query])

  const loadMore = () => {
    if (nextOffset === null || loadingMore) return
    const version = pageVersion.current
    const offset = nextOffset
    const controller = new AbortController()
    moreController.current = controller
    setLoadingMore(true)
    setMoreError(false)
    const params = new URLSearchParams()
    if (kind !== 'all') params.set('kind', kind)
    if (query.trim()) params.set('q', query.trim())
    params.set('offset', String(offset))
    loadJson(`${apiRoot}?${params}`, controller.signal).then(data => {
      if (version !== pageVersion.current) return
      const page = parseListPage(data, offset)
      setItems(current => {
        const seen = new Set(current.map(item => item.slug))
        return [...current, ...page.items.filter(item => !seen.has(item.slug))]
      })
      setNextOffset(page.nextOffset)
    }).catch(error => {
      if (version !== pageVersion.current || (error instanceof DOMException && error.name === 'AbortError')) return
      setMoreError(true)
    }).finally(() => {
      if (version === pageVersion.current) { setLoadingMore(false); moreController.current = null }
    })
  }

  return <main id="main-content" className="community-page catalog-page">
      <div className="page-heading"><div><h1>浏览作品</h1><p>作者公开分享的原创小说与拆书分析。</p></div>
        <a className="secondary-link" href="/community-works/policy">投稿与社区规则</a></div>
      <div className="filters" role="group" aria-label="作品类型">{([['all', '全部作品'], ['novel', '原创小说'], ['book-analysis', '拆书分析']] as const).map(([value, label]) => <button key={value} type="button" className={kind === value ? 'selected' : ''} aria-pressed={kind === value} onClick={() => setKind(value)}>{label}</button>)}
        <label className="search"><span className="sr-only">搜索作品</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索标题或作者" /></label></div>
      {state === 'loading' && <p className="feedback" role="status">正在读取已公开作品…</p>}
      {state === 'error' && <div className="feedback" role="alert"><strong>暂时无法读取作品集</strong><p>请稍后刷新页面重试。</p></div>}
      {state === 'ready' && items.length === 0 && <div className="feedback"><strong>还没有符合条件的公开作品</strong><p>作品经作者确认并审核通过后会出现在这里。</p></div>}
      {state === 'ready' && items.length > 0 && (
        <div className="work-grid">
          {items.map(item => (
            <a className="work-card" key={item.slug} href={`/community-works/work/${item.slug}`}>
              <span className="kind-tag">{item.kind === 'novel' ? '原创小说' : '拆书分析'}</span>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
              <div className="card-foot"><span>{item.authorName}</span><span>阅读作品 →</span></div>
            </a>
          ))}
        </div>
      )}
      {state === 'ready' && moreError && <p className="feedback" role="alert">更多作品暂时无法读取，请重试。</p>}
      {state === 'ready' && nextOffset !== null && <button className="load-more" type="button" disabled={loadingMore} onClick={loadMore}>{loadingMore ? '正在加载…' : '加载更多作品'}</button>}
    </main>
}

function NovelReader({ slug, initialChapters, chapterCount }: {
  slug: string; initialChapters: PublicWorkDetail['chapters']; chapterCount: number
}) {
  const chapterFromHash = () => {
    const match = window.location.hash.match(/^#chapter-(\d+)$/)
    const saved = new URLSearchParams(window.location.search).get('section')
    const index = match ? Number(match[1]) - 1 : saved !== null ? Number(saved) : 0
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
  return <div className="reader-layout">
    <nav className="reader-directory" aria-label="章节目录">
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
    <div className="chapter-links">{chapters.map(item => <button key={item.index} type="button" aria-current={item.index === index ? 'location' : undefined} onClick={() => choose(item.index)}>{item.index + 1}. {item.title}</button>)}</div>
    {directoryError && <p role="alert">目录暂时无法读取。</p>}
    </nav>
    <div className="reader-main">
    <section className="reading-section">
      <h2 id="chapter-heading">{chapter?.title ?? `第 ${index + 1} 章`}</h2>
      <ReadingText slug={slug} section={index} entry={0} />
    </section>
    <nav className="reader-pager" aria-label="章节导航">
      <button type="button" disabled={index === 0} onClick={() => choose(index - 1)}>← 上一章</button>
      <button type="button" disabled={index === chapterCount - 1} onClick={() => choose(index + 1)}>下一章 →</button>
    </nav>
    </div>
  </div>
}

function AnalysisEntry({ slug, dimensionIndex, index, label, initiallyOpen }: { slug: string; dimensionIndex: number; index: number; label: string; initiallyOpen: boolean }) {
  const q=new URLSearchParams(window.location.search)
  const [open, setOpen] = useState(q.get('section')===String(dimensionIndex) ? q.get('entry')===String(index) : initiallyOpen)
  return <details open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{label}</summary>
    {open && <ReadingText slug={slug} section={dimensionIndex} entry={index} />}
  </details>
}

function AnalysisDimension({ slug, dimension }: { slug: string; dimension: PublicDimension }) {
  const q=new URLSearchParams(window.location.search)
  const resume=q.get('section')===String(dimension.index)
  const [open, setOpen] = useState(true)
  const [entries, setEntries] = useState<Array<{ index: number; label: string }>>([])
  const [state, setState] = useState<'ready' | 'loading' | 'error'>('ready')
  const loadMore = () => {
    if (state === 'loading' || (entries.at(-1)?.index ?? -1)+1 >= dimension.entryCount) return
    setState('loading')
    loadJson(`${apiRoot}/${slug}/toc?section=${dimension.index}&offset=${(entries.at(-1)?.index ?? -1)+1}&limit=100`, new AbortController().signal)
      .then(value => {
        const page = parseEntryPage(value, (entries.at(-1)?.index ?? -1)+1, dimension.entryCount)
        if (!page) throw new Error('分析目录无效')
        setEntries(current => [...current, ...page])
        setState('ready')
      }).catch(() => setState('error'))
  }
  const loadPrevious = () => {
    const first = entries[0]?.index ?? 0
    if (state === 'loading' || first === 0) return
    const offset = Math.max(0, first - 100)
    setState('loading')
    loadJson(`${apiRoot}/${slug}/toc?section=${dimension.index}&offset=${offset}&limit=${first-offset}`, new AbortController().signal)
      .then(value => {
        const page = parseEntryPage(value, offset, dimension.entryCount)
        if (!page) throw new Error('分析目录无效')
        setEntries(current => [...page, ...current]); setState('ready')
      }).catch(() => setState('error'))
  }
  useEffect(()=> { if(dimension.selected && dimension.entryCount>0) {
    const target=resume ? Number(q.get('entry')??0) : 0; const offset=Number.isSafeInteger(target)&&target>=0&&target<dimension.entryCount?Math.floor(target/100)*100:0
    setState('loading'); const controller=new AbortController()
    loadJson(`${apiRoot}/${slug}/toc?section=${dimension.index}&offset=${offset}&limit=100`,controller.signal).then(value=>{const page=parseEntryPage(value,offset,dimension.entryCount);if(!page)throw Error('invalid');setEntries(page);setState('ready')}).catch(()=>{if(!controller.signal.aborted)setState('error')});return()=>controller.abort()
  } },[slug,dimension.index])
  return <section className="reading-section" id={`dimension-${dimension.key}`}>
    <h2>{dimension.label}</h2>
    {!dimension.selected && <p className="muted">作者未选择公开此维度。</p>}
    {dimension.selected && dimension.entryCount === 0 && <p className="muted">所选范围在此维度没有内容。</p>}
    {dimension.selected && dimension.entryCount > 0 && <>
      <button type="button" onClick={() => { setOpen(value => !value); if (!open && !entries.length) loadMore() }}>
        {open ? '收起分析' : `展开分析（${dimension.entryCount} 条）`}
      </button>
      {open && <>
        {(entries[0]?.index ?? 0) > 0 && <button type="button" disabled={state === 'loading'} onClick={loadPrevious}>加载前面的条目</button>}
        {entries.map(entry => <AnalysisEntry key={entry.index} slug={slug} dimensionIndex={dimension.index} initiallyOpen={entry.index === 0} {...entry} />)}
        {(entries.at(-1)?.index ?? -1)+1 < dimension.entryCount && state !== 'loading' && <button type="button" onClick={loadMore}>加载更多条目</button>}
        {state === 'loading' && <p role="status">正在读取分析目录…</p>}
        {state === 'error' && <p role="alert">分析目录暂时无法读取。</p>}
      </>}
    </>}
  </section>
}

function AnalysisReader({ slug, detail }: { slug: string; detail: PublicWorkDetail }) {
  const initialKey = () => {
    const hash = window.location.hash.replace(/^#dimension-/, '')
    if (detail.dimensions.some(item => item.key === hash) || (hash === 'author-commentary' && detail.hasAuthorCommentary)) return hash
    const saved = new URLSearchParams(window.location.search).get('section')
    if (saved === '13' && detail.hasAuthorCommentary) return 'author-commentary'
    return detail.dimensions.find(item => String(item.index) === saved)?.key
      ?? detail.dimensions.find(item => item.selected && item.entryCount > 0)?.key
      ?? detail.dimensions[0]?.key
  }
  const [active, setActive] = useState(initialKey)
  useEffect(() => {
    const changed = () => setActive(initialKey())
    window.addEventListener('hashchange', changed)
    return () => window.removeEventListener('hashchange', changed)
  }, [detail])
  const dimension = detail.dimensions.find(item => item.key === active)
  const choose = (key: string) => {
    setActive(key)
    window.history.replaceState(null, '', `#dimension-${key}`)
  }
  return <div className="reader-layout">
    <nav className="toc reader-directory" aria-label="分析目录"><h2>分析目录</h2>
      <select className="mobile-directory" aria-label="选择分析维度" value={active} onChange={event => choose(event.target.value)}>
        {detail.dimensions.map(item => <option key={item.key} value={item.key}>{item.label} · {item.selected ? `${item.entryCount} 条` : '未公开'}</option>)}
        {detail.hasAuthorCommentary && <option value="author-commentary">作者点评</option>}
      </select>
      <div className="directory-links">{detail.dimensions.map(item => <a key={item.key} href={`#dimension-${item.key}`} aria-current={active === item.key ? 'location' : undefined} onClick={event => { event.preventDefault(); choose(item.key) }}><span>{item.label}</span><small>{item.selected ? `${item.entryCount} 条` : '未公开'}</small></a>)}
      {detail.hasAuthorCommentary && <a href="#dimension-author-commentary" aria-current={active === 'author-commentary' ? 'location' : undefined} onClick={event => { event.preventDefault(); choose('author-commentary') }}>作者点评</a>}</div>
    </nav>
    <div className="reader-main">
      {dimension && <AnalysisDimension key={dimension.key} slug={slug} dimension={dimension} />}
      {active === 'author-commentary' && detail.hasAuthorCommentary && <section id="dimension-author-commentary" className="reading-section"><h2>作者点评</h2><ReadingText slug={slug} section={13} entry={0} /></section>}
      {!dimension && !detail.hasAuthorCommentary && <p className="muted">当前公开范围没有分析内容。</p>}
    </div>
  </div>
}

function Detail({ slug }: { slug: string }) {
  const comment = new URLSearchParams(window.location.search).get('comment')
  const focusId = comment && /^[0-9a-f-]{36}$/.test(comment) ? comment : undefined
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
  return <main id="main-content" className="detail-shell work-detail">
    <a className="back-link" href="/community-works/">← 返回作品集</a>
    {state === 'loading' && <p role="status">正在读取作品…</p>}
    {state === 'error' && <p role="alert">作品暂时不可访问，可能已下架或尚未通过审核。</p>}
    {state === 'ready' && detail && <article>
      <header className="work-heading">
      <p className="kind-tag">{detail.kind === 'novel' ? '原创小说' : '拆书分析'}</p>
      <h1>{detail.title}</h1>
      <p className="byline">{detail.authorName} · {detail.language}</p>
      <p className="lead">{detail.description}</p>
      <WorkSocial slug={slug} />
      </header>
      {focusId && <Comments slug={slug} focusId={focusId} />}
      {detail.kind === 'novel'
        ? <NovelReader slug={slug} initialChapters={detail.chapters} chapterCount={detail.chapterCount} />
        : <AnalysisReader slug={slug} detail={detail} />}
      <Comments slug={slug} />
    </article>}
  </main>
}

export function App() {
  if (window.location.pathname === '/community-works/review/embed') {
    return <Suspense fallback={<p role="status">正在打开审核区…</p>}><EmbeddedReview /></Suspense>
  }
  const match = window.location.pathname.match(/^\/community-works\/work\/([a-z0-9-]{1,100})\/?$/)
  const review = /^\/community-works\/review\/?$/.test(window.location.pathname)
  const library = /^\/community-works\/library\/?$/.test(window.location.pathname)
  const submit = /^\/community-works\/submit\/?$/.test(window.location.pathname)
  const mine = /^\/community-works\/me\/?$/.test(window.location.pathname)
  const policy = /^\/community-works\/policy\/?$/.test(window.location.pathname)
  return <><a className="skip-link" href="#main-content">跳到正文</a><Header /><Suspense fallback={<p role="status">正在打开页面…</p>}>{submit ? <SubmitPage /> : review ? <ReviewPage /> : library ? <ReadingSpace /> : mine ? <MySubmissions /> : policy ? <PolicyPage /> : match ? <Detail slug={match[1]} /> : <Home />}</Suspense><footer><span>StoryForge 社区作品集</span><a href="/community-works/policy">内容与审核规则</a><span>只展示作者主动投稿且审核通过的版本</span></footer></>
}
