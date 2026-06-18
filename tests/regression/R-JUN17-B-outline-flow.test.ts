import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/lib/db/schema'
import {
  buildSingleChapterOutlinePrompt,
  buildVolumeOutlinePrompt,
} from '../../src/lib/ai/adapters/outline-adapter'
import { assembleContext } from '../../src/lib/registry/assemble-context'
import { CONTEXT_SOURCE_BY_KEY } from '../../src/lib/registry/context-sources'
import { adopt } from '../../src/lib/registry/adopt'

describe('R-JUN17-B · 大纲生成流程', () => {
  beforeEach(async () => { await db.delete(); await db.open() })
  afterEach(() => db.close())

  it('B-1/B-2: 建议总卷数强约束生效，且已有卷只续接不重复', () => {
    const messages = buildVolumeOutlinePrompt(
      '长篇测试',
      '玄幻',
      '【世界观】九州',
      '【故事核心】主角统一九州',
      2_000_000,
      '',
      { parameterValues: { volumeCount: 20 } },
      '',
      '',
      {
        existingVolumeCount: 2,
        existingVolumesContext: '【已有卷大纲】\n1. 第一卷：入世\n2. 第二卷：风起',
      },
    )
    const full = messages.map(message => message.content).join('\n')
    expect(full).toContain('最终总卷数：严格为 20 卷')
    expect(full).toContain('当前已有 2 卷')
    expect(full).toContain('只生成后续缺少的 18 卷')
    expect(full).toContain('禁止改写、复述或重新生成已有卷')
  })

  it('B-1: 未启用建议卷数时由故事设定合理规划，不回退固定 2 卷', () => {
    const messages = buildVolumeOutlinePrompt(
      '自由规划',
      '悬疑',
      '【世界观】封闭海岛',
      '【故事核心】连环谜案',
      500_000,
      '',
      { parameterValues: {} },
    )
    const full = messages.map(message => message.content).join('\n')
    expect(full).toContain('不预设固定卷数')
    expect(full).toContain('不得套用固定 2 卷或其他固定值')
    expect(full).not.toContain('建议卷数：约 2 卷')
  })

  it('B-4: 单章补全只输出目标章节，不重建整卷', () => {
    const messages = buildSingleChapterOutlinePrompt(
      '第一卷',
      '主角加入宗门',
      '第3章：夜探藏经阁',
      '同级已有章节：第1章、第2章',
      '【世界观】修真宗门',
      '',
    )
    const full = messages.map(message => message.content).join('\n')
    expect(full).toContain('只补全现有空章节《第3章：夜探藏经阁》')
    expect(full).toContain('只输出 1 个 JSON 元素')
    expect(full).toContain('不得生成其他章节')
  })

  it('B-2: existingVolumeOutlines 经 CONTEXT_SOURCES/assembleContext 读取', async () => {
    expect(CONTEXT_SOURCE_BY_KEY.has('existingVolumeOutlines')).toBe(true)
    const now = Date.now()
    const projectId = await db.projects.add({
      name: '上下文测试', genre: '', description: '', targetWordCount: 500_000,
      enableMultiWorld: false, createdAt: now, updatedAt: now,
    } as any) as number
    await db.outlineNodes.bulkAdd([
      { projectId, parentId: null, type: 'volume', title: '第一卷', summary: '主角出山', order: 0, createdAt: now, updatedAt: now },
      { projectId, parentId: null, type: 'volume', title: '第二卷', summary: '宗门大战', order: 1, createdAt: now, updatedAt: now },
    ] as any)
    const result = await assembleContext({ projectId, sourceKeys: ['existingVolumeOutlines'] })
    expect(result.included).toContain('existingVolumeOutlines')
    expect(result.text).toContain('第一卷')
    expect(result.text).toContain('宗门大战')
    expect(result.text).toContain('禁止重复')
  })

  it('B-3/B-4: adopt(recordId) 只更新当前项目中的目标大纲节点', async () => {
    const now = Date.now()
    const projectId = await db.projects.add({
      name: '定点采纳', genre: '', description: '', targetWordCount: 0,
      enableMultiWorld: false, createdAt: now, updatedAt: now,
    } as any) as number
    const nodeId = await db.outlineNodes.add({
      projectId, parentId: null, type: 'volume', title: '第三卷', summary: '', order: 2,
      createdAt: now, updatedAt: now,
    } as any) as number
    const result = await adopt({
      projectId,
      target: 'outlineNodes',
      recordId: nodeId,
      mode: 'replace',
      data: { summary: 'AI 补全后的卷纲' },
    })
    expect(result.written).toHaveLength(1)
    expect((await db.outlineNodes.get(nodeId))?.summary).toBe('AI 补全后的卷纲')

    const rejected = await adopt({
      projectId: projectId + 999,
      target: 'outlineNodes',
      recordId: nodeId,
      mode: 'replace',
      data: { summary: '不应写入' },
    })
    expect(rejected.written).toHaveLength(0)
    expect((await db.outlineNodes.get(nodeId))?.summary).toBe('AI 补全后的卷纲')
  })
})
