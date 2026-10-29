# StoryForge 社区作品集（施工中）

此目录是 `my-website` 中独立的 `/community-works/` 子应用。原个人项目展示仍由仓库根目录 `index.html` 提供。当前页面有 `noindex`，服务未配置时拒绝读取作品；官网暂不链接到此页。

## 本地验证

```sh
cd community-works
npm ci
npm test
npm run build
```

根目录 `build.mjs` 负责将本子应用的构建输出复制到 `public/community-works/`，Vercel 的定向 rewrite 覆盖作品详情、投稿状态及其余版本化 API 路径。仓库根目录只有 `api/community.js` 一个 Vercel Function 入口，处理代码留在本目录的 `server/`；以单入口路由避免把每个辅助模块都计算为独立 Functions。

## 数据与权限

1. 依次应用 `supabase/migrations/` 中的迁移。迁移会把专用 `community-intake` 桶设为私有并收紧文件大小与 MIME 类型，部署后仍须读回桶设置和对象策略；公开目录的 RLS 只允许读取 `published`。上传会话由 `community_allocate_upload_session` 在数据库事务内按作者与幂等键分配，每天最多 10 次；返回状态可用同一上传会话 ID 查询，避免网络回执不明时重复投稿。
2. Vercel 环境中设置服务端 `COMMUNITY_SUPABASE_URL`、`COMMUNITY_SUPABASE_PUBLISHABLE_KEY`、`COMMUNITY_SUPABASE_SECRET_KEY`、`COMMUNITY_ALLOWED_ORIGINS`；只有前两项的公开值另外以 `VITE_COMMUNITY_SUPABASE_URL`、`VITE_COMMUNITY_SUPABASE_PUBLISHABLE_KEY` 供页面构建。**绝不**给 secret key 使用 `VITE_` 前缀。`COMMUNITY_ALLOWED_ORIGINS` 必须按实际部署逐项列出 StoryForge 网页 origin、桌面客户端固定的 `http://localhost:17831`、Android 客户端的 `https://localhost`；不要用 `*`。预览和正式环境分别配置，不能让预览版使用正式库。`COMMUNITY_ACCEPTING_SUBMISSIONS=1` 才分配上传目标；默认暂停。
3. Supabase Edge Functions `verify-submission` 与 `review-submission` 需要 `COMMUNITY_PUBLISHABLE_KEY` 和 `COMMUNITY_SECRET_KEY` 私有环境变量。前者同样需要 `COMMUNITY_ACCEPTING_SUBMISSIONS=1` 才定稿，后者需要单独设置 `COMMUNITY_PUBLISH_ENABLED=1` 才公开。`supabase/config.toml` 关闭平台级旧 JWT 检查；函数内部使用用户 JWT 向 Auth 服务重新验明身份，再检查审核员成员表。
4. 投稿文件由客户端直传私有对象存储。Vercel 只处理小型控制请求。Edge Function 重新计算完整字节 SHA-256、校验所选内容白名单，再创建仅作者可查状态的 `submitted` 记录。上传完成或创建投稿均不会自动公开。
5. 审核员名单默认没有激活成员。审核状态转换通过 `community_review_transition` 单一数据库事务完成，检查审核员、精确修订哈希及合法转移；匿名只读 `published`。目录和正文按页/片读取，避免 Vercel 4.5 MB 响应限制。举报走私有事务；审核员下架与报告审计在同一事务生效。
6. 评论采用单层交流：登录后提交，默认 `pending`，独立审核员批准后才公开；读者可举报评论，审核员处理后可原子下架。`/community-works/me` 只读取当前登录作者的投稿与申诉；作者撤回与公开作品隐藏在同一事务内完成。申诉经过人工复核，即使被支持也不会自动重新发布，作者需提交新的待审版本。
7. 网页和客户端均使用邮件 **OTP 验证码**，不是邮件中的自动登录链接。Supabase Auth 的 Magic Link/OTP 邮件模板须明确呈现 `{{ .Token }}`，配置可运维 SMTP、发信域名和速率限制，再分别验证网页、Electron、Android 的登录与退出。测试账号和审核员账号须分开；审核员只能由受控数据库管理流程设为 active，不能通过前端自助取得权限。

这些迁移与环境变量**尚未应用到真实项目**。本地 PGlite 测试验证了迁移语法、修订绑定、幂等分配、匿名可见性、评论审核、撤回、申诉和原子下架；它不能代替真实 Supabase 的 Storage/Auth/RLS 集成演练。在真实隔离项目完成越权、断线、重复、下架和升级演练前，不得打开投稿或发布开关。审核员页面具备私有队列、哈希校验与人工状态操作；分类器适配、政策/值班、正式域名和客户端身份回跳仍需完成。真实上线后才能移除 `noindex` 和接入官网导航。

## 正式开闸前逐项读回

- 在独立测试项目中实际完成邮件 OTP、私有 Storage 的 TUS 断线续传、同稿幂等、越权读取拒绝、审核员双账号互审、报告下架、作者撤回及申诉。用真实 HTTP 读回匿名目录、分页正文、评论与对象 URL，确认待审和下架稿都不可见。
- 指定实际审核值班人员、权利投诉和紧急处置联系人，完成地区、隐私、版权、未成年人保护与内容政策的专业复核；确定生效日、留存/删除周期、申诉与举报响应时限。先在 `/community-works/policy` 发布正式规则；默认暂停收稿与发布，审核容量不足时保持暂停。
- 为预览/正式环境分别配置数据库、密钥、邮件、允许的 Origin、监控和备份。先只开放预览的测试账号，核对 Vercel Preview 旧首页与其他路径不受影响，再做正式迁移/部署和少量真实人工演练。正式页确认有已批准样本且公开/私有权限符合预期后，才移除 `noindex`、增加官网入口并交付含公开配置的客户端构建。
- StoryForge 网页、桌面和 Android 的发行构建需带同一组公开配置：`VITE_STORYFORGE_COMMUNITY_SHARING=1`、`VITE_STORYFORGE_COMMUNITY_API_URL`（作品集 Vercel origin）、`VITE_STORYFORGE_COMMUNITY_SUPABASE_URL`、`VITE_STORYFORGE_COMMUNITY_SUPABASE_PUBLISHABLE_KEY`。这四项在构建时写入静态资源；不能把服务端 secret key 带入客户端。分别在三端真实打包后验证邮箱验证码、私有直传、投稿回执和重新启动后的恢复，再公开下载。
