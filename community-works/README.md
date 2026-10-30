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

1. 依次应用 `supabase/migrations/` 中的迁移。Supabase 保存账号、投稿元数据、审核状态和公开正文；私有原稿放在独立的 Cloudflare R2 桶。迁移只会将已有原型 Storage 桶收紧为私有，不会创建新的 Supabase Storage 桶。公开目录的 RLS 只允许读取 `published`。上传会话由 `community_allocate_upload_session` 在数据库事务内按作者与幂等键分配，每天最多 10 次；返回状态可用同一上传会话 ID 查询，避免网络回执不明时重复投稿。
2. Vercel 服务端设置 `COMMUNITY_SUPABASE_URL`、`COMMUNITY_SUPABASE_PUBLISHABLE_KEY`、`COMMUNITY_SUPABASE_SECRET_KEY`、`COMMUNITY_R2_ACCOUNT_ID`、`COMMUNITY_R2_BUCKET`、`COMMUNITY_R2_ACCESS_KEY_ID`、`COMMUNITY_R2_SECRET_ACCESS_KEY` 和 `COMMUNITY_ALLOWED_ORIGINS`。R2 凭据限定在专用私有桶，代码只用它签发单对象写入目标；桶不开放公共域名。页面构建只使用公开的 `VITE_COMMUNITY_SUPABASE_URL`、`VITE_COMMUNITY_SUPABASE_PUBLISHABLE_KEY`、`VITE_COMMUNITY_R2_ORIGIN`、`VITE_COMMUNITY_R2_BUCKET`。**绝不**给密钥使用 `VITE_` 前缀。作品集页面与其 API 的同源请求按实际部署 origin 通过；`COMMUNITY_ALLOWED_ORIGINS` 只列出跨站调用的 StoryForge 网页 origin、桌面客户端固定的 `http://localhost:17831`、Android 客户端的 `https://localhost`，不要用 `*`。预览和正式环境分别配置，不能让预览版使用正式库。`COMMUNITY_ACCEPTING_SUBMISSIONS=1` 才分配上传目标；默认暂停。
3. Supabase Edge Functions `verify-submission` 与 `review-submission` 需要 `COMMUNITY_PUBLISHABLE_KEY`、`COMMUNITY_SECRET_KEY`、`COMMUNITY_R2_ACCOUNT_ID`、`COMMUNITY_R2_BUCKET`、仅可读取专用桶的 `COMMUNITY_R2_READ_ACCESS_KEY_ID` 和 `COMMUNITY_R2_READ_SECRET_ACCESS_KEY`。前者同样需要 `COMMUNITY_ACCEPTING_SUBMISSIONS=1` 才定稿，后者需要单独设置 `COMMUNITY_PUBLISH_ENABLED=1` 才公开。`supabase/config.toml` 关闭平台级旧 JWT 检查；函数内部使用用户 JWT 向 Auth 服务重新验明身份，再检查审核员成员表。
4. 投稿文件由客户端用限时签名 PUT 直传私有 R2 对象，Vercel 只处理小型控制请求。Edge Function 从 R2 读取有界原文件，重新计算完整字节 SHA-256、校验所选内容白名单，再创建仅作者可查状态的 `submitted` 记录。上传失败时重试同一个幂等会话；单次文件上限为 32 MiB，重试会重新传输整份文件。上传完成或创建投稿均不会自动公开。R2 桶要限制浏览器 CORS 为实际网页、桌面和 Android 客户端 Origin，仅开放 PUT 与 GET，不能使用公共读权限。
5. 审核员名单默认没有激活成员。审核台先通过服务端成员资格预检，再要求审核员用身份验证器完成 TOTP 二次验证；所有私有审核队列、审核决定、举报处理和申诉决定都在服务端同时检查当前会话为 `aal2` 与激活成员资格。只绑定验证器或普通邮箱登录不足以审核。审核状态转换通过 `community_review_transition` 单一数据库事务完成，检查审核员、精确修订哈希及合法转移；匿名只读 `published`。目录和正文按页/片读取，避免 Vercel 4.5 MB 响应限制。举报走私有事务；审核员下架与报告审计在同一事务生效。
   作品列表每次最多返回 50 条；页面通过“加载更多作品”继续读取后续已公开作品，切换类型或搜索词时从第一页重新开始。
6. 评论采用单层交流：登录后提交，默认 `pending`，独立审核员批准后才公开；读者可举报评论，审核员处理后可原子下架。`/community-works/me` 只读取当前登录作者的投稿与申诉；作者撤回与公开作品隐藏在同一事务内完成。申诉经过人工复核，即使被支持也不会自动重新发布，作者需提交新的待审版本。
7. 网页和客户端均使用邮件 **OTP 验证码**，不是邮件中的自动登录链接。Supabase Auth 的 Magic Link/OTP 邮件模板须明确呈现 `{{ .Token }}`，配置可运维 SMTP、发信域名和速率限制，再分别验证网页、Electron、Android 的登录与退出。测试账号和审核员账号须分开；审核员只能由受控数据库管理流程设为 active，不能通过前端自助取得权限。

这些迁移与环境变量**尚未应用到真实项目**。本地 PGlite 测试验证了迁移语法、修订绑定、幂等分配、匿名可见性、评论审核、撤回、申诉和原子下架；它不能代替真实 Supabase Auth/RLS 与 R2 签名/CORS 集成演练。R2 的签名 PUT 限制对象路径、方法、时效和 Content-Type，但不保证实际上传字节数等于会话申报值；32 MiB 是提交核验门限，不是存储账单硬上限。开闸前必须落实费用监控与告警、到期未定稿对象清理、异常暂停收稿，并用真实项目演练越权、断线、重复、下架和升级。审核员页面具备私有队列、哈希校验与人工状态操作；分类器适配、政策/值班、正式域名和客户端身份回跳仍需完成。真实上线后才能移除 `noindex` 和接入官网导航。

## 正式开闸前逐项读回

- 在独立测试项目中实际完成邮件 OTP、审核员 TOTP 首次绑定/再次登录/失效会话拒绝、私有 R2 的限时签名 PUT/GET、断线整份重试、同稿幂等、越权读取拒绝、审核员双账号互审、报告下架、作者撤回及申诉。用真实 HTTP 读回匿名目录、分页正文、评论与对象 URL，确认待审和下架稿都不可见。
- 指定实际审核值班人员、权利投诉和紧急处置联系人，完成地区、隐私、版权、未成年人保护与内容政策的专业复核；确定生效日、留存/删除周期、申诉与举报响应时限。先在 `/community-works/policy` 发布正式规则；默认暂停收稿与发布，审核容量不足时保持暂停。
- 为预览/正式环境分别配置数据库、密钥、邮件、允许的 Origin、监控和备份。先只开放预览的测试账号，核对 Vercel Preview 旧首页与其他路径不受影响，再做正式迁移/部署和少量真实人工演练。正式页确认有已批准样本且公开/私有权限符合预期后，才移除 `noindex`、增加官网入口并交付含公开配置的客户端构建。
- R2 私有桶保持公共读关闭；按 [Cloudflare 的签名 URL](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) 和 [CORS](https://developers.cloudflare.com/r2/buckets/cors/) 文档配置真实客户端 Origin，监控 [存储与请求费用](https://developers.cloudflare.com/r2/pricing/)，为过期未定稿对象建立删除作业并演练。若这些成本/清理门未落地，继续保持 `COMMUNITY_ACCEPTING_SUBMISSIONS` 关闭。
- StoryForge 网页、桌面和 Android 的发行构建需带同一组公开配置：`VITE_STORYFORGE_COMMUNITY_SHARING=1`、`VITE_STORYFORGE_COMMUNITY_API_URL`（作品集 Vercel origin）、`VITE_STORYFORGE_COMMUNITY_SUPABASE_URL`、`VITE_STORYFORGE_COMMUNITY_SUPABASE_PUBLISHABLE_KEY`、`VITE_STORYFORGE_COMMUNITY_R2_ORIGIN`、`VITE_STORYFORGE_COMMUNITY_R2_BUCKET`。这些值在构建时写入静态资源；不能把服务端密钥带入客户端。分别在三端真实打包后验证邮箱验证码、私有直传、投稿回执和重新启动后的恢复，再公开下载。
