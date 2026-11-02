import { readCatalog, response } from '../_lib/catalog.js'

export default {
  fetch(request) {
    if (request.method !== 'GET') return response(405, { error: 'method_not_allowed' })
    const url = new URL(request.url)
    return readCatalog({ kind: url.searchParams.get('kind') ?? undefined, q: url.searchParams.get('q') ?? undefined,
      offset: url.searchParams.get('offset') ?? '0' })
  },
}
