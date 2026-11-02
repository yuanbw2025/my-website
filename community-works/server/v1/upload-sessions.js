import { createUploadSession } from '../_lib/intake.js'
import { privateCors } from '../_lib/cors.js'

export default {
  async fetch(request) {
    const cors = privateCors(request, 'POST')
    if (cors.early) return cors.early
    return cors.apply(await createUploadSession(request))
  },
}
