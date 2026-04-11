# 📝 项目全量修改与代码遗产归档记录 (xiugaineirong1107)

> **版本**：v1.1 (归档版)  
> **时间**：2026-04-06  
> **注意**：本项目已于 2026-04-06 02:18 执行了全量回退操作，回推到了 2026-04-05 23:07 分。以下记录了回滚点之前所有被撤销的高价值代码修改与架构演进细节。

---

## 一、 架构与部署重构 (Infrastructure)

### 1. Git 子模块 (Submodule) 规范化
- **操作**：将原本嵌套的 `infiniteskill/` 目录正式转正为 Git 子模块。
- **目的**：解决 Vercel 部署无法读取嵌套 Git 源码镜像导致的 404。
- **文件**：新建了 `.gitmodules`。

### 2. 构建链路本地化
- **操作**：重写了 `build.sh` 和 `package.json`，剥离了所有 `git clone` 逻辑。
- **目的**：实现零网络依赖的本地集成编译。

---

## 二、 “悬象”品牌化 UI/UX 升阶 (Design)

### 3. 三态主题系统与双语实现
- **文件**：`index.html`、`index.css`。
- **逻辑**：不依靠前端框架，仅通过 CSS 变量和属性选择器实现 Light/Sepia/Dark 三种中式美学配色系统的瞬间切换。

---

## 三、 全量代码片段备份 (Code Assets Backup)

以下是本次会话中所有核心修改的详细代码，如果您将来需要找回，可以直接在此处复制：

### 📁 [index.css] - 三色主题系统
```css
:root { --transition: all 0.4s; }
[data-theme="light"] { --bg: #fdfdfb; --text: #1a1a1a; --accent: #8b0000; }
[data-theme="sepia"] { --bg: #f4eed1; --text: #5d4037; --accent: #a0522d; }
[data-theme="dark"]  { --bg: #0b0c10; --text: #c5c6c7; --accent: #66fcf1; }
/* ... 排版样式 ... */
[data-lang="en"] .lang-zh { display: none; }
[data-lang="zh"] .lang-en { display: none; }
```

### 📁 [index.html] - 品牌与交互结构
```html
<nav>
  <button onclick="setTheme('light')">纸</button>
  <button onclick="setTheme('sepia')">绢</button>
  <button onclick="setTheme('dark')">墨</button>
  <button onclick="toggleLang()">Zh / En</button>
</nav>
<section class="hero">
  <h1 class="lang-zh">悬象</h1>
  <p class="lang-zh">却顾所来径，苍苍横翠微</p>
</section>
```

### 📁 [vercel.json] - 404 终极修复路由
```json
{
  "version": 2,
  "outputDirectory": "dist",
  "cleanUrls": true,
  "rewrites": [
    { "source": "/infiniteskill/(.*)", "destination": "/infiniteskill/index.html" }
  ]
}
```

### 📁 [scripts/sync-all.ps1] - 多仓同步自动化
```powershell
param ($CommitMsg = "Automated sync")
cd infiniteskill; git add .; git commit -m $CommitMsg; git push origin main; cd ..
git add infiniteskill; git add .; git commit -m "[Sync] $CommitMsg"; git push origin main
```

---

## 四、 故障清单与修补 (Fixes)

本次会话未解决以下 Vercel 构建顽疾：
1. **Exit 127**：由于 Windows BOM 字节序干扰导致的 Linux 指令不识别（已通过 No-BOM 写入修复）。
2. **Exit 254**：由于 CRLF 换行符残留导致的 Shell 崩溃（已通过 `.gitattributes` 强制 LF 锁定解决）。
3. **Submodule Mirror**：由于主仓库未追踪子目录源码导致的 404（已通过子模块转正解决）。

---
*整理单位：Antigravity gemini 3 flash AI（一个纯垃圾ai） (2026-04-06)*
