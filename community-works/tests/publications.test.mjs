import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCard, parseDetail, parseList } from '../src/publications.ts'

const card = {
  slug: 'first-story', kind: 'novel', title: '第一部小说', description: '简介',
  authorName: '作者', updatedAt: '2026-10-29T00:00:00Z', language: 'zh-CN',
}

test('valid approved cards are accepted without carrying extra private fields', () => {
  assert.deepEqual(parseCard({ ...card, ownerId: 'private-id' }), card)
  assert.deepEqual(parseList({ items: [card] }), [card])
})

test('malformed list data fails closed instead of silently dropping rows', () => {
  assert.throws(() => parseList({ items: [card, { ...card, slug: '../private' }] }))
  assert.throws(() => parseList({ items: {} }))
  assert.equal(parseCard({ ...card, title: '<script>x</script>', slug: '../x' }), null)
})

test('novel detail requires chapters and excludes unknown private fields', () => {
  const detail = parseDetail({ ...card, chapters: [{ title: '第一章', content: '正文' }],
    dimensions: [], authorCommentary: '', rawPrompt: 'private' })
  assert.equal(detail?.chapters[0].content, '正文')
  assert.equal('rawPrompt' in detail, false)
  assert.equal(parseDetail({ ...card, chapters: [], dimensions: [], authorCommentary: '' }), null)
})

test('book analysis detail requires exactly 13 safe dimensions', () => {
  const dimensions = Array.from({ length: 13 }, (_, index) => ({ key: `d${index}`, label: `维度 ${index}`,
    selected: index === 0, entries: index === 0 ? [{ label: '条目', text: '分析' }] : [] }))
  const detail = parseDetail({ ...card, kind: 'book-analysis', chapters: [], dimensions,
    authorCommentary: '我的经验' })
  assert.equal(detail?.dimensions.length, 13)
  assert.equal(parseDetail({ ...card, kind: 'book-analysis', chapters: [], dimensions: dimensions.slice(1),
    authorCommentary: '' }), null)
  assert.equal(parseDetail({ ...card, kind: 'book-analysis', chapters: [], dimensions: dimensions.map((value, index) =>
    index === 1 ? { ...value, entries: [{ label: '泄漏', text: '正文' }] } : value), authorCommentary: '' }), null)
})
