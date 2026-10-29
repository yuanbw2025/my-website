/** Read small control payloads without trusting Content-Length or buffering an unbounded body. */
export async function boundedText(request, maxBytes) {
  if (Number(request.headers.get('content-length') ?? 0) > maxBytes || !request.body) return null
  const reader = request.body.getReader()
  const chunks = []
  let length = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      length += next.value.byteLength
      if (length > maxBytes) return null
      chunks.push(next.value)
    }
  } finally { await reader.cancel().catch(() => {}) }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { return null }
}
