import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import router from '../../api/community.js'

test('Vercel exposes one community function and preserves explicit route rewrites', () => {
  const entries = readdirSync(new URL('../../api/', import.meta.url)).filter(name => /\.[cm]?js$/.test(name))
  assert.deepEqual(entries, ['community.js'])
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
