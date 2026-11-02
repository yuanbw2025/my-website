/** Storage may report a missing unfinished TUS object as HTTP 400 with a 404 code.
 * Do not turn permission, signature or service failures into a resumable state. */
export function isMissingUploadObject(status: number, body: unknown): boolean {
  if (status === 404) return true
  if (status !== 400 || !body || typeof body !== 'object' || Array.isArray(body)) return false
  const error = body as Record<string, unknown>
  return String(error.statusCode) === '404' && error.code === 'NoSuchKey' && error.error === 'not_found'
}
