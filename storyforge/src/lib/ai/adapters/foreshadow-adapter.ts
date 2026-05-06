import type { ChatMessage } from '../../types'
import { usePromptStore } from '../../../stores/prompt'
import { renderPrompt } from '../prompt-engine'

/** 生成伏笔建议（API 与旧 src/lib/ai/prompts/foreshadow.ts 一致） */
export function buildForeshadowSuggestPrompt(
  projectName: string,
  genre: string,
  worldContext: string,
  characterContext: string,
  existingForeshadows: string,
): ChatMessage[] {
  const tpl = usePromptStore.getState().getActive('foreshadow.generate')
  const { messages } = renderPrompt(tpl, {
    projectName,
    genres: genre,
    worldContext,
    characters: characterContext,
    existingForeshadows,
    hasNoForeshadows: existingForeshadows ? '' : '1',
  })
  return messages
}
