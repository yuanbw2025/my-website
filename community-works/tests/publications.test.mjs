import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCard, parseDetail, parseListPage } from '../src/publications.ts'

const card = {
  slug: 'first-story', kind: 'novel', title: '第一部小说', description: '简介',
  authorName: '作者', updatedAt: '2026-10-29T00:00:00Z', language: 'zh-CN',
}

test('valid approved cards are accepted without carrying extra private fields', () => {
  assert.deepEqual(parseCard({ ...card, ownerId: 'private-id' }), card)
  assert.deepEqual(parseListPage({ items: [card], nextOffset: null }, 0), { items: [card], nextOffset: null })
})

test('malformed list data fails closed instead of silently dropping rows', () => {
  assert.throws(() => parseListPage({ items: [card, { ...card, slug: '../private' }], nextOffset: null }, 0))
  assert.throws(() => parseListPage({ items: {} }, 0))
  assert.throws(() => parseListPage({ items: [card], nextOffset: 50 }, 0))
  assert.throws(() => parseListPage({ items: [card] }, 0))
  assert.equal(parseCard({ ...card, title: '<script>x</script>', slug: '../x' }), null)
})

test('novel detail requires chapters and excludes unknown private fields', () => {
  const detail = parseDetail({ ...card, toc: { kind: 'novel', total: 1,
    items: [{ index: 0, title: '第一章' }], hasAuthorCommentary: false }, rawPrompt: 'private' })
  assert.equal(detail?.chapters[0].title, '第一章')
  assert.equal('rawPrompt' in detail, false)
  assert.equal(parseDetail({ ...card, toc: { kind: 'novel', total: 1, items: [] } }), null)
})

test('book analysis detail requires exactly 13 safe dimensions', () => {
  const dimensions = Array.from({ length: 13 }, (_, index) => ({ index, key: `d${index}`, label: `维度 ${index}`,
    selected: index === 0, entryCount: index === 0 ? 1 : 0 }))
  const detail = parseDetail({ ...card, kind: 'book-analysis', toc: {
    kind: 'book-analysis', total: 13, items: dimensions, hasAuthorCommentary: true,
  } })
  assert.equal(detail?.dimensions.length, 13)
  assert.equal(parseDetail({ ...card, kind: 'book-analysis', toc: {
    kind: 'book-analysis', total: 12, items: dimensions.slice(1), hasAuthorCommentary: false,
  } }), null)
  assert.equal(parseDetail({ ...card, kind: 'book-analysis', toc: {
    kind: 'book-analysis', total: 13, items: dimensions.map((value, index) =>
      index === 1 ? { ...value, entryCount: 1 } : value), hasAuthorCommentary: false,
  } }), null)
})
