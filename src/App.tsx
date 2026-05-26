// AI 幻灯片编辑器 — 主应用

import SlidesEditorPanel from './components/SlidesEditorPanel'

export default function App() {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <SlidesEditorPanel />
    </div>
  )
}
