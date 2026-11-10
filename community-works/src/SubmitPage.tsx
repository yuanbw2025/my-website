import { useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AuthGate } from './auth'
import { sendNovel, type Novel } from './web-submission'

function NovelForm({ session }: { session: Session }) {
  const [title, setTitle] = useState('')
  const [name, setName] = useState('')
  const [chapters, setChapters] = useState([{ title: '第一章', content: '' }])
  const [preview, setPreview] = useState<Novel | null>(null)
  const [rights, setRights] = useState(false)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [message, setMessage] = useState('')
  const [receipt, setReceipt] = useState('')
  const edit = (i: number, key: 'title' | 'content', value: string) =>
    setChapters((old) => old.map((ch, n) => (n === i ? { ...ch, [key]: value } : ch)))
  if (receipt)
    return (
      <section role="status">
        <h2>已收到投稿</h2>
        <p>编号：{receipt}</p>
        <a href="/community-works/me">查看我的投稿与审核状态 →</a>
      </section>
    )
  return (
    <form
      className="community-form web-submission"
      onSubmit={async (event) => {
        event.preventDefault()
        if (lock.current) return
        setMessage('')
        if (!preview) {
          if (
            !title.trim() ||
            !name.trim() ||
            chapters.some((ch) => !ch.title.trim() || !ch.content.trim())
          ) {
            setMessage('请填写笔名、作品名及每章标题和正文。')
            return
          }
          setPreview({
            schemaVersion: 1,
            kind: 'novel',
            title: title.trim(),
            chapters,
            genres: [],
            description: '',
          })
          return
        }
        if (!rights) return
        lock.current = true
        setBusy(true)
        try {
          setReceipt(await sendNovel(preview, name, session))
        } catch (error) {
          setMessage(error instanceof Error ? error.message : '投稿未确认，请查看记录后重试。')
        } finally {
          lock.current = false
          setBusy(false)
        }
      }}
    >
      {preview ? (
        <>
          <h2>确认公开内容</h2>
          <p>
            {preview.title} · {name.trim()} · 保留所有权利
          </p>
          {preview.chapters.map((ch, i) => (
            <details key={i} open={preview.chapters.length === 1}>
              <summary>{ch.title}</summary>
              <p className="submission-text">{ch.content}</p>
            </details>
          ))}
          <label>
            <span>
              <input
                type="checkbox"
                checked={rights}
                disabled={busy}
                onChange={(e) => setRights(e.target.checked)}
              />{' '}
              我拥有发布权，同意
              <a href="/community-works/policy" target="_blank" rel="noreferrer">
                社区规则
              </a>
              ，同意审核通过后公开以上内容。
            </span>
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setPreview(null)
              setRights(false)
              setMessage('')
            }}
          >
            返回编辑
          </button>{' '}
          <button disabled={busy || !rights}>{busy ? '正在提交…' : '确认并提交待审'}</button>
        </>
      ) : (
        <>
          <label>
            公开笔名
            <input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            作品名称
            <input required maxLength={300} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          {chapters.map((ch, i) => (
            <fieldset key={i}>
              <legend>第 {i + 1} 章</legend>
              <label>
                章节标题
                <input
                  required
                  maxLength={300}
                  value={ch.title}
                  onChange={(e) => edit(i, 'title', e.target.value)}
                />
              </label>
              <label>
                章节正文
                <textarea
                  required
                  rows={7}
                  value={ch.content}
                  onChange={(e) => edit(i, 'content', e.target.value)}
                />
              </label>
              {chapters.length > 1 && (
                <button type="button" onClick={() => setChapters((old) => old.filter((_, n) => n !== i))}>
                  移除此章
                </button>
              )}
            </fieldset>
          ))}
          <button type="button" onClick={() => setChapters((old) => [...old, { title: '', content: '' }])}>
            添加章节
          </button>{' '}
          <button>预览投稿</button>
        </>
      )}
      {message && <p role="alert">{message}</p>}
    </form>
  )
}
export function SubmitPage() {
  return (
    <main id="main-content" className="community-page submit-page">
      <div className="page-heading">
        <div>
          <h1>投稿作品</h1>
          <p>在这里提交原创小说。只粘贴想公开的章节，审核通过后读者才能看到。</p>
        </div>
        <a href="/community-works/me">我的投稿 →</a>
      </div>
      <details>
        <summary>如何提交项目里的小说或拆书分析？</summary>
        <p>
          在支持社区分享的 StoryForge
          版本中，打开小说的项目信息，点“分享至社区作品集”，勾选章节。拆书请从文档解析导入项目参考，打开已完成的作品分析，点“分享此版本到社区作品集”，选择分析条目与维度。请勿粘贴原书。
        </p>
      </details>
      <AuthGate>{(session) => <NovelForm key={session.user.id} session={session} />}</AuthGate>
    </main>
  )
}
