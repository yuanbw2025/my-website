import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readCatalog, readPart, readTocPage } from '../server/_lib/catalog.js'

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
    assert.equal(url.searchParams.get('limit'), '51')
    assert.equal(url.searchParams.get('offset'), '0')
    assert.equal(url.searchParams.get('order'), 'published_at.desc,id.desc')
    assert.equal(options.headers.apikey, 'sb_publishable_test')
    assert.equal(options.headers.Authorization, undefined)
    return new Response(JSON.stringify([row]), { status: 200 })
  })
  assert.equal(result.status, 200)
  const data = await result.json()
  assert.equal(data.items.length, 1)
  assert.equal(data.nextOffset, null)
  assert.equal('body' in data.items[0], false)
})

test('catalog pages past fifty published works without exposing an unbounded response', async () => {
  process.env.COMMUNITY_SUPABASE_URL = 'https://example.supabase.co'
  process.env.COMMUNITY_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test'
  const rows = Array.from({ length: 51 }, (_, index) => ({ ...row, slug: `story-${index}` }))
  const first = await readCatalog({}, async url => {
    assert.equal(url.searchParams.get('offset'), '0')
    assert.equal(url.searchParams.get('limit'), '51')
    return Response.json(rows)
  })
  assert.equal(first.status, 200)
  const firstPage = await first.json()
  assert.equal(firstPage.items.length, 50)
  assert.equal(firstPage.nextOffset, 50)
  assert.equal(firstPage.items.some(item => item.slug === 'story-50'), false)
  const second = await readCatalog({ offset: '50' }, async url => {
    assert.equal(url.searchParams.get('offset'), '50')
    return Response.json([rows[50]])
  })
  const secondPage = await second.json()
  assert.equal(secondPage.items[0].slug, 'story-50')
  assert.equal(secondPage.nextOffset, null)
  assert.equal((await readCatalog({ offset: '-1' })).status, 400)
  assert.equal((await readCatalog({ offset: '10000001' })).status, 400)
})

test('detail cannot let body override approved catalog identity or leak extras', async () => {
  const result = await readCatalog({ slug: 'approved-story' }, async (url, options) => {
    if (url.pathname.endsWith('/rpc/community_read_toc_page')) {
      assert.equal(options.headers.Authorization, undefined)
      return new Response(JSON.stringify({ kind: 'novel', total: 1,
        items: [{ index: 0, title: '第一章' }], hasAuthorCommentary: false }), { status: 200 })
    }
    assert.equal(url.searchParams.get('slug'), 'eq.approved-story')
    assert.equal(url.searchParams.get('select')?.includes('body'), false)
    return new Response(JSON.stringify([row]), { status: 200 })
  })
  assert.equal(result.status, 200)
  const detail = await result.json()
  assert.equal(detail.slug, 'approved-story')
  assert.equal(detail.toc.items[0].title, '第一章')
  assert.equal('rawPrompt' in detail, false)
})

test('public text is read only after the published RLS lookup and private Storage hash check', async () => {
  process.env.COMMUNITY_SUPABASE_SECRET_KEY = 'sb_secret_test'
  const content = `${'甲'.repeat(250000)}第二段`
  const bytes = Buffer.from(JSON.stringify({ kind: 'novel', chapters: [{ content }] }))
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const id = '11111111-1111-4111-8111-111111111111'
  const objectPath = `${id}/22222222-2222-4222-8222-222222222222/snapshot.json`
  const calls = []
  const result = await readPart({ slug: 'approved-story', section: '0', entry: '0', part: '1' },
    async (url, options) => {
      if (url.pathname === '/rest/v1/rpc/community_read_part') {
        calls.push('rls')
        assert.equal(options.headers.Authorization, undefined)
        assert.equal(JSON.parse(options.body).p_part_index, 1)
        return Response.json({ objectPath, sha256, kind: 'novel' })
      }
      calls.push('storage')
      assert.equal(url.pathname, `/storage/v1/object/authenticated/community-intake/${objectPath}`)
      assert.equal(options.headers.apikey, 'sb_secret_test')
      return new Response(bytes)
    })
  assert.equal(result.status, 200)
  assert.equal((await result.json()).text, '第二段')
  assert.deepEqual(calls, ['rls', 'storage'])
  assert.equal((await readPart({ slug: 'approved-story', section: '0', entry: '0', part: '1001' })).status, 400)
  assert.equal((await readTocPage({ slug: 'approved-story', section: '-1', offset: '0', limit: '101' })).status, 400)
})

test('taken-down RLS result never reaches private Storage', async () => {
  const result = await readPart({ slug: 'taken-down', section: '0', entry: '0', part: '0' },
    async url => {
      assert.equal(url.pathname, '/rest/v1/rpc/community_read_part')
      return Response.json(null)
    })
  assert.equal(result.status, 404)
})

test('a changed published object is never served as approved text', async () => {
  process.env.COMMUNITY_SUPABASE_SECRET_KEY = 'sb_secret_test'
  const hash = 'a'.repeat(64)
  const objectPath = '11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/snapshot.json'
  const result = await readPart({ slug: 'approved-story', section: '0', entry: '0', part: '0' },
    async url => url.pathname === '/rest/v1/rpc/community_read_part'
      ? Response.json({ objectPath, sha256: hash, kind: 'novel' })
      : new Response(JSON.stringify({ kind: 'novel', chapters: [{ content: 'altered' }] })))
  assert.equal(result.status, 503)
  assert.equal((await result.json()).error, 'catalog_unavailable')
})

test('unpublished or missing detail is never returned from an empty public read', async () => {
  const result = await readCatalog({ slug: 'taken-down' }, async () => new Response('[]', { status: 200 }))
  assert.equal(result.status, 404)
  assert.equal((await result.json()).error, 'work_not_found')
})
