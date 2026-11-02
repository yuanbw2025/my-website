import { test, expect } from '@playwright/test'
const slug='work-dddddddddddd4ddd8ddddddddddddddd'
const uid='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
async function login(page: import('@playwright/test').Page,id=uid,aal='aal1') {
  const payload={sub:id,aud:'authenticated',role:'authenticated',aal,exp:Math.floor(Date.now()/1000)+3600}
  const token=[Buffer.from('{"alg":"HS256"}').toString('base64url'),Buffer.from(JSON.stringify(payload)).toString('base64url'),Buffer.from('fixture-signature').toString('base64url')].join('.')
  await page.addInitScript(session=>localStorage.setItem('storyforge-community-works-auth-v1',JSON.stringify(session)),{
    access_token:token,refresh_token:'fixture-refresh',expires_at:payload.exp,expires_in:3600,token_type:'bearer',
    user:{id,aud:'authenticated',role:'authenticated',email:'fixture@example.invalid',created_at:new Date().toISOString()},
  })
}
test.beforeEach(async({request})=>{await request.get('/__fixture/reset')})

test('guest reads freely; likes, private bookshelf and exact resume position work after login',async({page})=>{
  await page.goto(`/community-works/work/${slug}`)
  await expect(page.getByText('风穿过旧书店的窗户。',{exact:true})).toBeVisible()
  await page.getByRole('button',{name:'♡ 点赞 · 0'}).click()
  await expect(page.getByRole('heading',{name:'登录社区账号'})).toBeVisible()
  await login(page);await page.reload()
  await page.getByRole('button',{name:'♡ 点赞 · 0'}).click()
  await expect(page.getByRole('button',{name:'♥ 已点赞 · 1'})).toBeVisible()
  await page.getByRole('button',{name:'收藏到书架'}).click()
  await expect(page.getByRole('button',{name:'已收藏 · 移出书架'})).toBeVisible()
  await page.getByRole('button',{name:'记住第 2 段阅读位置',exact:true}).click()
  await expect(page.getByText('阅读位置已保存，书架可继续阅读。')).toBeVisible()
  await page.getByRole('link',{name:'阅读空间',exact:true}).click()
  await expect(page.getByRole('heading',{name:'旧书店的灯'})).toBeVisible()
  await page.getByRole('link',{name:'继续上次阅读'}).click()
  await expect(page).toHaveURL(/block=1/)
  await expect(page.locator('[data-block="1"]')).toBeInViewport()
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)
  expect(overflow).toBe(false)
})

test('lost gift response can be retried without spending twice',async({page},testInfo)=>{
  await login(page);await page.goto(`/community-works/work/${slug}`)
  await page.getByRole('button',{name:'✿ 送花 · 0'}).click()
  await page.getByRole('button',{name:'领取今日鲜花'}).click()
  await expect(page.getByText('领取成功，3 朵鲜花已入花篮。')).toBeVisible()
  await page.route('**/api/community/v1/social',async route=>{
    if(route.request().method()==='POST'&&route.request().postDataJSON()?.action==='gift') {
      await route.fetch();await route.abort('failed');await page.unroute('**/api/community/v1/social')
    } else await route.continue()
  })
  await page.getByRole('button',{name:'送给这部作品'}).click()
  await expect(page.getByRole('button',{name:'确认这笔操作的结果'})).toBeVisible()
  await page.getByRole('button',{name:'确认这笔操作的结果'}).click()
  await expect(page.getByRole('button',{name:'✿ 送花 · 1'})).toBeVisible()
  await expect(page.getByRole('heading',{name:'我的花篮 2 朵'})).toBeVisible()
  await page.screenshot({path:testInfo.outputPath('reader-social.png'),fullPage:true})
})

test('private messages link to approved discussions and a blocked reader can be unblocked',async({page,request})=>{
  await login(page,owner);await page.goto(`/community-works/work/${slug}`)
  await page.getByRole('button',{name:'发表评论',exact:true}).click()
  await page.getByLabel('公开昵称').fill('作者笔名');await page.getByLabel('评论内容').fill('欢迎大家讨论。')
  await page.getByRole('button',{name:'提交审核',exact:true}).click()
  await expect(page.getByText('已提交，审核通过后会公开并通知对方。')).toBeVisible()
  await request.get('/__fixture/approve')
  await login(page);await page.reload()
  await page.getByRole('button',{name:'回复',exact:true}).click()
  await page.locator('.comment-card').getByLabel('公开昵称').fill('读者')
  await page.getByLabel('回复内容').fill('喜欢这个开头。')
  await page.getByRole('button',{name:'提交审核',exact:true}).click()
  await expect(page.getByText('已提交，审核通过后会公开并通知对方。')).toBeVisible()
  await request.get('/__fixture/approve')
  await login(page,owner);await page.goto('/community-works/library')
  await page.getByRole('button',{name:'站内消息',exact:true}).click()
  await expect(page.getByRole('heading',{name:'有人回复了你的评论'})).toBeVisible()
  await page.getByRole('button',{name:'标为已读',exact:true}).click()
  await expect(page.getByText('已读',{exact:true})).toBeVisible()
  await page.getByRole('link',{name:'查看作品 →',exact:true}).click()
  await expect(page.getByRole('heading',{name:'消息中的讨论'})).toBeVisible()
  await expect(page.getByText('喜欢这个开头。',{exact:true})).toBeVisible()
  page.once('dialog',dialog=>dialog.accept())
  await page.getByRole('button',{name:'屏蔽读者',exact:true}).click()
  await expect(page.getByText('已屏蔽这位读者，可在阅读空间中解除。')).toBeVisible()
  await expect(page.getByText('喜欢这个开头。',{exact:true})).toHaveCount(0)
  await page.getByRole('link',{name:'阅读空间',exact:true}).click()
  await page.getByRole('button',{name:'屏蔽管理',exact:true}).click()
  await page.getByRole('button',{name:'解除屏蔽',exact:true}).click()
  await expect(page.getByText('这里暂时没有记录。')).toBeVisible()
})

test('selected Unicode text submits pending, becomes visible after review, and replies are independently reviewed',async({page,request})=>{
  await login(page);await page.goto(`/community-works/work/${slug}`)
  await expect(page.locator('[data-block="1"]')).toBeVisible()
  await page.locator('[data-block="1"]').evaluate(element=>{
    const range=document.createRange();range.setStart(element.firstChild!,0);range.setEnd(element.firstChild!,6)
    const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range)
  })
  await page.locator('[data-block="1"]').dispatchEvent('mouseup')
  await page.getByRole('button',{name:'划线评论',exact:true}).click()
  const panel=page.getByRole('complementary',{name:'文字讨论'})
  await panel.getByLabel('公开昵称').fill('认真读书的人')
  await panel.getByLabel('评论内容').fill('这段留下了很好的悬念。')
  await panel.getByRole('button',{name:'提交审核',exact:true}).click()
  await expect(panel.getByText('已提交，审核通过后会公开并通知对方。')).toBeVisible()
  await expect(panel.locator('.comment-card')).toHaveCount(0)
  await request.get('/__fixture/approve')
  await page.reload();await page.getByRole('button',{name:'评论第 2 段',exact:true}).click()
  await expect(panel.getByText('这段留下了很好的悬念。',{exact:true})).toBeVisible()
  await login(page,owner);await page.reload();await page.getByRole('button',{name:'评论第 2 段',exact:true}).click()
  await panel.getByRole('button',{name:'回复',exact:true}).click()
  await panel.getByLabel('回复内容').fill('谢谢，我会在下一章揭晓。')
  await panel.locator('.comment-card').getByLabel('公开昵称').fill('作者笔名')
  await panel.locator('.comment-card').getByRole('button',{name:'提交审核'}).click()
  await request.get('/__fixture/approve')
  await page.reload();await page.getByRole('button',{name:'评论第 2 段',exact:true}).click()
  await panel.getByRole('button',{name:'查看 1 条回复'}).click()
  await expect(panel.locator('.comment-replies').getByText('作者',{exact:true})).toBeVisible()
  await expect(panel.getByText('谢谢，我会在下一章揭晓。',{exact:true})).toBeVisible()
})


test('reviewer sees a private doubt count and MFA-gated queue; ordinary readers do not',async({page,request},testInfo)=>{
  await request.get('/__fixture/doubt')
  await login(page);await page.goto('/community-works/library')
  await expect(page.getByRole('link',{name:/审核后台/})).toHaveCount(0)
  const reviewer='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  await login(page,reviewer,'aal2')
  await page.route('https://community-fixture.invalid/auth/v1/user',route=>route.fulfill({json:{id:reviewer,aud:'authenticated',role:'authenticated',factors:[{id:'fixture-factor',factor_type:'totp',status:'verified'}]}}))
  await page.reload()
  await expect(page.getByRole('link',{name:'审核后台，1 项需要复核'})).toBeVisible()
  // The model inbox can finish before the paginated manual queue. Keep that queue
  // pending until the separately fetched 51st comment has had time to render.
  let releaseQueue!: () => void
  const queueGate = new Promise<void>(resolve => { releaseQueue = resolve })
  await page.route('**/api/community/v1/comments?scope=queue', async route => {
    const response = await route.fetch()
    await queueGate
    await route.fulfill({ response })
  })
  await page.getByRole('link',{name:'审核后台，1 项需要复核'}).click()
  await expect(page.getByRole('heading',{name:'模型审核与疑难待办'})).toBeVisible()
  await expect(page.getByText('评论 · 需要你复核',{exact:true})).toBeVisible()
  const locatedResponse = page.waitForResponse(response => {
    const url = new URL(response.url())
    return url.pathname.endsWith('/comments') && url.searchParams.has('id')
  })
  await page.getByRole('article').filter({hasText:'评论 · 需要你复核'}).getByRole('button',{name:'定位待审评论'}).click()
  await (await locatedResponse).finished()
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  releaseQueue()
  await expect(page.locator('[id^="review-comment-"]').filter({hasText:'这里需要结合上下文判断。'})).toBeFocused()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false)
  await page.evaluate(()=>window.scrollTo(0,0))
  await page.screenshot({path:testInfo.outputPath('reviewer-doubt.png'),fullPage:false})
})
