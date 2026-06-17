/**
 * R-chapter-count-estimate · 章节数按卷字数自动估算（社区反馈：长卷被压成 ~20 章）
 *
 * 根因:章节数控制是可选项、默认不开 → 走 prompt 兜底「约 15-25 章」→ 200 万字大纲被压成
 * 一条主线 20 章。修复:选中卷展开章节时按「项目目标字数 ÷ 卷数 ÷ 每章 3000 字」自动估算。
 */
import { describe, it, expect } from 'vitest'
import { estimateChaptersPerVolume, WORDS_PER_CHAPTER } from '../../src/lib/outline/selectors'

describe('R-chapter-count-estimate · 章节数按卷字数估算', () => {
  it('200 万字 / 5 卷 → 每卷约 133 章（不再是 20）', () => {
    // 200万 / 5卷 = 40万/卷 ÷ 3000 ≈ 133
    expect(estimateChaptersPerVolume(2_000_000, 5)).toBe(Math.round(400_000 / WORDS_PER_CHAPTER))
    expect(estimateChaptersPerVolume(2_000_000, 5)).toBeGreaterThan(100)
  })

  it('短篇 3 万字 / 1 卷 → clamp 到下限 5（不会出 0/负）', () => {
    // 3万 / 3000 = 10
    expect(estimateChaptersPerVolume(30_000, 1)).toBe(10)
    // 极短 → clamp 到 5
    expect(estimateChaptersPerVolume(6_000, 1)).toBe(5)
  })

  it('超长 1000 万字 / 2 卷 → clamp 到上限 200', () => {
    expect(estimateChaptersPerVolume(10_000_000, 2)).toBe(200)
  })

  it('字数缺失 / 卷数为 0 时有合理兜底，不抛错', () => {
    expect(estimateChaptersPerVolume(0, 0)).toBeGreaterThanOrEqual(5)
    expect(estimateChaptersPerVolume(0, 0)).toBeLessThanOrEqual(200)
  })
})
