import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import ErrorBoundary from './components/shared/ErrorBoundary'
import { ToastProvider } from './components/shared/Toast'
import { usePromptStore } from './stores/prompt'
import { ensureSchema } from './lib/db/ensure-schema'
import './index.css'

// 从 localStorage 恢复主题
const savedTheme = localStorage.getItem('storyforge-theme') || 'midnight'
document.documentElement.setAttribute('data-theme', savedTheme)

// 当前代码必须存在的表（每次新增表都要在这里登记）
const REQUIRED_TABLES = [
  'projects', 'worldviews', 'storyCores', 'powerSystems',
  'characters', 'factions', 'outlineNodes', 'chapters', 'foreshadows',
  'geographies', 'histories', 'itemSystems', 'creativeRules',
  'characterRelations', 'snapshots', 'references',
  'promptTemplates',
  'detailedOutlines', 'importJobs',
]

async function bootstrap() {
  // 1. Schema 健康自检：缺表自动删库重建（开发期无真实用户）
  try {
    await ensureSchema(REQUIRED_TABLES)
  } catch (e) {
    console.error('[bootstrap] schema check failed:', e)
  }

  // 2. Phase 1：初始化提示词模板（必要时 seed 系统模板）
  try {
    await usePromptStore.getState().init()
  } catch (e) {
    console.error('[bootstrap] prompt store init failed:', e)
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <BrowserRouter basename="/storyforge">
          <ToastProvider>
            <App />
          </ToastProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </React.StrictMode>,
  )
}

bootstrap()
