import { test, expect } from '@playwright/test'

const reviewer = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const factor = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
function session(aal: string) {
  const exp = Math.floor(Date.now() / 1000) + 3600
  const token = [Buffer.from('{"alg":"HS256"}').toString('base64url'),
    Buffer.from(JSON.stringify({ sub: reviewer, role: 'authenticated', aal, exp })).toString('base64url'),
    Buffer.from('fixture-signature').toString('base64url')].join('.')
  return { access_token: token, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600, expires_at: exp,
    user: { id: reviewer, aud: 'authenticated', role: 'authenticated', email: 'reviewer@example.invalid',
      created_at: new Date().toISOString(), factors: [{ id: factor, factor_type: 'totp', status: 'verified' }] } }
}
async function parent(page: import('@playwright/test').Page, origin: string) {
  // Serve only isolated fixture bytes under the real HTTPS child origin. An
  // HTTPS parent cannot reliably embed a private-network HTTP fixture.
  await page.route('https://yuanbw.vercel.app/**', async route => {
    const url = new URL(route.request().url())
    const response = await route.fetch({ url: `http://127.0.0.1:4187${url.pathname}${url.search}` })
    await route.fulfill({ response })
  })
  await page.route(`${origin}/manage/embedded-test`, route => route.fulfill({ contentType: 'text/html', body: `
    <!doctype html><title>Isolated management shell</title><iframe title="Review" sandbox="allow-scripts allow-same-origin allow-forms"
    src="https://yuanbw.vercel.app/community-works/review/embed" style="width:100%;height:900px"></iframe>
    <script>window.messages=[];const frame=document.querySelector('iframe');
    const connect=()=>frame.contentWindow.postMessage({type:'storyforge:review:connect',version:1},'https://yuanbw.vercel.app');
    frame.onload=connect;addEventListener('message',event=>{window.messages.push(event.data);if(event.data?.type==='storyforge:review:waiting')connect()});</script>` }))
  await page.goto(`${origin}/manage/embedded-test`)
  return page.frameLocator('iframe')
}

test('embedded reviewer logs in and uses MFA inside management without persistent or parent credentials', async ({ page }) => {
  const requests: string[] = []
  let current = session('aal1')
  await page.route('https://community-fixture.invalid/auth/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    requests.push(path)
    if (path.endsWith('/otp')) return route.fulfill({ json: {} })
    if (path.endsWith(`/factors/${factor}/challenge`)) return route.fulfill({ json: { id: 'challenge-fixture', expires_at: 9999999999 } })
    if (path.endsWith(`/factors/${factor}/verify`)) { current = session('aal2'); return route.fulfill({ json: current }) }
    if (path.endsWith('/verify')) return route.fulfill({ json: current })
    if (path.endsWith('/user')) return route.fulfill({ json: current.user })
    throw new Error(`unexpected fixture auth route ${path}`)
  })
  const frame = await parent(page, 'https://storyforge-lab.com')
  await expect(frame.getByRole('heading', { name: '登录社区账号' })).toBeVisible()
  await frame.getByLabel('邮箱', { exact: true }).fill('reviewer@example.invalid')
  await frame.getByRole('button', { name: '发送验证码' }).click()
  await frame.getByLabel('邮件中的验证码').fill('12345678')
  await frame.getByRole('button', { name: '验证并登录' }).click()
  await expect(frame.getByRole('heading', { name: '审核员二次验证' })).toBeVisible()
  await frame.getByLabel('动态验证码').fill('123456')
  await frame.getByRole('button', { name: '验证并进入审核台' }).click()
  await expect(frame.getByRole('heading', { name: '社区运行概览' })).toBeVisible()
  await expect(frame.getByRole('heading', { name: '模型审核与疑难待办' })).toBeVisible()
  const child = page.frames().find(f => f.url().endsWith('/review/embed'))!
  expect(await child.evaluate(() => localStorage.getItem('storyforge-community-works-auth-v1'))).toBeNull()
  expect(requests).toContain('/auth/v1/otp')
  expect(requests).toContain(`/auth/v1/factors/${factor}/verify`)
  const messages = await page.evaluate(() => (window as unknown as { messages: unknown[] }).messages)
  expect(messages).toContainEqual({ type: 'storyforge:review:ready', version: 1 })
  for (const message of messages) expect(Object.keys(message as object).sort()).toEqual(['type', 'version'])
  await page.reload()
  await expect(page.frameLocator('iframe').getByRole('heading', { name: '登录社区账号' })).toBeVisible()
})

test('untrusted parents and direct embed visits cannot start review authentication', async ({ page }) => {
  const frame = await parent(page, 'https://hostile.example')
  await expect(frame.getByRole('status')).toContainText('请从故事熔炉管理后台打开社区审核')
  await expect(frame.getByRole('heading', { name: '登录社区账号' })).toHaveCount(0)
  await page.goto('/community-works/review/embed')
  await expect(page.getByRole('status')).toContainText('请从故事熔炉管理后台打开社区审核')
})
