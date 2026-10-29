const outputHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
}

export function response(status, value) {
  return new Response(JSON.stringify(value), { status, headers: outputHeaders })
}

function config() {
  const base = process.env.COMMUNITY_SUPABASE_URL
  const key = process.env.COMMUNITY_SUPABASE_PUBLISHABLE_KEY
  if (!base || !key) return null
  try {
    const url = new URL(base)
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null
    return { base: url, key }
  } catch {
    return null
  }
}

function boundedInteger(value, maximum) {
  return typeof value === 'string' && /^(0|[1-9]\d{0,7})$/.test(value) &&
    Number(value) <= maximum ? Number(value) : null
}

async function rpc(path, args, fetcher) {
  const settings = config()
  if (!settings) return response(503, { error: 'catalog_unavailable' })
  try {
    const upstream = await fetcher(new URL(`/rest/v1/rpc/${path}`, settings.base), {
      method: 'POST',
      headers: { apikey: settings.key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(args), signal: AbortSignal.timeout(8000),
    })
    if (!upstream.ok) return response(503, { error: 'catalog_unavailable' })
    const body = await upstream.json()
    if (body === null) return response(404, { error: 'work_not_found' })
    return response(200, body)
  } catch { return response(503, { error: 'catalog_unavailable' }) }
}

export async function readTocPage({ slug, section, offset, limit }, fetcher = fetch) {
  if (!/^[a-z0-9-]{1,100}$/.test(slug ?? '')) return response(400, { error: 'invalid_slug' })
  const sectionIndex = section === '-1' ? -1 : boundedInteger(section, 12)
  const start = boundedInteger(offset, 10000000)
  const pageSize = boundedInteger(limit, 100)
  if (sectionIndex === null || start === null || pageSize === null || pageSize < 1) {
    return response(400, { error: 'invalid_page' })
  }
  return rpc('community_read_toc_page', {
    p_slug: slug, p_section_index: sectionIndex, p_offset: start, p_limit: pageSize,
  }, fetcher)
}

export async function readPart({ slug, section, entry, part }, fetcher = fetch) {
  if (!/^[a-z0-9-]{1,100}$/.test(slug ?? '')) return response(400, { error: 'invalid_slug' })
  const sectionIndex = boundedInteger(section, 10000000)
  const entryIndex = boundedInteger(entry, 10000000)
  const partIndex = boundedInteger(part, 1000)
  if (sectionIndex === null || entryIndex === null || partIndex === null) {
    return response(400, { error: 'invalid_part' })
  }
  const result = await rpc('community_read_part', {
    p_slug: slug, p_section_index: sectionIndex,
    p_entry_index: entryIndex, p_part_index: partIndex,
  }, fetcher)
  if (result.status !== 200) return result
  let body
  try { body = await result.json() } catch { return response(502, { error: 'invalid_part_data' }) }
  if (!body || typeof body.text !== 'string' || body.text.length > 1000000 ||
      typeof body.hasMore !== 'boolean') return response(502, { error: 'invalid_part_data' })
  return response(200, body)
}

function safeText(value, limit) {
  return typeof value === 'string' && value.length <= limit
}

function cardFromRow(row) {
  if (!row || typeof row !== 'object' || !/^[a-z0-9-]{1,100}$/.test(row.slug ?? '') ||
      !['novel', 'book-analysis'].includes(row.kind) || !safeText(row.title, 300) ||
      !safeText(row.description, 4000) || !safeText(row.author_name, 120) ||
      !safeText(row.updated_at, 50) || !safeText(row.language, 30)) return null
  return {
    slug: row.slug,
    kind: row.kind,
    title: row.title,
    description: row.description,
    authorName: row.author_name,
    updatedAt: row.updated_at,
    language: row.language,
  }
}

export async function readCatalog({ slug, kind, q, offset = '0' } = {}, fetcher = fetch) {
  const settings = config()
  if (!settings) return response(503, { error: 'catalog_unavailable' })
  if (slug !== undefined && !/^[a-z0-9-]{1,100}$/.test(slug)) return response(400, { error: 'invalid_slug' })
  if (kind !== undefined && !['novel', 'book-analysis'].includes(kind)) return response(400, { error: 'invalid_kind' })
  if (q !== undefined && (typeof q !== 'string' || q.length > 100)) return response(400, { error: 'invalid_query' })
  const start = slug ? 0 : boundedInteger(offset, 10000000)
  if (start === null) return response(400, { error: 'invalid_page' })

  const url = new URL('/rest/v1/community_publications', settings.base)
  url.searchParams.set('select', 'slug,kind,title,description,author_name,updated_at,language')
  // This filter is defense in depth. RLS is the actual read boundary.
  url.searchParams.set('status', 'eq.published')
  if (slug) url.searchParams.set('slug', `eq.${slug}`)
  if (kind) url.searchParams.set('kind', `eq.${kind}`)
  if (q?.trim()) url.searchParams.set('or', `(title.ilike.*${q.trim().replace(/[*,.()\\]/g, '')}*,author_name.ilike.*${q.trim().replace(/[*,.()\\]/g, '')}*)`)
  url.searchParams.set('limit', slug ? '1' : '51')
  if (!slug) {
    url.searchParams.set('offset', String(start))
    url.searchParams.set('order', 'published_at.desc,id.desc')
  }

  let upstream
  try {
    upstream = await fetcher(url, { headers: { apikey: settings.key, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) })
  } catch {
    return response(503, { error: 'catalog_unavailable' })
  }
  if (!upstream.ok) return response(503, { error: 'catalog_unavailable' })
  let rows
  try { rows = await upstream.json() } catch { return response(502, { error: 'invalid_catalog_data' }) }
  if (!Array.isArray(rows) || rows.length > (slug ? 1 : 51)) return response(502, { error: 'invalid_catalog_data' })
  if (slug && rows.length === 0) return response(404, { error: 'work_not_found' })
  const cards = rows.map(cardFromRow)
  if (cards.some(card => !card)) return response(502, { error: 'invalid_catalog_data' })
  if (!slug) return response(200, { items: cards.slice(0, 50), nextOffset: rows.length === 51 ? start + 50 : null })
  const tocResponse = await readTocPage({ slug, section: '-1', offset: '0', limit: '100' }, fetcher)
  if (tocResponse.status !== 200) return response(503, { error: 'catalog_unavailable' })
  let toc
  try { toc = await tocResponse.json() } catch { return response(502, { error: 'invalid_catalog_data' }) }
  if (!toc || toc.kind !== cards[0].kind || !Number.isSafeInteger(toc.total) ||
      toc.total < 1 || !Array.isArray(toc.items) || toc.items.length > 100 ||
      toc.items.length !== Math.min(toc.total, 100)) {
    return response(502, { error: 'invalid_catalog_data' })
  }
  return response(200, { ...cards[0], toc })
}
