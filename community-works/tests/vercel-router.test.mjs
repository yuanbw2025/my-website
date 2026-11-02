import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import router from '../../api/community.mjs'

test('the deployed entry loads as ESM without Node syntax detection', () => {
  const entry = new URL('../../api/community.mjs', import.meta.url).href
  const result = spawnSync(process.execPath, [
    '--no-experimental-detect-module', '--input-type=module', '-e',
    `const { default: router } = await import(${JSON.stringify(entry)});\n` +
      `const response = await router.fetch(new Request('https://site.example/api/community?route=unknown'));\n` +
      `if (response.status !== 404) throw new Error('route guard did not run');`,
  ], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
})

test('Vercel exposes one community function and preserves explicit route rewrites', () => {
  const entries = readdirSync(new URL('../../api/', import.meta.url)).filter(name => /\.[cm]?js$/.test(name))
  assert.deepEqual(entries, ['community.mjs'])
  const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'))
  for (const name of ['publication', 'publication-toc', 'publication-part', 'submission-status']) {
    assert(config.rewrites.some(row => row.destination.startsWith(`/api/community?route=${name}&`)))
  }
  assert(config.rewrites.some(row => row.source === '/api/community/v1/:route' &&
    row.destination === '/api/community?route=:route'))
})

test('unknown routes fail closed and known routes enter their handler', async () => {
  assert.equal((await router.fetch(new Request('https://site.example/api/community?route=unknown'))).status, 404)
  const response = await router.fetch(new Request('https://site.example/api/community?route=publications'))
  assert.equal(response.status, 503)
  assert.equal((await response.json()).error, 'catalog_unavailable')
})

test('embedded review is limited to the official management origin without weakening API authentication', () => {
  const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'))
  assert(config.rewrites.some(row => row.source === '/community-works/review/embed' && row.destination === '/community-works/index.html'))
  const headers = config.headers.find(row => row.source === '/community-works/:path*').headers
  assert.equal(headers.find(row => row.key === 'Content-Security-Policy').value,
    "frame-ancestors https://storyforge-lab.com; object-src 'none'; base-uri 'self'")
  assert.equal(headers.find(row => row.key === 'Referrer-Policy').value, 'no-referrer')
})
