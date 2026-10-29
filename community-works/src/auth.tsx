import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useState, type ReactNode } from 'react'

let shared: SupabaseClient | null | undefined

export function communityAuthClient(): SupabaseClient | null {
  if (shared !== undefined) return shared
  const raw = import.meta.env.VITE_COMMUNITY_SUPABASE_URL
  const key = import.meta.env.VITE_COMMUNITY_SUPABASE_PUBLISHABLE_KEY
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
        typeof key !== 'string' || !key.startsWith('sb_publishable_')) return shared = null
    shared = createClient(url.toString(), key, {
      auth: { flowType: 'pkce', detectSessionInUrl: false,
        storageKey: 'storyforge-community-works-auth-v1' },
    })
    return shared
  } catch { return shared = null }
}

export function AuthGate({ children }: { children: (session: Session) => ReactNode }) {
  const client = communityAuthClient()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(Boolean(client))
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!client) return
    let active = true
    void client.auth.getSession().then(({ data }) => {
      if (active) { setSession(data.session); setLoading(false) }
    }).catch(() => { if (active) setLoading(false) })
    const { data: listener } = client.auth.onAuthStateChange((_event, next) => {
      if (active) { setSession(next); setLoading(false) }
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [client])

  if (!client) return <p role="status">社区账号服务尚未开放。</p>
  if (loading) return <p role="status">正在读取登录状态…</p>
  if (session) return <>
    <div className="account-bar"><span>已登录社区账号</span>
      <button type="button" onClick={() => void client.auth.signOut()}>退出登录</button></div>
    {children(session)}
  </>

  return <section className="auth-box" aria-label="社区账号登录">
    <h2>登录社区账号</h2>
    <p>投稿、举报和审核需要先验证邮箱。邮箱不会展示在作品页。</p>
    <label>邮箱<input type="email" autoComplete="email" value={email}
      onChange={event => setEmail(event.target.value.trim())} /></label>
    {sent && <label>邮件中的验证码<input type="text" inputMode="numeric" autoComplete="one-time-code"
      value={code} onChange={event => setCode(event.target.value.trim())} /></label>}
    <div className="auth-actions">
      <button type="button" disabled={busy || !email.includes('@')} onClick={() => {
        setBusy(true); setMessage('')
        void client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } }).then(({ error }) => {
          if (error) throw error
          setSent(true); setMessage('验证码已发送，请检查邮箱。')
        }).catch(() => setMessage('暂时无法发送验证码，请稍后重试。')).finally(() => setBusy(false))
      }}>{busy ? '请稍候…' : sent ? '重新发送验证码' : '发送验证码'}</button>
      {sent && <button type="button" disabled={busy || code.length < 6} onClick={() => {
        setBusy(true); setMessage('')
        void client.auth.verifyOtp({ email, token: code, type: 'email' }).then(({ error }) => {
          if (error) throw error
          setCode(''); setMessage('验证成功。')
        }).catch(() => setMessage('验证码无效或已过期。')).finally(() => setBusy(false))
      }}>验证并登录</button>}
    </div>
    {message && <p role="status">{message}</p>}
  </section>
}
