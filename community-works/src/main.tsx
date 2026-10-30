import { createRoot } from 'react-dom/client'
import { App } from './App'
import './style.css'

const root = document.getElementById('root')
if (!root) throw new Error('缺少社区作品集根节点')
createRoot(root).render(<App />)
