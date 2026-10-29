import { useEffect, useState } from 'react'
import { apiRoot, loadJson, parseDetail, parseList, type PublicWorkCard, type PublicWorkDetail, type WorkKind } from './publications'

function Header() {
  return <header className="site-header">
    <a className="brand" href="/community-works/" aria-label="社区作品集首页"><span className="brand-mark">S</span><span>StoryForge <strong>社区作品集</strong></span></a>
    <nav aria-label="主要导航"><a href="https://storyforge-lab.com/">返回 StoryForge 官网 ↗</a></nav>
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
  return <main id="main-content" className="detail-shell"><a className="back-link" href="/community-works/">← 返回作品集</a>{state === 'loading' && <p role="status">正在读取作品…</p>}{state === 'error' && <p role="alert">作品暂时不可访问，可能已下架或尚未通过审核。</p>}{state === 'ready' && detail && <article><p className="eyebrow">{detail.kind === 'novel' ? 'ORIGINAL FICTION' : 'BOOK ANALYSIS'}</p><h1>{detail.title}</h1><p className="byline">{detail.authorName} · {detail.language}</p><p className="lead">{detail.description}</p>{detail.kind === 'novel' ? <><nav className="toc" aria-label="章节目录"><h2>目录</h2>{detail.chapters?.map((chapter, index) => <a key={index} href={`#chapter-${index + 1}`}>{chapter.title}</a>)}</nav>{detail.chapters?.map((chapter, index) => <section className="reading-section" id={`chapter-${index + 1}`} key={index}><h2>{chapter.title}</h2>{chapter.content.split(/\n+/).map((paragraph, line) => <p key={line}>{paragraph}</p>)}</section>)}</> : <><nav className="toc" aria-label="分析目录"><h2>分析目录</h2>{detail.dimensions?.map(dimension => <a key={dimension.key} href={`#dimension-${dimension.key}`}>{dimension.label}</a>)}</nav>{detail.dimensions?.map(dimension => <section className="reading-section" id={`dimension-${dimension.key}`} key={dimension.key}><h2>{dimension.label}</h2>{dimension.selected ? dimension.entries.map((entry, index) => <div key={index}><h3>{entry.label}</h3><p>{entry.text}</p></div>) : <p className="muted">作者未选择公开此维度。</p>}</section>)}{detail.authorCommentary && <section className="reading-section"><h2>作者点评</h2><p>{detail.authorCommentary}</p></section>}</>}</article>}</main>
}

export function App() {
  const match = window.location.pathname.match(/^\/community-works\/work\/([a-z0-9-]{1,100})\/?$/)
  return <><a className="skip-link" href="#main-content">跳到正文</a><Header />{match ? <Detail slug={match[1]} /> : <Home />}<footer><span>StoryForge 社区作品集</span><span>只展示作者主动投稿且审核通过的版本</span></footer></>
}
