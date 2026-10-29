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

export async function readCatalog({ slug, kind, q } = {}, fetcher = fetch) {
  const settings = config()
  if (!settings) return response(503, { error: 'catalog_unavailable' })
  if (slug !== undefined && !/^[a-z0-9-]{1,100}$/.test(slug)) return response(400, { error: 'invalid_slug' })
  if (kind !== undefined && !['novel', 'book-analysis'].includes(kind)) return response(400, { error: 'invalid_kind' })
  if (q !== undefined && (typeof q !== 'string' || q.length > 100)) return response(400, { error: 'invalid_query' })

  const url = new URL('/rest/v1/community_publications', settings.base)
  url.searchParams.set('select', slug
    ? 'slug,kind,title,description,author_name,updated_at,language,body'
    : 'slug,kind,title,description,author_name,updated_at,language')
  // This filter is defense in depth. RLS is the actual read boundary.
  url.searchParams.set('status', 'eq.published')
  if (slug) url.searchParams.set('slug', `eq.${slug}`)
  if (kind) url.searchParams.set('kind', `eq.${kind}`)
  if (q?.trim()) url.searchParams.set('or', `(title.ilike.*${q.trim().replace(/[*,.()\\]/g, '')}*,author_name.ilike.*${q.trim().replace(/[*,.()\\]/g, '')}*)`)
  url.searchParams.set('limit', slug ? '1' : '50')
  if (!slug) url.searchParams.set('order', 'published_at.desc')

  let upstream
  try {
    upstream = await fetcher(url, { headers: { apikey: settings.key, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) })
  } catch {
    return response(503, { error: 'catalog_unavailable' })
  }
  if (!upstream.ok) return response(503, { error: 'catalog_unavailable' })
  let rows
  try { rows = await upstream.json() } catch { return response(502, { error: 'invalid_catalog_data' }) }
  if (!Array.isArray(rows) || rows.length > (slug ? 1 : 50)) return response(502, { error: 'invalid_catalog_data' })
  if (slug && rows.length === 0) return response(404, { error: 'work_not_found' })
  const cards = rows.map(cardFromRow)
  if (cards.some(card => !card)) return response(502, { error: 'invalid_catalog_data' })
  if (!slug) return response(200, { items: cards })
  const body = rows[0].body
  if (!body || typeof body !== 'object' || Array.isArray(body)) return response(502, { error: 'invalid_catalog_data' })
  return response(200, {
    ...cards[0],
    chapters: body.chapters,
    dimensions: body.dimensions,
    authorCommentary: body.authorCommentary,
  })
}
