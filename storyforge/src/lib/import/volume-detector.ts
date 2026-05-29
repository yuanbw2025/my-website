/**
 * Phase 28.4 — 本地卷/章结构检测
 *
 * 纯正则扫描全文，识别卷标题和章标题，
 * 返回层级结构供导入流水线创建正确的 volume → chapter 大纲。
 */

/** 检测到的标题 */
export interface DetectedHeading {
  type: 'volume' | 'chapter'
  title: string
  /** 在原文中的字符偏移 */
  offset: number
  /** 原始匹配的行文本 */
  raw: string
}

/** 检测到的卷结构 */
export interface DetectedVolume {
  title: string
  /** 卷下的章节标题列表 */
  chapters: { title: string; offset: number }[]
  offset: number
}

/** 检测结果 */
export interface VolumeDetectResult {
  /** 是否检测到分卷结构 */
  hasVolumes: boolean
  /** 卷结构（如果有卷标题） */
  volumes: DetectedVolume[]
  /** 无卷归属的章节（卷标题之前的章节，或无卷时全部章节） */
  orphanChapters: { title: string; offset: number }[]
  /** 总章节数 */
  totalChapters: number
  /** 总卷数 */
  totalVolumes: number
}

// ── 正则定义 ──────────────────────────────────────────────────

/** 中文数字映射 */
const CN_NUM = '一二三四五六七八九十百千万零〇两'
const NUM_PATTERN = `[${CN_NUM}\\d０-９]+`

/**
 * 卷标题正则：匹配行首的卷标识
 * 支持格式：
 *  - 第一卷 xxx / 第1卷 xxx
 *  - 卷一 xxx / 卷1 xxx
 *  - 【第一卷】xxx
 *  - 第一部 xxx / 第一篇 xxx
 */
const VOLUME_REGEX = new RegExp(
  `^[\\s　]*(?:` +
    `第\\s*${NUM_PATTERN}\\s*[卷部篇]` +    // 第X卷 / 第X部 / 第X篇
    `|[卷部篇]\\s*${NUM_PATTERN}` +          // 卷X / 部X / 篇X
    `|【第\\s*${NUM_PATTERN}\\s*[卷部篇]】` + // 【第X卷】
  `)[\\s　：:·—\\-]*[^\\n]{0,40}$`,
  'gm'
)

/**
 * 章标题正则：匹配行首的章/回/节标识
 * 支持格式：
 *  - 第一章 xxx / 第1章 xxx
 *  - 第一回 xxx / 第一节 xxx
 *  - 【第一章】xxx
 *  - Chapter 1: xxx
 */
const CHAPTER_REGEX = new RegExp(
  `^[\\s　]*(?:` +
    `第\\s*${NUM_PATTERN}\\s*[章回节]` +      // 第X章 / 第X回 / 第X节
    `|[章回节]\\s*${NUM_PATTERN}` +            // 章X / 回X
    `|【第\\s*${NUM_PATTERN}\\s*[章回节]】` +  // 【第X章】
    `|[Cc]hapter\\s*\\d+` +                    // Chapter 1
  `)[\\s　：:·—\\-]*[^\\n]{0,60}$`,
  'gm'
)

// ── 检测函数 ──────────────────────────────────────────────────

/**
 * 扫描全文，识别卷标题和章标题，返回层级结构
 */
export function detectVolumeStructure(text: string): VolumeDetectResult {
  const headings: DetectedHeading[] = []

  // 1. 扫描卷标题
  VOLUME_REGEX.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = VOLUME_REGEX.exec(text)) !== null) {
    headings.push({
      type: 'volume',
      title: m[0].trim(),
      offset: m.index,
      raw: m[0],
    })
    if (m.index === VOLUME_REGEX.lastIndex) VOLUME_REGEX.lastIndex++
  }

  // 2. 扫描章标题
  CHAPTER_REGEX.lastIndex = 0
  while ((m = CHAPTER_REGEX.exec(text)) !== null) {
    // 排除已被卷正则匹配的位置（避免"第一卷"被同时当作卷和章）
    const isVolume = headings.some(h => h.type === 'volume' && h.offset === m!.index)
    if (!isVolume) {
      headings.push({
        type: 'chapter',
        title: m[0].trim(),
        offset: m.index,
        raw: m[0],
      })
    }
    if (m.index === CHAPTER_REGEX.lastIndex) CHAPTER_REGEX.lastIndex++
  }

  // 3. 按偏移排序
  headings.sort((a, b) => a.offset - b.offset)

  // 4. 构建层级结构
  const volumes: DetectedVolume[] = []
  const orphanChapters: { title: string; offset: number }[] = []
  let currentVolume: DetectedVolume | null = null

  for (const h of headings) {
    if (h.type === 'volume') {
      currentVolume = { title: h.title, chapters: [], offset: h.offset }
      volumes.push(currentVolume)
    } else {
      if (currentVolume) {
        currentVolume.chapters.push({ title: h.title, offset: h.offset })
      } else {
        orphanChapters.push({ title: h.title, offset: h.offset })
      }
    }
  }

  const totalChapters = headings.filter(h => h.type === 'chapter').length

  return {
    hasVolumes: volumes.length > 0,
    volumes,
    orphanChapters,
    totalChapters,
    totalVolumes: volumes.length,
  }
}

/**
 * 根据检测结果生成大纲节点树（用于直接写入 DB）
 * 仅包含标题和层级，不含摘要（摘要由 AI 填充）
 */
export function buildOutlineFromDetection(
  result: VolumeDetectResult,
): Array<{ type: 'volume' | 'chapter'; title: string; summary: string; children?: Array<{ type: 'chapter'; title: string; summary: string }> }> {
  const nodes: Array<{ type: 'volume' | 'chapter'; title: string; summary: string; children?: Array<{ type: 'chapter'; title: string; summary: string }> }> = []

  // 先放无卷归属的章节
  for (const ch of result.orphanChapters) {
    nodes.push({ type: 'chapter', title: ch.title, summary: '' })
  }

  // 再放卷结构
  for (const vol of result.volumes) {
    const children = vol.chapters.map(ch => ({
      type: 'chapter' as const,
      title: ch.title,
      summary: '',
    }))
    nodes.push({
      type: 'volume',
      title: vol.title,
      summary: '',
      children,
    })
  }

  return nodes
}
