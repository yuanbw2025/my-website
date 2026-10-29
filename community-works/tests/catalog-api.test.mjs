import test from 'node:test'
import assert from 'node:assert/strict'
import { readCatalog } from '../../api/community/_lib/catalog.js'

const row = {
  slug: 'approved-story', kind: 'novel', title: '公开作品', description: '简介',
  author_name: '作者', updated_at: '2026-10-29T00:00:00Z', language: 'zh-CN',
  body: { chapters: [{ title: '第一章', content: '正文' }], dimensions: [],
    authorCommentary: '', slug: 'private-override', rawPrompt: 'private' },
}

test('no configured backend fails closed', async () => {
  const before = process.env.COMMUNITY_SUPABASE_URL
  delete process.env.COMMUNITY_SUPABASE_URL
  const result = await readCatalog()
  assert.equal(result.status, 503)
  if (before !== undefined) process.env.COMMUNITY_SUPABASE_URL = before
})

test('catalog uses public key, published filter, and bounded output', async () => {
  process.env.COMMUNITY_SUPABASE_URL = 'https://example.supabase.co'
  process.env.COMMUNITY_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test'
  const result = await readCatalog({}, async (url, options) => {
    assert.equal(url.searchParams.get('status'), 'eq.published')
    assert.equal(url.searchParams.get('limit'), '50')
    assert.equal(options.headers.apikey, 'sb_publishable_test')
    assert.equal(options.headers.Authorization, undefined)
    return new Response(JSON.stringify([row]), { status: 200 })
  })
  assert.equal(result.status, 200)
  const data = await result.json()
  assert.equal(data.items.length, 1)
  assert.equal('body' in data.items[0], false)
})

test('detail cannot let body override approved catalog identity or leak extras', async () => {
  const result = await readCatalog({ slug: 'approved-story' }, async (url) => {
    assert.equal(url.searchParams.get('slug'), 'eq.approved-story')
    return new Response(JSON.stringify([row]), { status: 200 })
  })
  assert.equal(result.status, 200)
  const detail = await result.json()
  assert.equal(detail.slug, 'approved-story')
  assert.equal(detail.chapters[0].content, '正文')
  assert.equal('rawPrompt' in detail, false)
})

test('unpublished or missing detail is never returned from an empty public read', async () => {
  const result = await readCatalog({ slug: 'taken-down' }, async () => new Response('[]', { status: 200 }))
  assert.equal(result.status, 404)
  assert.equal((await result.json()).error, 'work_not_found')
})
