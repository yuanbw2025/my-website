import { useEffect, useState } from 'react'
import { ReviewPage } from './ReviewPage'

const managementOrigin = 'https://storyforge-lab.com'

/** No credentials, manuscripts or decisions cross the frame messaging boundary. */
export function EmbeddedReview() {
  const [connected, setConnected] = useState(false)
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (window.parent === window || event.source !== window.parent || event.origin !== managementOrigin ||
          event.data?.type !== 'storyforge:review:connect' || event.data?.version !== 1 ||
          Object.keys(event.data).length !== 2) return
      setConnected(true)
      window.parent.postMessage({ type: 'storyforge:review:ready', version: 1 }, managementOrigin)
    }
    window.addEventListener('message', receive)
    // onload ping from the parent covers either mount order.
    if (window.parent !== window) window.parent.postMessage({ type: 'storyforge:review:waiting', version: 1 }, managementOrigin)
    return () => window.removeEventListener('message', receive)
  }, [])
  if (!connected) return <main id="main-content" className="review-shell" role="status">请从故事熔炉管理后台打开社区审核。</main>
  return <div className="embedded-review"><ReviewPage /></div>
}
