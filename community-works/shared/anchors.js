/** Protocol v1: NFC, CRLF/CR -> LF, nonempty newline-delimited blocks.
 * Offsets count Unicode code points, never UTF-16 units or DOM pixels. */
export function readingBlocks(text) {
  return text.replace(/\r\n?/g, '\n').normalize('NFC').split(/\n+/).filter(value => value.length > 0)
}

export function anchorShape(anchor) {
  if (!anchor || typeof anchor !== 'object' || Array.isArray(anchor)) return false
  const integer = (n, max) => Number.isSafeInteger(n) && n >= 0 && n <= max
  if (anchor.version !== 1 || !['section', 'paragraph', 'selection'].includes(anchor.kind) ||
    !/^[0-9a-f-]{36}$/.test(anchor.revisionId ?? '') || !/^[0-9a-f]{64}$/.test(anchor.revisionHash ?? '') ||
    !integer(anchor.section, 10000000) || !integer(anchor.entry, 10000000)) return false
  const common = ['version','kind','revisionId','revisionHash','section','entry']
  if (anchor.kind === 'section') return Object.keys(anchor).every(key => common.includes(key))
  return integer(anchor.block, 10000000) && /^[0-9a-f]{64}$/.test(anchor.blockHash ?? '') &&
    integer(anchor.start, 33554432) && integer(anchor.end, 33554432) && anchor.end > anchor.start &&
    anchor.end - anchor.start <= 500 && typeof anchor.quote === 'string' && Array.from(anchor.quote).length === anchor.end - anchor.start &&
    Object.keys(anchor).every(key => [...common,'block','blockHash','start','end','quote'].includes(key))
}

export async function validateAnchor(anchor, text, revisionId, revisionHash, hash) {
  if (!anchorShape(anchor) || anchor.revisionId !== revisionId || anchor.revisionHash !== revisionHash) return false
  if (anchor.kind === 'section') return true
  const block = readingBlocks(text)[anchor.block]
  if (block === undefined || await hash(block) !== anchor.blockHash) return false
  const chars = Array.from(block)
  if (anchor.kind === 'paragraph' && (anchor.start !== 0 || anchor.end !== Math.min(chars.length, 500))) return false
  return anchor.end <= chars.length && chars.slice(anchor.start, anchor.end).join('') === anchor.quote
}
