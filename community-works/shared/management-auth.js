const endpoint = 'https://storyforge-lab.com/v1/management/community/verify'
const pattern = /^Bearer sfmgmt_[A-Za-z0-9_-]{43}$/
export const isManagementAuthorization = value => pattern.test(value ?? '')

/** Introspection has no cache: logout, session eviction, expiry and issuer
 * restart immediately deny subsequent requests. Failure never falls back to a
 * fabricated Supabase user or elevated JWT. Only review routes call this. */
export async function managementIdentity(authorization, verifier, backendOrigin, fetcher = fetch) {
  if (!isManagementAuthorization(authorization) || !/^[A-Za-z0-9_-]{43,128}$/.test(verifier ?? '')) return null
  const response = await fetcher(endpoint, {
    method: 'POST', headers: { Authorization: `Bearer ${verifier}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: authorization.slice(7) }),
    redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(5000),
  })
  if (!response.ok) return null
  if (!response.body || Number(response.headers.get('content-length') ?? 0) > 1024) return null
  const reader = response.body.getReader()
  const chunks = []; let length = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      length += next.value.byteLength
      if (length > 1024) return null
      chunks.push(next.value)
    }
  } finally { await reader.cancel().catch(() => {}) }
  const bytes = new Uint8Array(length); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  let value
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) } catch { return null }
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== 'active,audience,backendOrigin,expiresAt,subject' ||
      value.active !== true || value.audience !== 'storyforge-community-review' ||
      value.backendOrigin !== backendOrigin ||
      typeof value.subject !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value.subject) ||
      !Number.isSafeInteger(value.expiresAt) || value.expiresAt <= Date.now() ||
      value.expiresAt > Date.now() + 181000) return null
  return value.subject
}
