# StoryForge 社区作品集（施工中）

此目录是 `my-website` 中独立的 `/community-works/` 子应用。原个人项目展示仍由仓库根目录 `index.html` 提供。当前页面有 `noindex`，服务未配置时拒绝读取作品；官网暂不链接到此页。

## 本地验证

```sh
cd community-works
npm ci
npm test
npm run build
```

根目录 `build.mjs` 负责将本子应用的构建输出复制到 `public/community-works/`，Vercel 的定向 rewrite 只覆盖作品详情与投稿状态路径。API Functions 位于仓库根目录 `api/community/`。

## 数据与权限

1. 依次应用 `supabase/migrations/` 中的迁移。`community-intake` 桶必须保持私有；公开目录的 RLS 只允许读取 `published`。
2. Vercel 环境中设置 `COMMUNITY_SUPABASE_URL`、`COMMUNITY_SUPABASE_PUBLISHABLE_KEY`、`COMMUNITY_SUPABASE_SECRET_KEY`、`COMMUNITY_ALLOWED_ORIGINS`。后两者只存在服务端环境；严禁使用 `VITE_` 前缀。
3. Supabase Edge Function `verify-submission` 需要 `COMMUNITY_PUBLISHABLE_KEY` 和 `COMMUNITY_SECRET_KEY` 私有环境变量。`supabase/config.toml` 关闭平台级旧 JWT 检查；函数内部使用用户 JWT 向 Auth 服务重新验明身份。
4. 投稿文件由客户端直传私有对象存储。Vercel 只处理小型控制请求。Edge Function 重新计算完整字节 SHA-256、校验所选内容白名单，再创建仅作者可查状态的 `submitted` 记录。上传完成或创建投稿均不会自动公开。

这些迁移与环境变量**尚未应用到真实项目**。在真实隔离项目完成越权、断线、重复、下架和升级演练前，不得启用投稿入口。后续还需审核员认证、人工审核、举报/申诉与下架的可验证闭环、政策/值班、正式域名和客户端身份回跳；真实上线后才能移除 `noindex` 和接入官网导航。
