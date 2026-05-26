# 🎬 AI 演示稿生成器

> **一句话描述你的主题，AI 秒速生成可放映的精美演示稿**

纯前端应用，无需后端、无需安装任何软件。打开网页，输入主题，30 秒生成一套结构完整、视觉精美的交互式演示稿，全屏放映，一键下载 HTML 文件随时分享。

---

## ✨ 核心功能

| 功能 | 说明 |
|------|------|
| **AI 一键生成** | 输入主题或需求，AI 自动规划结构、撰写内容、设计排版 |
| **交互式演示** | 生成的演示稿支持键盘/点击翻页、动画过渡，可直接用于演讲 |
| **全屏放映** | 一键进入全屏演示模式，就像使用 PowerPoint 一样 |
| **离线下载** | 导出为单文件 HTML，无需联网即可随时打开播放 |
| **6 大场景预设** | 产品介绍 / 工作汇报 / 教学课件 / 项目方案 / 读书分享 / 活动策划 |
| **自由定制** | 可自定义风格倾向（科技感 / 学术风 / 商务风），AI 据此调整排版色彩 |

---

## 🚀 快速上手

### 方式一：直接访问在线版

> *(部署地址)*

### 方式二：本地运行

```bash
git clone https://github.com/yuanbw2025/ai-presentation.git
cd ai-presentation
npm install
npm run dev
```

打开 `http://localhost:5175/ai-presentation/`，第一次使用需要在右上角配置你的 AI API Key。

### 支持的 AI 服务商

| 服务商 | 推荐模型 | 获取 Key |
|--------|----------|----------|
| DeepSeek | deepseek-chat | [platform.deepseek.com](https://platform.deepseek.com) |
| OpenAI | gpt-4o-mini | [platform.openai.com](https://platform.openai.com) |
| Moonshot | moonshot-v1-8k | [platform.moonshot.cn](https://platform.moonshot.cn) |
| 通义千问 | qwen-plus | [dashscope.aliyun.com](https://dashscope.aliyun.com) |
| Gemini | gemini-2.0-flash | [aistudio.google.com](https://aistudio.google.com) |

> API Key 仅存储在你的浏览器本地（localStorage），不经过任何服务器。

---

## 🎯 适用场景

- **职场汇报**：季度总结、项目进展、年终述职
- **课堂教学**：课程导入、知识讲解、翻转课堂
- **创业路演**：产品介绍、商业计划、投资人展示
- **内容分享**：读书笔记、行业洞察、知识分享会
- **活动策划**：方案提案、流程说明、活动宣讲

---

## 🛠 技术栈

- **前端框架**：React 19 + TypeScript
- **构建工具**：Vite 6
- **AI 接入**：兼容 OpenAI API 格式（支持多家服务商）
- **零依赖部署**：纯静态文件，可部署至 GitHub Pages / Vercel / 任意 CDN

---

## 📦 项目结构

```
src/
├── App.tsx                      # 应用入口
├── components/
│   ├── PresentationPanel.tsx    # 主面板：输入 / 预览 / 导出
│   └── APIConfigForm.tsx        # API 配置表单
└── lib/
    └── ai/
        ├── client.ts            # AI 客户端（兼容多服务商）
        └── presentation-gen.ts  # 演示稿生成逻辑与预设
```

---

## 🔗 相关项目

本项目是 [my-website](https://github.com/yuanbw2025/my-website) monorepo 中的独立子项目。

同系列工具：
- [ai-slides](https://github.com/yuanbw2025/ai-slides) — AI 幻灯片可视化编辑器，支持 PPTX 导入导出
- [yuntype](https://github.com/yuanbw2025/yuntype) — 云中书，AI 排版工具（公众号 / 小红书 / 信息图）
- [novel-game](https://github.com/yuanbw2025/novel-game) — 小说转文本交互游戏

---

## 📄 License

MIT
