import { AwsClient } from 'npm:aws4fetch@1.0.20'

export function privateR2() {
  const accountId = Deno.env.get('COMMUNITY_R2_ACCOUNT_ID')
  const bucket = Deno.env.get('COMMUNITY_R2_BUCKET')
  const accessKeyId = Deno.env.get('COMMUNITY_R2_READ_ACCESS_KEY_ID')
  const secretAccessKey = Deno.env.get('COMMUNITY_R2_READ_SECRET_ACCESS_KEY')
  if (!/^[0-9a-f]{32}$/.test(accountId ?? '') ||
      !/^[a-z0-9][a-z0-9-]{1,62}$/.test(bucket ?? '') ||
      !accessKeyId || !secretAccessKey) return null
  return { origin: `https://${accountId}.r2.cloudflarestorage.com`, bucket,
    client: new AwsClient({ service: 's3', region: 'auto', accessKeyId, secretAccessKey }) }
}

export function r2ObjectUrl(config: NonNullable<ReturnType<typeof privateR2>>, path: string): URL {
  if (!/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/){2}snapshot\.json$/.test(path)) {
    throw new Error('invalid_object_path')
  }
  return new URL(`/${config.bucket}/${path}`, config.origin)
}

export async function signedR2Get(config: NonNullable<ReturnType<typeof privateR2>>, path: string): Promise<string> {
  const url = r2ObjectUrl(config, path)
  url.searchParams.set('X-Amz-Expires', '60')
  const signed = await config.client.sign(new Request(url), { aws: { signQuery: true } })
  const result = new URL(signed.url)
  if (result.origin !== config.origin || result.pathname !== url.pathname ||
      !result.searchParams.has('X-Amz-Signature')) throw new Error('r2_signing_failed')
  return result.toString()
}
