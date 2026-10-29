import { createUploadSession } from '../_lib/intake.js'
import { response } from '../_lib/catalog.js'

export default {
  async fetch(request) {
    const origin = request.headers.get('origin')
    const allowed = (process.env.COMMUNITY_ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean)
    if (origin && !allowed.includes(origin)) return response(403, { error: 'origin_not_allowed' })
    if (request.method === 'OPTIONS') {
      const preflight = new Response(null, { status: 204 })
      if (origin) {
        preflight.headers.set('Access-Control-Allow-Origin', origin)
        preflight.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
        preflight.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        preflight.headers.set('Vary', 'Origin')
      }
      return preflight
    }
    const result = await createUploadSession(request)
    if (origin) {
      result.headers.set('Access-Control-Allow-Origin', origin)
      result.headers.set('Vary', 'Origin')
    }
    return result
  },
}
