const ALLOWED_TAGS = new Set([
  'a', 'blockquote', 'br', 'code', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'hr', 'img', 'li', 'mark', 'ol', 'p', 'pre', 's', 'span', 'strong', 'sub', 'sup',
  'table', 'tbody', 'td', 'th', 'thead', 'tr', 'u', 'ul',
])

const GLOBAL_ATTRS = new Set(['class', 'title'])
const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
  img: new Set(['src', 'alt', 'title']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan']),
}

function isSafeUrl(value: string): boolean {
  const normalized = value.trim().replace(/[\u0000-\u001F\u007F\s]+/g, '').toLowerCase()
  if (!normalized) return true
  if (normalized.startsWith('#')) return true
  if (normalized.startsWith('/')) return true
  if (normalized.startsWith('http://') || normalized.startsWith('https://') || normalized.startsWith('mailto:')) return true
  if (normalized.startsWith('data:image/')) return !normalized.includes('svg+xml')
  return false
}

function stripDangerousFallback(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<(iframe|object|embed|link|meta|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(iframe|object|embed|link|meta|style)\b[^>]*\/?>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/\s+(href|src|xlink:href)\s*=\s*"([^"]*)"/gi, (m, _attr, value) => isSafeUrl(value) ? m : '')
    .replace(/\s+(href|src|xlink:href)\s*=\s*'([^']*)'/gi, (m, _attr, value) => isSafeUrl(value) ? m : '')
    .replace(/\s+(href|src|xlink:href)\s*=\s*([^\s>]+)/gi, (m, _attr, value) => isSafeUrl(value) ? m : '')
}

/** Export sanitizer for user-authored chapter HTML. */
export function sanitizeExportHtml(html: string): string {
  if (!html || !html.trim()) return ''
  if (typeof document === 'undefined') return stripDangerousFallback(html)

  const template = document.createElement('template')
  template.innerHTML = html

  const cleanNode = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType !== Node.ELEMENT_NODE) {
        if (child.nodeType === Node.COMMENT_NODE) child.remove()
        continue
      }

      const el = child as Element
      const tag = el.tagName.toLowerCase()
      if (!ALLOWED_TAGS.has(tag)) {
        el.replaceWith(...Array.from(el.childNodes))
        continue
      }

      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase()
        const allowed = GLOBAL_ATTRS.has(name) || TAG_ATTRS[tag]?.has(name)
        const value = attr.value
        if (!allowed || name.startsWith('on')) {
          el.removeAttribute(attr.name)
          continue
        }
        if ((name === 'href' || name === 'src') && !isSafeUrl(value)) {
          el.removeAttribute(attr.name)
          continue
        }
        if (name === 'target' && value === '_blank' && tag === 'a') {
          el.setAttribute('rel', 'noopener noreferrer')
        }
      }

      cleanNode(el)
    }
  }

  cleanNode(template.content)
  return template.innerHTML
}
