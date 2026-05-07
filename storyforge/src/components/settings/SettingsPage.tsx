import { useState } from 'react'
import { Cpu, FileCog } from 'lucide-react'
import AIConfigPanel from './AIConfigPanel'
import PromptManagerPanel from './prompt/PromptManagerPanel'

type SettingsTab = 'ai' | 'prompt'

const TABS: { key: SettingsTab; label: string; icon: typeof Cpu }[] = [
  { key: 'ai', label: 'AI 配置', icon: Cpu },
  { key: 'prompt', label: '提示词管理', icon: FileCog },
]

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('ai')

  return (
    <div className="h-full flex flex-col">
      {/* 顶部 Tab 栏 */}
      <div className="flex items-center gap-1 border-b border-border px-4 pt-3 flex-shrink-0">
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-t-lg border-b-2 transition-colors ${
                active
                  ? 'border-accent text-accent font-medium'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab 内容 */}
      <div className="flex-1 overflow-auto">
        {tab === 'ai' && (
          <div className="p-6">
            <AIConfigPanel />
          </div>
        )}
        {tab === 'prompt' && <PromptManagerPanel />}
      </div>
    </div>
  )
}
