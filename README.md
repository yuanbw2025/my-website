# 🎞 AI 幻灯片编辑器

> **用 AI 生成幻灯片内容，像 Figma 一样可视化编辑，一键导出 PPTX**

纯前端应用，无需后端、无需安装 Office。AI 自动生成幻灯片草稿，可视化拖拽微调每一个元素，支持导入已有 PPTX 文件进行 AI 分析和风格续写，最终导出标准 PPTX，在 PowerPoint / WPS 中直接使用。

---

## ✨ 核心功能

### 🤖 AI 能力
| 功能 | 说明 |
|------|------|
| **AI 生成幻灯片** | 一句话描述主题，AI 规划结构 + 撰写内容 + 配置布局，生成完整演示文稿 |
| **AI 单页微调** | 选中某一页，用自然语言告诉 AI 你想要的修改，秒级响应 |
| **PPTX 风格识别** | 导入已有 PPTX，AI 分析配色、排版风格、元素模式，识别设计语言 |
| **风格感知续写** | 在已有 PPTX 基础上，AI 按原风格生成新幻灯片，无缝衔接 |
| **一键润色** | AI 对全文内容进行统一润色，保持风格一致、逻辑连贯 |

### ✏️ 可视化编辑
| 功能 | 说明 |
|------|------|
| **拖拽 & 缩放** | 直接拖动文字框、图片、形状到任意位置 |
| **双击文字编辑** | 双击元素直接原地修改文字 |
| **形状插入** | 内置 12 种常用形状（矩形/圆形/三角/箭头/星形等），支持填充色和描边 |
| **图片插入** | 本地上传或填写 URL，拖拽调整位置大小 |
| **撤销 / 重做** | 完整操作历史，随时回退（最多 50 步） |
| **对齐辅助线** | 拖动时自动显示辅助线，精准对齐元素 |

### 🎬 动画 & 演示
| 功能 | 说明 |
|------|------|
| **元素动画** | 为每个元素设置入场动画（淡入 / 上滑 / 缩放 / 弹入） |
| **点击触发** | 设置动画顺序，演示时按空格/点击逐步显示，像 PowerPoint 一样 |
| **全屏演示** | 内置演示模式，键盘方向键翻页 |

### 📤 导入 & 导出
| 功能 | 说明 |
|------|------|
| **PPTX 导入** | 解析 .pptx 文件，提取文字、形状、颜色、布局、动画 |
| **导出 PPTX** | 导出标准 .pptx，在 PowerPoint / WPS 中直接使用 |
| **导出 PDF** | 将演示文稿导出为 PDF 文档 |
| **导出 PNG** | 将任意单页截图为高清 PNG |

---

## 🚀 快速上手

### 方式一：直接访问在线版

> *(部署地址)*

### 方式二：本地运行

```bash
git clone https://github.com/yuanbw2025/ai-slides.git
cd ai-slides
npm install
npm run dev
```

打开 `http://localhost:5176/ai-slides/`，第一次使用需要在左上角配置你的 AI API Key。

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

- **从零制作 PPT**：有主题没内容？AI 帮你搭结构、写文案，你只需微调排版
- **优化已有 PPT**：导入你的 PPTX，AI 分析风格后润色内容或按原风格续写新页
- **快速制作草稿**：产品评审、周会汇报、客户提案，5 分钟出一版可用的草稿
- **无 Office 环境**：纯浏览器使用，Chromebook / iPad / Linux 同样能用

---

## 🛠 技术栈

- **前端框架**：React 19 + TypeScript
- **构建工具**：Vite 6
- **PPTX 解析**：JSZip + DOMParser（解析 OOXML 格式）
- **PPTX 生成**：pptxgenjs
- **PDF 导出**：jsPDF + html2canvas
- **AI 接入**：兼容 OpenAI API 格式（支持多家服务商）
- **零依赖部署**：纯静态文件，可部署至 GitHub Pages / Vercel / 任意 CDN

---

## 📦 项目结构

```
src/
├── App.tsx                       # 应用入口
├── components/
│   ├── SlidesEditorPanel.tsx     # 主编辑器面板（~1200行，核心交互逻辑）
│   └── APIConfigForm.tsx         # API 配置表单
└── lib/
    └── ai/
        ├── client.ts             # AI 客户端（兼容多服务商）
        ├── slides-gen.ts         # 幻灯片数据模型 + AI 生成 + PPTX 导出
        └── pptx-import.ts        # PPTX 导入解析（形状/动画/颜色/布局）
```

---

## ⚙️ PPTX 解析能力说明

导入 PPTX 时，解析器会提取：
- **文本内容**：标题、正文、备注（保留格式）
- **形状**：30+ 种预设形状（矩形/菱形/箭头/星形/心形等）+ 自定义路径形状
- **颜色**：主题色、填充色、描边色、渐变（转换为纯色近似）
- **动画**：入场动画类型（淡入/位移/缩放/弹入）+ 触发顺序（点击触发/自动播放）
- **布局**：元素位置、大小（EMU 单位精确转换为百分比）

---

## 🔗 相关项目

本项目是 [my-website](https://github.com/yuanbw2025/my-website) monorepo 中的独立子项目。

同系列工具：
- [ai-presentation](https://github.com/yuanbw2025/ai-presentation) — AI 演示稿生成器，一键生成交互式 HTML 演示
- [yuntype](https://github.com/yuanbw2025/yuntype) — 云中书，AI 排版工具（公众号 / 小红书 / 信息图）
- [novel-game](https://github.com/yuanbw2025/novel-game) — 小说转文本交互游戏

---

## 📄 License

MIT
