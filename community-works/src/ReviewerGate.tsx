import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { communityAuthClient } from './auth'

type GateState = 'loading' | 'denied' | 'unavailable' | 'setup' | 'challenge' | 'ready'

/** Review access requires both an active server-side membership and an aal2 session. */
export function ReviewerGate({ session, children }: {
  session: Session; children: (session: Session) => ReactNode
}) {
  const client = communityAuthClient()
  const [state, setState] = useState<GateState>('loading')
  const [factorId, setFactorId] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [readySession, setReadySession] = useState<Session | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const check = async () => {
    if (!client) { setState('unavailable'); return }
    setState('loading'); setReadySession(null); setMessage('')
    try {
      const { data: current, error: sessionError } = await client.auth.getSession()
      if (sessionError || !current.session || current.session.user.id !== session.user.id) throw new Error('session')
      const response = await fetch('/api/community/v1/review?scope=eligibility', {
        headers: { Authorization: `Bearer ${current.session.access_token}` }, cache: 'no-store',
      })
      if (response.status === 403) { setState('denied'); return }
      if (!response.ok) throw new Error('eligibility')
      const result: unknown = await response.json()
      if (!result || typeof result !== 'object' || (result as { reviewer?: unknown }).reviewer !== true) {
        throw new Error('eligibility')
      }
      const { data: assurance, error: assuranceError } =
        await client.auth.mfa.getAuthenticatorAssuranceLevel(current.session.access_token)
      if (assuranceError || !assurance) throw new Error('assurance')
      if (assurance.currentLevel === 'aal2') {
        setReadySession(current.session); setState('ready'); return
      }
      const { data: factors, error: factorsError } = await client.auth.mfa.listFactors()
      if (factorsError || !factors) throw new Error('factors')
      const verified = factors.totp[0]
      if (verified) { setFactorId(verified.id); setState('challenge') }
      else { setFactorId(''); setSecret(''); setState('setup') }
    } catch { setState('unavailable') }
  }

  useEffect(() => { void check() }, [session.user.id, session.access_token])

  const enroll = async () => {
    if (!client || busy) return
    setBusy(true); setMessage('')
    try {
      const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'StoryForge 审核' })
      if (error || !data || data.type !== 'totp') throw new Error('enroll')
      setFactorId(data.id); setSecret(data.totp.secret); setState('challenge')
    } catch { setMessage('无法启用身份验证器，请稍后重试。') }
    finally { setBusy(false) }
  }

  const verify = async () => {
    if (!client || busy || !factorId || !/^\d{6}$/.test(code)) return
    setBusy(true); setMessage('')
    try {
      const { error } = await client.auth.mfa.challengeAndVerify({ factorId, code })
      if (error) throw error
      setCode(''); setSecret('')
      await check()
    } catch { setMessage('验证码无效或已过期，请检查身份验证器的时间后重试。') }
    finally { setBusy(false) }
  }

  if (state === 'ready' && readySession) return <>{children(readySession)}</>
  if (state === 'loading') return <p className="auth-box" role="status">正在检查审核权限…</p>
  if (state === 'denied') return <p className="auth-box" role="status">此账号没有审核权限。</p>
  if (state === 'unavailable') return <section className="auth-box" role="status">
    <p>暂时无法验证审核权限，请稍后重试。</p>
    <button type="button" onClick={() => void check()}>重新检查</button>
  </section>
  return <section className="auth-box" aria-label="审核员二次验证">
    <h2>审核员二次验证</h2>
    {state === 'setup' ? <>
      <p>首次审核前，请给此账号绑定身份验证器。绑定后，每次新登录都需要输入动态验证码。</p>
      <button type="button" disabled={busy} onClick={() => void enroll()}>启用身份验证器</button>
    </> : <>
      {secret && <p>在身份验证器中手动添加此密钥：<code className="mfa-secret">{secret}</code>
        请勿分享或截图。绑定完成后输入显示的六位动态验证码。</p>}
      {!secret && <p>请输入身份验证器显示的六位动态验证码。</p>}
      <label>动态验证码<input type="text" inputMode="numeric" autoComplete="one-time-code"
        pattern="[0-9]{6}" maxLength={6} value={code}
        onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
      <button type="button" disabled={busy || !/^\d{6}$/.test(code)} onClick={() => void verify()}>
        {busy ? '正在验证…' : '验证并进入审核台'}
      </button>
    </>}
    {message && <p role="status">{message}</p>}
  </section>
}
