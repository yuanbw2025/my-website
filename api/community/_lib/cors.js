import { response } from './catalog.js'

/** CORS is a browser boundary; every private route still verifies the user token. */
export function privateCors(request, methods) {
  const origin = request.headers.get('origin')
  const allowed = (process.env.COMMUNITY_ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean)
  if (origin && !allowed.includes(origin)) return { early: response(403, { error: 'origin_not_allowed' }) }
  const apply = result => {
    if (origin) {
      result.headers.set('Access-Control-Allow-Origin', origin)
      result.headers.set('Vary', 'Origin')
    }
    return result
  }
  if (request.method === 'OPTIONS') {
    const preflight = new Response(null, { status: 204 })
    if (origin) {
      preflight.headers.set('Access-Control-Allow-Origin', origin)
      preflight.headers.set('Access-Control-Allow-Methods', `${methods}, OPTIONS`)
      preflight.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type')
      preflight.headers.set('Vary', 'Origin')
    }
    return { early: preflight }
  }
  return { apply }
}
