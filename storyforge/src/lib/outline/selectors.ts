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
