# 开发指南

## 仓库角色

本仓库（`yuanbw2025/promo-video-maker`）是 **开发正本**，用于开发懒人项目推广视频生成器。

## 产品定位

上传项目截图，为每张截图填写讲解文稿，自动生成配音、字幕，并导出适合 B 站、抖音等平台发布的 MP4 视频。

## 当前架构

- Electron：桌面壳与本地能力调用
- React + Vite + TypeScript：前端界面
- ffmpeg-static：本地视频合成
- macOS `say`：当前 MVP 的本地配音方案

## 开发流程

```bash
cd ~/Desktop/projects/promo-video-maker
npm install
npm run dev
```

## 构建验证

```bash
npm run build
```

## 与主库关系

本仓库作为独立仓库开发。`my-website` 只通过 subtree 同步源码，不作为当前阶段的部署入口。

原因：本项目是 Electron 桌面工具，依赖本地文件选择、配音和 FFmpeg 能力，暂不适合作为普通 Web 子应用部署到 Vercel。

