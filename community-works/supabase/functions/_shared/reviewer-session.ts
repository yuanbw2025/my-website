/** Use only after Supabase Auth has validated this exact bearer token. */
export function secondFactorVerified(authorization: string, uid: string): boolean {
  const parts = authorization.startsWith('Bearer ') ? authorization.slice(7).split('.') : []
  if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]{1,8192}$/.test(part))) return false
  let claims: Record<string, unknown>
  try {
    claims = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/') +
      '='.repeat((4 - parts[1].length % 4) % 4)))
  } catch { return false }
  return claims.sub === uid && claims.aal === 'aal2' && claims.role === 'authenticated' &&
    typeof claims.exp === 'number' && Number.isSafeInteger(claims.exp) && claims.exp > Date.now() / 1000
}
