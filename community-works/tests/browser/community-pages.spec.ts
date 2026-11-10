import { test, expect, type Page } from '@playwright/test'
const base = '/community-works'
async function login(page: Page) {
  const id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  const payload = { sub: id, aud: 'authenticated', role: 'authenticated', aal: 'aal1', exp: Math.floor(Date.now() / 1000) + 3600 }
  const token = [Buffer.from('{"alg":"HS256"}').toString('base64url'), Buffer.from(JSON.stringify(payload)).toString('base64url'), 'fixture'].join('.')
  await page.addInitScript(session => localStorage.setItem('storyforge-community-works-auth-v1', JSON.stringify(session)), {
    access_token: token, refresh_token: 'fixture-refresh', expires_at: payload.exp, expires_in: 3600, token_type: 'bearer',
    user: { id, aud: 'authenticated', role: 'authenticated', email: 'fixture@example.invalid', created_at: new Date().toISOString() },
  })
}
async function compact(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  expect(await page.locator('h1').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeLessThanOrEqual(28)
}
test.beforeEach(async ({ request }) => { await request.get('/__fixture/reset') })

test('catalog starts with filters and works; filtering, paging, empty and error states remain usable', async ({ page }, info) => {
  const card = (index: number) => ({ slug: `work-${index}`, kind: 'novel', title: `书店故事 ${index}`, description: '隔离排版测试：在灯亮起的书店里，寻找未完的故事。', authorName: '测试作者', updatedAt: '2026-11-04', language: 'zh-CN' })
  let fail = false
  await page.route('**/api/community/v1/publications?**', route => {
    const q = new URL(route.request().url()).searchParams
    const start = Number(q.get('offset'))
    if (fail) return route.fulfill({ status: 503, json: {} })
    const items = q.has('kind') || q.get('q') === '不存在' ? [] : q.has('q') ? [card(1)] : start ? [card(50)] : Array.from({ length: 50 }, (_, i) => card(i))
    return route.fulfill({ json: { items, nextOffset: items.length === 50 ? 50 : null } })
  })
  await page.goto(`${base}/`)
  await expect(page.getByRole('heading', { name: '书店故事 0', exact: true })).toBeInViewport()
  await expect(page.getByLabel('搜索作品')).toBeInViewport()
  await compact(page)
  await page.screenshot({ path: info.outputPath('community-home.png') })
  await page.getByRole('button', { name: '加载更多作品' }).click()
  await expect(page.locator('.work-card')).toHaveCount(51)
  await page.getByRole('button', { name: '拆书分析', exact: true }).click()
  await expect(page.getByText('还没有符合条件的公开作品')).toBeVisible()
  await expect(page.locator('.work-card')).toHaveCount(0)
  await page.getByRole('button', { name: '全部作品' }).click()
  await page.getByLabel('搜索作品').fill('书店')
  await expect(page.locator('.work-card')).toHaveCount(1)
  fail = true
  await page.getByLabel('搜索作品').fill('读取失败')
  await expect(page.getByRole('alert')).toContainText('暂时无法读取作品集')
  await expect(page.locator('.work-card')).toHaveCount(0)
})

test('reading workspace uses shelf columns and compact notices, retains navigation and tab states', async ({ page }, info) => {
  await login(page)
  await page.route('**/api/community/v1/social?**', route => {
    const scope = new URL(route.request().url()).searchParams.get('scope')
    if (scope === 'wallet') return route.fulfill({ json: { balance: 3, claimed: false, items: [] } })
    const items = scope === 'shelf' ? Array.from({ length: 6 }, (_, i) => ({ workId: `work-${i}`, title: `旧书店的灯 · ${i + 1}`, slug: `work-${i}`, resumeSlug: `work-${i}`, following: true, updated: i === 0, section: 0, entry: 0, block: 1 })) : scope === 'notifications' ? [
      { id: 'notice-1', kind: 'reply', title: '旧书店的灯', slug: 'work-0', commentId: null, quantity: 1, readAt: null, createdAt: '2026-11-04T00:00:00Z', submissionId: null, reviewStatus: null },
    ] : []
    return route.fulfill({ json: { items } })
  })
  await page.goto(`${base}/library`)
  await expect(page.getByRole('heading', { name: '旧书店的灯 · 1' })).toBeInViewport()
  await compact(page)
  if (info.project.name === 'desktop') {
    const a = await page.locator('.shelf-card').nth(0).boundingBox()
    const b = await page.locator('.shelf-card').nth(1).boundingBox()
    expect(a!.y).toBe(b!.y)
  }
  await expect(page.getByRole('link', { name: '继续上次阅读' }).first()).toHaveAttribute('href', /section=0&entry=0&block=1/)
  await page.screenshot({ path: info.outputPath('reading-space.png') })
  await page.getByRole('button', { name: '站内消息', exact: true }).click()
  await expect(page.getByRole('heading', { name: '有人回复了你的评论' })).toBeInViewport()
  await page.screenshot({ path: info.outputPath('reading-notifications.png') })
  await page.getByRole('button', { name: '我的花篮', exact: true }).click()
  await expect(page.getByRole('button', { name: '领取今日鲜花' })).toBeInViewport()
  await page.getByRole('button', { name: '屏蔽管理' }).click()
  await expect(page.getByText('暂时没有屏蔽记录。')).toBeVisible()
  await expect(page.getByRole('link', { name: '阅读空间', exact: true })).toHaveAttribute('aria-current', 'page')
})

test('submissions expose status and actions, preserve exact revision and hide stale data after errors', async ({ page }, info) => {
  await login(page)
  let failure = false
  let withdrawn = false
  const first = { id: 'fixture-1', kind: 'novel', status: 'published', sha256: 'a'.repeat(64), created_at: '2026-11-04T00:00:00Z', updated_at: '2026-11-04T00:00:00Z' }
  await page.route('**/api/community/v1/my-submissions', route => failure ? route.fulfill({ status: 503, json: {} }) : route.fulfill({ json: { items: [{ ...first, status: withdrawn ? 'withdrawn' : 'published' }, { ...first, id: 'fixture-2', kind: 'book-analysis', status: 'rejected' }] } }))
  await page.route('**/api/community/v1/appeals', route => route.fulfill({ json: { items: [] } }))
  await page.goto(`${base}/me`)
  await expect(page.getByText('已公开', { exact: true })).toBeInViewport()
  await expect(page.getByRole('button', { name: '撤回投稿' }).first()).toBeInViewport()
  await compact(page)
  await page.screenshot({ path: info.outputPath('my-submissions.png') })
  await page.getByText('投稿编号与更新时间').first().click()
  await expect(page.getByText('fixture-1', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '提出申诉' }).click()
  await page.getByLabel('申诉理由').fill('请结合上下文复核。')
  await expect(page.getByRole('button', { name: '提交申诉' })).toBeEnabled()
  await page.route('**/api/community/v1/submission-action', async route => {
    expect(route.request().postDataJSON()).toEqual({ submissionId: 'fixture-1', revisionSha256: 'a'.repeat(64), action: 'withdraw' })
    withdrawn = true
    await route.fulfill({ json: { status: 'withdrawn' } })
  })
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: '撤回投稿' }).first().click()
  await expect(page.getByText('已撤回', { exact: true })).toBeVisible()
  failure = true
  await page.getByRole('button', { name: '刷新记录' }).click()
  await expect(page.getByRole('alert')).toContainText('投稿记录暂时无法读取')
  await expect(page.locator('.submission-card')).toHaveCount(0)
  failure = false
  await page.getByRole('button', { name: '刷新记录' }).click()
  await expect(page.locator('.submission-card')).toHaveCount(2)
})

test('guest login and rules stay readable at 320px without oversized headings or overflow', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 740 })
  for (const path of ['/me', '/library']) {
    await page.goto(`${base}${path}`)
    await expect(page.getByRole('heading', { name: '登录社区账号' })).toBeInViewport()
    await expect(page.getByRole('button', { name: '发送验证码' })).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  }
  await page.screenshot({ path: info.outputPath('login-narrow.png') })
  await page.goto(`${base}/policy`)
  await compact(page)
  await expect(page.getByRole('heading', { name: '可以分享什么' })).toBeInViewport()
  await page.screenshot({ path: info.outputPath('policy-narrow.png') })
})
