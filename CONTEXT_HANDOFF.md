# Antigravity 开发上下文握手协议 (Context Handoff)

**给未来(或家中 Windows 电脑上)的 Antigravity 助手的提示：**

当你看到这份文件时，说明用户刚刚切换了开发设备（从 Mac 切换到了 Windows）。为了让你能无缝衔接之前的开发，请快速阅读以下核心架构成果：

## 1. 核心架构背景
在这之前的会话中，我们彻底重构了整个 `my-website` 项目，将其从一个简单的个人名片页升级为了**“星舰级生态门户 (Portal)”**。
- **根目录 (/)**: 我们用原生 HTML + Vanilla CSS + JS 写了一个具有玻璃态高级审美、背景流体渐变、以及拥有横向滑动 Carousel (功能包含：防抖距拉动) 的首页 `index.html`。
- **子应用 (/infiniteskill)**: 原本的 InfiniteSkill 编译器我们全部改写完毕，将其底层依赖由原先限定的 `@google/genai` 转换为纯粹且通用的 `openai` SDK，支持市面上所有的通用大模型。我们为了它的羊皮书籍 UI 做了一次精美的浅色系化。

## 2. 核心机密：Vercel “混淆式”安全代理
为了让访客不用配置 API Key 就能使用工具，我们采用 *Security through Obscurity* 的防盗刷隐形设计：
- 把原本的 `api/llm.js` 伪装命名为了 `/api/v2/telemetry-sync.js` (且已提升至**根目录**以支持 Vercel 识别)。
- 前端请求必须携带固定暗号 `X-Core-Version: 8192` 才会触发调用。
- 工具从 Vercel 环境变量中读取私有 Key，然后通过后端的 fetch 将请求交给大模型。

## 3. Windows 环境交接注意事项
这台 Windows 电脑是刚刚 clone 下来的全新环境，作为 AI，你首先应该帮助用户：
1. 确认是否已安装 Node.js，并在根目录的 `/infiniteskill` 里执行 `npm install` 恢复依赖包。
2. 了解当前的跨环境运行规则：本地 Vite 开发时由于没有运行 Vercel 模拟器，免 Key 调用模式下可能会报 `/api/v2/...` 404，这是正常预期现象，并不影响打包上线至 Vercel 后的运作效率。

-- End of Handoff --
