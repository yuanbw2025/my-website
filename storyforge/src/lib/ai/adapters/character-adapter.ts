import type { ChatMessage } from '../../types'
import { usePromptStore } from '../../../stores/prompt'
import { renderPrompt } from '../prompt-engine'

/** 生成角色设定（API 与旧 src/lib/ai/prompts/character.ts 一致） */
export function buildCharacterPrompt(
  projectName: string,
  genre: string,
  worldContext: string,
  existingCharacters: string,
  userHint?: string,
): ChatMessage[] {
  const tpl = usePromptStore.getState().getActive('character.generate')
  const { messages } = renderPrompt(tpl, {
    projectName,
    genres: genre,
    worldContext: worldContext || '（暂无）',
    existingCharacters: existingCharacters || '（暂无）',
    userHint,
  })
  return messages
}

/** AI 丰富角色某个维度 */
export function buildCharacterDimensionPrompt(
  characterName: string,
  dimension: string,
  existingInfo: string,
  worldContext: string,
): ChatMessage[] {
  const tpl = usePromptStore.getState().getActive('character.dimension')
  const { messages } = renderPrompt(tpl, {
    characterName,
    dimension,
    characterInfo: existingInfo,
    worldContext: worldContext || '（暂无）',
  })
  return messages
}
