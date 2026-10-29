import { readTocPage } from '../_lib/catalog.js'

export default {
  fetch(request) {
    const params = new URL(request.url).searchParams
    return readTocPage({
      slug: params.get('slug'), section: params.get('section'),
      offset: params.get('offset'), limit: params.get('limit'),
    })
  },
}
