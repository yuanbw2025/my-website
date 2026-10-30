import { readCatalog, response } from '../_lib/catalog.js'

export default {
  fetch(request) {
    if (request.method !== 'GET') return response(405, { error: 'method_not_allowed' })
    const slug = new URL(request.url).searchParams.get('slug')
    if (!slug) return response(400, { error: 'invalid_slug' })
    return readCatalog({ slug })
  },
}
