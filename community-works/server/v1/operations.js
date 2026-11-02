import { response } from '../_lib/catalog.js'
import { privateCors } from '../_lib/cors.js'
import { settings, uidFromToken, adminJson, reviewer } from '../_lib/reports.js'

const count = value => Number.isSafeInteger(value) && value >= 0
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
const storageKeys = ['valid', 'bucketSafe', 'unknownSizeObjects', 'observedBytes', 'reservedBytes',
  'budgetBytes', 'reservationBytes', 'canAllocate', 'objectCount', 'unboundObjects',
  'missingVerifiedObjects', 'pendingSessions', 'cleanupEligibleSessions']
const queueKeys = ['submissions', 'comments', 'reports', 'urgentReports', 'appeals', 'oldestPendingAt', 'expiredModelLeases']

// Reject unknown fields so future upstream changes cannot leak private rows.
export function validOperations(value) {
  if (!exact(value, ['sampledAt', 'storage', 'queues']) || !date(value.sampledAt) ||
      !exact(value.storage, storageKeys) || !exact(value.queues, queueKeys)) return false
  const s = value.storage, q = value.queues
  if (!['valid', 'bucketSafe', 'canAllocate'].every(key => typeof s[key] === 'boolean') ||
      !['unknownSizeObjects', 'budgetBytes', 'reservationBytes', 'objectCount', 'unboundObjects',
        'missingVerifiedObjects', 'pendingSessions', 'cleanupEligibleSessions'].every(key => count(s[key])) ||
      !queueKeys.filter(key => key !== 'oldestPendingAt').every(key => count(q[key])) ||
      !(q.oldestPendingAt === null || date(q.oldestPendingAt))) return false
  const known = s.unknownSizeObjects === 0
  return (known ? count(s.observedBytes) && count(s.reservedBytes) : s.observedBytes === null && s.reservedBytes === null) &&
    s.valid === (s.bucketSafe && known) && s.budgetBytes === 786432000 && s.reservationBytes === 33554432 &&
    s.canAllocate === (s.valid && s.reservedBytes + s.reservationBytes <= s.budgetBytes)
}

export default { async fetch(request, fetcher = fetch) {
  const cors = privateCors(request, 'GET')
  if (cors.early) return cors.early
  const reply = (status, body) => cors.apply(response(status, body))
  if (request.method !== 'GET') return reply(405, { error: 'method_not_allowed' })
  const config = settings()
  if (!config) return reply(503, { error: 'operations_unavailable' })
  try {
    const authorization = request.headers.get('authorization')
    const uid = await uidFromToken(config, authorization, fetcher)
    if (!uid) return reply(401, { error: 'authentication_required' })
    if (!await reviewer(config, uid, authorization, fetcher)) return reply(403, { error: 'reviewer_second_factor_required' })
    const data = await adminJson(config, '/rest/v1/rpc/community_operations_snapshot', {
      method: 'POST', body: JSON.stringify({ p_actor: uid }),
    }, fetcher)
    if (!validOperations(data)) throw new Error('invalid_operations')
    return reply(200, { ...data, gateway: {
      acceptingSubmissions: process.env.COMMUNITY_ACCEPTING_SUBMISSIONS === '1',
      socialWritesPaused: process.env.COMMUNITY_SOCIAL_WRITES_PAUSED === '1',
    } })
  } catch { return reply(503, { error: 'operations_unavailable' }) }
} }
