import type { OutlineNode } from '../types'

type OutlineLike = Pick<OutlineNode, 'type'> & { parentId?: number | null }

export function isTopLevelVolumeNode(node: OutlineLike): boolean {
  return node.type === 'volume' && node.parentId == null
}

export function getTopLevelVolumes(nodes: OutlineNode[]): OutlineNode[] {
  return nodes
    .filter(isTopLevelVolumeNode)
    .sort((a, b) => a.order - b.order)
}

/** 网文常见每章字数(用于按目标字数估算章节数) */
export const WORDS_PER_CHAPTER = 3000

/**
 * 按「项目目标字数 ÷ 卷数 ÷ 每章字数」估算单卷合理章节数，clamp 到滑块范围 [5,200]。
 * 修复「长卷被压成 ~20 章」：默认走估算值，而非 prompt 兜底的 15-25 章。
 */
export function estimateChaptersPerVolume(totalWordCount: number, volumeCount: number): number {
  const total = totalWordCount > 0 ? totalWordCount : 500000
  const vols = Math.max(1, volumeCount || Math.ceil(total / 300000))
  const perVolumeWords = total / vols
  const chapters = Math.round(perVolumeWords / WORDS_PER_CHAPTER)
  return Math.min(200, Math.max(5, chapters))
}
