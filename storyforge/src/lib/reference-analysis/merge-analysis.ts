/**
 * Phase 28.1 — 分析结果去重、合并与结构化
 *
 * 本地计算，不需要 AI：
 * - 按维度合并：每个维度聚合所有 chunk 的分析，去重后按 chunk 顺序排列
 * - 角色维度特殊处理：从 characterCraft 中提取角色名，按角色合并
 * - 每条保留 chunk 来源标注
 */

import type { ReferenceChunkAnalysis, AnalysisDimension } from '../types/reference'
import { ANALYSIS_DIMENSIONS, DIMENSION_LABELS } from '../types/reference'

/** 单条合并后的分析条目 */
export interface MergedAnalysisItem {
  /** 分析文本 */
  text: string
  /** 来源 chunk 标注（如"块 1 · 第 1-3 章"） */
  sourceLabel: string
  /** chunk 序号 */
  chunkIndex: number
}

/** 某个维度的合并结果 */
export interface MergedDimension {
  dimension: AnalysisDimension
  label: string
  items: MergedAnalysisItem[]
  /** 该维度的精炼摘要（可选，28.3 AI 总结后填入） */
  summary?: string
}

/** 角色合并卡片 */
export interface MergedCharacterCard {
  /** 角色名 */
  name: string
  /** 所有出处的合并分析 */
  analyses: MergedAnalysisItem[]
}

/** 全书合并结果 */
export interface MergedAnalysisResult {
  /** 按维度合并的分析 */
  dimensions: MergedDimension[]
  /** 角色合并卡片（从 characterCraft 中提取） */
  characters: MergedCharacterCard[]
  /** 总块数 */
  totalChunks: number
}

/**
 * 文本相似度（Jaccard on character 2-gram）
 * 返回 0~1，越大越相似
 */
function textSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  const ngram = (s: string) => {
    const set = new Set<string>()
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2))
    return set
  }
  const sa = ngram(a)
  const sb = ngram(b)
  let inter = 0
  for (const g of sa) if (sb.has(g)) inter++
  const union = sa.size + sb.size - inter
  return union === 0 ? 0 : inter / union
}

/**
 * 从分析文本中提取角色名候选
 * 简单策略：提取「」内的对话发起者、或"XXX"的出现
 */
function extractCharacterNames(texts: string[]): string[] {
  const nameSet = new Map<string, number>()
  const patterns = [
    /(?:主角|主人公|角色|人物)[「"《]([^」"》]{1,8})[」"》]/g,
    /[「""]([^」""]{1,6})[」""](?:是|的|在|有|说|道|笑|怒|哭)/g,
    /(?:^|\n)(?:角色|人物)(?:：|:)\s*(.+?)(?:\n|$)/g,
  ]

  for (const text of texts) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0
      let m
      while ((m = pattern.exec(text)) !== null) {
        const name = m[1].trim()
        if (name.length >= 2 && name.length <= 8) {
          nameSet.set(name, (nameSet.get(name) || 0) + 1)
        }
      }
    }
  }

  // 出现 2+ 次的才算
  return [...nameSet.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
}

/**
 * 核心：合并分析结果
 */
export function mergeAnalysisResults(
  chunks: ReferenceChunkAnalysis[],
  isHistorical: boolean,
): MergedAnalysisResult {
  const sorted = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex)
  const totalChunks = sorted.length

  // 根据是否历史资料过滤维度
  const histDims = new Set<AnalysisDimension>([
    'historicalContext', 'socialInstitutions', 'dailyLife', 'materialCulture', 'languageCustoms',
  ])
  const visibleDimensions = ANALYSIS_DIMENSIONS.filter(dim => {
    if (isHistorical) return true // 历史资料展示所有维度
    return !histDims.has(dim) // 普通小说不展示历史维度
  })

  const dimensions: MergedDimension[] = []

  for (const dim of visibleDimensions) {
    const items: MergedAnalysisItem[] = []
    const seen: string[] = [] // 已收录文本的前 60 字，用于去重

    for (const chunk of sorted) {
      const raw = chunk[dim]
      if (!raw || typeof raw !== 'string') continue
      const text = raw.trim()
      if (!text || text === '本块未涉及') continue

      // 去重：与已有条目的相似度超过 0.6 则跳过
      const prefix = text.slice(0, 60)
      const isDup = seen.some(s => textSimilarity(s, prefix) > 0.6)
      if (isDup) continue

      seen.push(prefix)
      items.push({
        text,
        sourceLabel: chunk.label
          ? `块 ${chunk.chunkIndex + 1} · ${chunk.label}`
          : `块 ${chunk.chunkIndex + 1}`,
        chunkIndex: chunk.chunkIndex,
      })
    }

    dimensions.push({
      dimension: dim,
      label: DIMENSION_LABELS[dim],
      items,
    })
  }

  // 角色合并：从 characterCraft 维度提取
  const characterTexts = sorted
    .map(c => c.characterCraft)
    .filter((t): t is string => !!t && t !== '本块未涉及')

  const characterNames = extractCharacterNames(characterTexts)
  const characters: MergedCharacterCard[] = []

  for (const name of characterNames.slice(0, 20)) { // 最多 20 个角色
    const analyses: MergedAnalysisItem[] = []
    for (const chunk of sorted) {
      const text = chunk.characterCraft
      if (!text || !text.includes(name)) continue
      // 提取包含该角色名的句子/段落
      const sentences = text.split(/[。！？\n]/).filter(s => s.includes(name))
      if (sentences.length === 0) continue
      const merged = sentences.join('。') + '。'
      analyses.push({
        text: merged,
        sourceLabel: chunk.label
          ? `块 ${chunk.chunkIndex + 1} · ${chunk.label}`
          : `块 ${chunk.chunkIndex + 1}`,
        chunkIndex: chunk.chunkIndex,
      })
    }
    if (analyses.length > 0) {
      characters.push({ name, analyses })
    }
  }

  return { dimensions, characters, totalChunks }
}

/**
 * 生成 AI 全书总结的 prompt
 */
export function buildSummaryPrompt(
  title: string,
  author: string,
  merged: MergedAnalysisResult,
  isHistorical: boolean,
): { system: string; user: string } {
  // 把每个维度的前 3 条拼成概述
  const dimSummaries = merged.dimensions
    .filter(d => d.items.length > 0)
    .map(d => {
      const samples = d.items.slice(0, 3).map(i => i.text.slice(0, 200)).join('\n')
      return `【${d.label}】\n${samples}`
    })
    .join('\n\n')

  const system = isHistorical
    ? `你是一位历史文献分析专家。请根据以下分块分析的汇总，为这部历史资料撰写一份精炼的全书总结。每个维度 100-200 字，重点提炼可直接用于小说创作的时代细节和考证要点。输出纯 JSON。`
    : `你是一位资深文学评论家。请根据以下分块分析的汇总，为这部小说撰写一份精炼的全书总结。每个维度 100-200 字，重点提炼最核心的创作方法论和值得学习的技巧。输出纯 JSON。`

  const dimKeys = merged.dimensions.filter(d => d.items.length > 0).map(d => d.dimension)

  const user = `作品：「${title}」 作者：${author || '未知'}

以下是各维度的分块分析汇总：

${dimSummaries}

请为以上每个维度输出一段 100-200 字的精炼总结，格式为 JSON：
{
${dimKeys.map(k => `  "${k}": "（该维度的全书总结）"`).join(',\n')}
}`

  return { system, user }
}
