import { test, expect, type Page } from '@playwright/test'
const slug = 'work-dddddddddddd4ddd8ddddddddddddddd'
const title = '《雨停之前的书店》拆书分析 | 格式示例 · 拆书分析'
const names = ['叙事风格', '人物塑造', '故事结构', '情节节奏', '对话写法', '场景描写', '主题表达', '视角运用', '伏笔回收', '冲突设计', '情绪曲线', '语言特色', '创作启发']
async function analysis(page: Page) {
  await page.route(`**/publications/${slug}`, route => route.fulfill({ json: {
    slug, kind: 'book-analysis', title, authorName: 'StoryForge 功能示例（AI 辅助）', language: 'zh-CN', updatedAt: '2026-11-04', description: '从叙事、人物与结构三个角度，阅读这篇书店故事。',
    toc: { kind: 'book-analysis', total: 13, hasAuthorCommentary: true, items: names.map((label, index) => ({ index, key: `dimension${index}`, label, selected: index < 3, entryCount: index < 3 ? 2 : 0 })) },
  } }))
  await page.route(`**/publications/${slug}/toc?**`, route => route.fulfill({ json: { kind: 'book-analysis', total: 2, items: [{ index: 0, label: '细节如何推动故事' }, { index: 1, label: '把选择留给人物' }] } }))
  await page.route(`**/publications/${slug}/part?**`, route => route.fulfill({ json: {
    text: `分析正文 ${new URL(route.request().url()).searchParams.get('section')}：故事从书店里的一盏灯开始，细节推动人物作出选择。\n人物并不急着解释自己，行动和对话共同留下线索。`,
    revisionId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', revisionHash: 'a'.repeat(64), hasMore: false,
  } }))
}
test('analysis starts with readable content, bounded directory and a compact full title', async ({ page }, info) => {
  await analysis(page)
  await page.goto(`/community-works/work/${slug}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
  await expect(page.locator('[data-block="0"]')).toContainText('分析正文 0')
  expect(await page.locator('h1').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeLessThanOrEqual(32)
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  const directory = await page.getByRole('navigation', { name: '分析目录', exact: true }).boundingBox()
  const content = await page.locator('.reader-main').boundingBox()
  if (info.project.name === 'desktop') {
    expect(directory!.x + directory!.width).toBeLessThan(content!.x)
    await expect(page.locator('[data-block="0"]')).toBeInViewport()
  } else {
    expect(directory!.height).toBeLessThan(120)
    expect(content!.y).toBeLessThan(550)
  }
  await page.screenshot({ path: info.outputPath('analysis-reader.png'), fullPage: false })
  if (info.project.name === 'mobile') await page.getByLabel('选择分析维度').selectOption('dimension1')
  else await page.getByRole('link', { name: '人物塑造 2 条', exact: true }).click()
  await expect(page.locator('[data-block="0"]')).toContainText('分析正文 1')
  await page.reload()
  if (info.project.name === 'mobile') await expect(page.getByLabel('选择分析维度')).toHaveValue('dimension1')
  else await expect(page.getByRole('link', { name: '人物塑造 2 条' })).toHaveAttribute('aria-current', 'location')
  await expect(page.locator('[data-block="0"]')).toContainText('分析正文 1')
  if (info.project.name === 'mobile') await page.getByLabel('选择分析维度').selectOption('dimension3')
  else await page.getByRole('link', { name: '情节节奏 未公开' }).click()
  await expect(page.getByText('作者未选择公开此维度。')).toBeVisible()
  await expect(page.locator('[data-block]')).toHaveCount(0)
  if (info.project.name === 'mobile') await page.getByLabel('选择分析维度').selectOption('author-commentary')
  else await page.getByRole('link', { name: '作者点评', exact: true }).click()
  await expect(page.locator('[data-block="0"]')).toContainText('分析正文 13')
})
test('saved analysis entry opens at its exact position and unavailable directory can retry', async ({ page }, info) => {
  await analysis(page)
  await page.goto(`/community-works/work/${slug}?section=2&entry=1&block=1`)
  if (info.project.name === 'mobile') await expect(page.getByLabel('选择分析维度')).toHaveValue('dimension2')
  else await expect(page.getByRole('link', { name: '故事结构 2 条' })).toHaveAttribute('aria-current', 'location')
  await expect(page.locator('details[open] summary')).toHaveText('把选择留给人物')
  await expect(page.locator('[data-block="1"]')).toBeInViewport()
  await page.route(`**/publications/${slug}/toc?**`, route => route.fulfill({ status: 503, json: {} }))
  await page.goto(`/community-works/work/${slug}`)
  await expect(page.getByRole('alert').filter({ hasText: '分析目录暂时无法读取' })).toBeVisible()
  await page.unroute(`**/publications/${slug}/toc?**`)
  await page.route(`**/publications/${slug}/toc?**`, route => route.fulfill({ json: { kind: 'book-analysis', total: 2, items: [{ index: 0, label: '恢复条目' }, { index: 1, label: '第二条目' }] } }))
  await page.getByRole('button', { name: '加载更多条目' }).click()
  await expect(page.locator('[data-block="0"]')).toContainText('分析正文 0')
})
test('novel shares compact layout with visible first paragraph and no horizontal overflow', async ({ page }, info) => {
  await page.goto(`/community-works/work/${slug}`)
  await expect(page.getByText('风穿过旧书店的窗户。', { exact: true })).toBeInViewport()
  await expect(page.getByRole('combobox', { name: '章节目录', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  await page.screenshot({ path: info.outputPath('novel-reader.png'), fullPage: false })
})

test('maximum length title stays complete at narrow widths and chapter navigation still changes content', async ({ page }) => {
  const longTitle = 'A'.repeat(300)
  await page.route(`**/publications/${slug}`, route => route.fulfill({ json: {
    slug, kind: 'novel', title: longTitle, authorName: '测试作者', language: 'zh-CN', updatedAt: '2026-11-04', description: '长标题排版测试',
    toc: { kind: 'novel', total: 2, items: [{ index: 0, title: '第一章' }, { index: 1, title: '第二章' }] },
  } }))
  await page.route(`**/publications/${slug}/part?**`, route => route.fulfill({ json: {
    text: `章节正文 ${new URL(route.request().url()).searchParams.get('section')}`, revisionId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', revisionHash: 'a'.repeat(64), hasMore: false,
  } }))
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto(`/community-works/work/${slug}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(longTitle)
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  await page.getByRole('combobox', { name: '章节目录' }).selectOption('1')
  await expect(page.locator('[data-block="0"]')).toHaveText('章节正文 1')
  await page.getByRole('button', { name: '← 上一章' }).click()
  await expect(page.locator('[data-block="0"]')).toHaveText('章节正文 0')
})
