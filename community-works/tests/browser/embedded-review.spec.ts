import { test, expect, type Page } from '@playwright/test'

async function parent(page: Page, origin: string, badNonce = false) {
  await page.request.get('/__fixture/reset')
  await page.route('https://yuanbw.vercel.app/**', async route => {
    const url = new URL(route.request().url())
    const response = await route.fetch({ url: `http://127.0.0.1:4187${url.pathname}${url.search}` })
    await route.fulfill({ response })
  })
  await page.route(`${origin}/manage/embedded-test`, route => route.fulfill({ contentType: 'text/html', body: `
    <!doctype html><title>Isolated management shell</title><iframe title="Review" sandbox="allow-scripts allow-same-origin allow-forms"
    src="https://yuanbw.vercel.app/community-works/review/embed" style="width:100%;height:900px"></iframe>
    <script>window.messages=[];const frame=document.querySelector('iframe');
    const connect=()=>frame.contentWindow.postMessage({type:'storyforge:review:connect',version:2},'https://yuanbw.vercel.app');
    frame.onload=connect;addEventListener('message',event=>{window.messages.push(event.data);
      if(event.data?.type==='storyforge:review:waiting')connect();
      if(event.data?.type==='storyforge:review:authorize')frame.contentWindow.postMessage({type:'storyforge:review:grant',version:2,
        token:'sfmgmt_'+'f'.repeat(43),expiresAt:Date.now()+120000,nonce:${badNonce ? 'crypto.randomUUID()' : 'event.data.nonce'}},'https://yuanbw.vercel.app');
    });</script>` }))
  await page.goto(`${origin}/manage/embedded-test`)
  return page.frameLocator('iframe')
}

test('management login opens review without email or TOTP and automatically reconnects on refresh', async ({ page }) => {
  const authRequests: string[] = []
  page.on('request', r => { if(r.url().includes('/auth/v1/')) authRequests.push(r.url()) })
  const frame = await parent(page, 'https://storyforge-lab.com')
  await expect(frame.getByRole('heading', { name: '社区运行概览' })).toBeVisible()
  await expect(frame.getByRole('heading', { name: '模型审核与疑难待办' })).toBeVisible()
  await expect(frame.getByLabel('邮箱', { exact: true })).toHaveCount(0)
  await expect(frame.getByLabel('动态验证码')).toHaveCount(0)
  const child = page.frames().find(f => f.url().endsWith('/review/embed'))!
  expect(await child.evaluate(() => localStorage.getItem('storyforge-community-works-auth-v1'))).toBeNull()
  expect(authRequests).toEqual([])
  const messages = await page.evaluate(() => (window as unknown as { messages: Record<string,unknown>[] }).messages)
  expect(messages).toContainEqual({ type: 'storyforge:review:ready', version: 2 })
  expect(messages.every(m => !Object.keys(m).some(k => ['token','password','email','manuscript'].includes(k)))).toBe(true)
  await page.reload()
  await expect(page.frameLocator('iframe').getByRole('heading', { name: '社区运行概览' })).toBeVisible()
  // Revoking the management authority denies subsequent service reads.
  await page.request.get('/__fixture/management-revoke')
  await page.frameLocator('iframe').getByRole('button', { name: '刷新运行状态' }).click()
  await expect(page.frameLocator('iframe').getByRole('region', { name: '社区运行概览' })).toContainText('未知')
  await page.evaluate(() => document.querySelector('iframe')!.contentWindow!.postMessage({type:'storyforge:review:revoked',version:2},'https://yuanbw.vercel.app'))
  await expect(page.frameLocator('iframe').getByRole('heading', { name: '作品审核' })).toHaveCount(0)
  await expect(page.frameLocator('iframe').getByRole('status')).toContainText('授权已失效')
})

test('untrusted parents, wrong handshake nonces and direct embed visits cannot authenticate', async ({ page }) => {
  const frame = await parent(page, 'https://hostile.example')
  await expect(frame.getByRole('status')).toContainText('请从故事熔炉管理后台打开社区审核')
  await expect(frame.getByRole('heading', { name: '作品审核' })).toHaveCount(0)
  const trusted = await parent(page, 'https://storyforge-lab.com', true)
  await expect(trusted.getByRole('status')).toContainText('正在使用管理后台身份连接审核')
  await expect(trusted.getByRole('heading', { name: '作品审核' })).toHaveCount(0)
  await page.goto('/community-works/review/embed')
  await expect(page.getByRole('status')).toContainText('请从故事熔炉管理后台打开社区审核')
})
