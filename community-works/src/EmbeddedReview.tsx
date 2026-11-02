import { useEffect, useState } from 'react'
import { ReviewWorkspace } from './ReviewPage'

const managementOrigin = 'https://storyforge-lab.com'
type Grant = { token: string; expiresAt: number }

/** Only a short-lived, review-only capability crosses the exact-origin frame
 * boundary. No Supabase session, refresh token, password or manuscript does. */
export function EmbeddedReview() {
  const [grant, setGrant] = useState<Grant | null>(null)
  const [message, setMessage] = useState('请从故事熔炉管理后台打开社区审核。')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true, connected = false, nonce: string | null = null
    let expiration: ReturnType<typeof setTimeout> | undefined
    const requestGrant = () => {
      if (!connected) return
      nonce = crypto.randomUUID()
      window.parent.postMessage({ type: 'storyforge:review:authorize', version: 2, nonce }, managementOrigin)
    }
    const deny = (text: string) => { setGrant(null); setMessage(text) }
    const receive = (event: MessageEvent) => {
      if (window.parent === window || event.source !== window.parent || event.origin !== managementOrigin ||
          !event.data || event.data.version !== 2) return
      const data = event.data
      if (data.type === 'storyforge:review:connect' && Object.keys(data).length === 2) {
        if (!connected) { connected = true; setMessage('正在使用管理后台身份连接审核…'); requestGrant() }
      } else if (data.type === 'storyforge:review:revoked' && Object.keys(data).length === 2) {
        nonce = null; deny('管理后台授权已失效，请重新登录管理后台。')
      } else if (data.type === 'storyforge:review:grant' && Object.keys(data).length === 5 && nonce && data.nonce === nonce &&
          typeof data.token === 'string' && /^sfmgmt_[A-Za-z0-9_-]{43}$/.test(data.token) &&
          Number.isSafeInteger(data.expiresAt) && data.expiresAt > Date.now() && data.expiresAt <= Date.now() + 181000) {
        const expectedNonce = nonce
        void fetch('/api/community/v1/review?scope=eligibility', {
          headers: { Authorization: `Bearer ${data.token}` }, cache: 'no-store', signal: AbortSignal.timeout(10000),
        }).then(async response => {
          if (!response.ok || (await response.json()).reviewer !== true) throw new Error('denied')
          if (!active || expectedNonce !== nonce) return
          clearTimeout(expiration)
          setGrant({ token: data.token, expiresAt: data.expiresAt }); setMessage('已使用管理后台身份连接审核。')
          expiration = setTimeout(() => { deny('审核授权已到期，正在重新连接…'); requestGrant() }, Math.max(0, data.expiresAt - Date.now()))
          window.parent.postMessage({ type: 'storyforge:review:ready', version: 2 }, managementOrigin)
        }).catch(() => { if (active && expectedNonce === nonce) deny('暂时无法验证管理后台授权，请重新连接。') })
      }
    }
    window.addEventListener('message', receive)
    if (window.parent !== window) window.parent.postMessage({ type: 'storyforge:review:waiting', version: 2 }, managementOrigin)
    const renewal = setInterval(requestGrant, 60000)
    return () => { active = false; clearInterval(renewal); clearTimeout(expiration); window.removeEventListener('message', receive) }
  }, [retry])
  if (!grant) return <main id="main-content" className="review-shell" role="status">
    <p>{message}</p><button type="button" onClick={() => setRetry(value => value + 1)}>重新连接审核</button>
  </main>
  return <div className="embedded-review"><p className="account-bar">已通过熔炉管理后台授权</p>
    <ReviewWorkspace session={{ access_token: grant.token }} /></div>
}
