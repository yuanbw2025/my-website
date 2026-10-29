import { readPart } from '../_lib/catalog.js'

export default {
  fetch(request) {
    const params = new URL(request.url).searchParams
    return readPart({
      slug: params.get('slug'), section: params.get('section'),
      entry: params.get('entry'), part: params.get('part'),
    })
  },
}
