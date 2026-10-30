import { AwsClient } from 'aws4fetch'

const objectPath = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/snapshot\.json$/

export function r2Config() {
  const accountId = process.env.COMMUNITY_R2_ACCOUNT_ID
  const bucket = process.env.COMMUNITY_R2_BUCKET
  const accessKeyId = process.env.COMMUNITY_R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.COMMUNITY_R2_SECRET_ACCESS_KEY
  if (!/^[0-9a-f]{32}$/.test(accountId ?? '') ||
      !/^[a-z0-9][a-z0-9-]{1,62}$/.test(bucket ?? '') ||
      !accessKeyId || !secretAccessKey) return null
  return { origin: `https://${accountId}.r2.cloudflarestorage.com`, bucket,
    client: new AwsClient({ service: 's3', region: 'auto', accessKeyId, secretAccessKey }) }
}

export function r2ObjectUrl(config, path) {
  if (!objectPath.test(path)) throw new Error('invalid_object_path')
  return new URL(`/${config.bucket}/${path}`, config.origin)
}

/** The URL authorizes one PUT of one allocated object; the bytes never enter Vercel. */
export async function signR2Put(config, path) {
  const url = r2ObjectUrl(config, path)
  url.searchParams.set('X-Amz-Expires', '900')
  const signed = await config.client.sign(new Request(url, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
  }), { aws: { signQuery: true, allHeaders: true } })
  const result = new URL(signed.url)
  if (result.origin !== config.origin || result.pathname !== url.pathname ||
      !result.searchParams.has('X-Amz-Signature') ||
      !result.searchParams.get('X-Amz-SignedHeaders')?.split(';').includes('content-type')) {
    throw new Error('r2_signing_failed')
  }
  return result.toString()
}

export async function deleteR2Object(config, path) {
  const result = await config.client.fetch(r2ObjectUrl(config, path), {
    method: 'DELETE', signal: AbortSignal.timeout(10000),
  })
  if (!result.ok && result.status !== 404) throw new Error('r2_delete_failed')
}
