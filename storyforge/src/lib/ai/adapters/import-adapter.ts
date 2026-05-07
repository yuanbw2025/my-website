import type { ChatMessage } from '../../types'
import { usePromptStore } from '../../../stores/prompt'
import { renderPrompt } from '../prompt-engine'

export type ImportParseType = 'character' | 'worldview' | 'outline'

const KEY_MAP: Record<ImportParseType, 'import.parse-character' | 'import.parse-worldview' | 'import.parse-outline'> = {
  character: 'import.parse-character',
  worldview: 'import.parse-worldview',
  outline:   'import.parse-outline',
}

/** 构造导入解析提示词 */
export function buildImportParsePrompt(
  type: ImportParseType,
  rawDocument: string,
): ChatMessage[] {
  const tpl = usePromptStore.getState().getActive(KEY_MAP[type])
  // 文档过长会爆 token — 截断到 30000 字（粗估 8K tokens）
  const trimmed = rawDocument.length > 30000
    ? rawDocument.slice(0, 30000) + '\n\n...（文档过长，已截断后半部分）'
    : rawDocument
  const { messages } = renderPrompt(tpl, { rawDocument: trimmed })
  return messages
}

/** 从 AI 输出中抽取 JSON（去掉 ```json 包裹） */
export function extractJSON(aiOutput: string): unknown {
  // 优先匹配 ```json ... ```
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(aiOutput)
  const jsonStr = fence ? fence[1] : aiOutput
  return JSON.parse(jsonStr.trim())
}
