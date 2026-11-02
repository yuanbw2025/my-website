import test from 'node:test'
import assert from 'node:assert/strict'
import { validPublicSnapshotV1 } from '../supabase/functions/_shared/snapshot.ts'

const novel = {
  schemaVersion: 1, kind: 'novel', title: '测试小说', description: '简介', genres: ['奇幻'],
  chapters: [{ title: '第一章', content: '正文' }],
}
const keys = [
  'narrativeStyle', 'openingTechnique', 'plotStructure', 'pacingControl',
  'climaxDesign', 'conflictEscalation', 'characterCraft', 'dialogueTechnique',
  'proseStyle', 'emotionalBeats', 'foreshadowing', 'worldBuilding', 'otherTechniques',
]
const analysis = {
  schemaVersion: 1, kind: 'book-analysis',
  book: { title: '参考作品', author: '原作者', genre: '奇幻' },
  analysis: { version: 1, depth: 'quick' },
  dimensions: keys.map((key, index) => ({ key, selected: index === 0,
    entries: index === 0 ? [{ label: '段落', text: '叙事技法分析' }] : [] })),
  authorCommentary: '作者经验',
}

test('the two selected public snapshot shapes pass the server validator', () => {
  assert.equal(validPublicSnapshotV1(novel), true)
  assert.equal(validPublicSnapshotV1(analysis), true)
})

test('unselected or extra private data never enters a submission', () => {
  assert.equal(validPublicSnapshotV1({ ...novel, chapters: [] }), false)
  assert.equal(validPublicSnapshotV1({ ...novel, localProjectId: 42 }), false)
  assert.equal(validPublicSnapshotV1({ ...analysis, rawExcerpt: 'copyrighted source' }), false)
  assert.equal(validPublicSnapshotV1({ ...analysis, dimensions: analysis.dimensions.map((value, index) =>
    index === 1 ? { ...value, entries: [{ label: 'hidden', text: 'raw source' }] } : value) }), false)
})

test('dimension order and explicit selected content cannot be forged', () => {
  assert.equal(validPublicSnapshotV1({ ...analysis, dimensions: [...analysis.dimensions].reverse() }), false)
  assert.equal(validPublicSnapshotV1({ ...analysis, dimensions: analysis.dimensions.map(value =>
    ({ ...value, selected: false, entries: [] })) }), false)
})
