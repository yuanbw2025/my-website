import type { ChatMessage } from '../../types'
import { usePromptStore } from '../../../stores/prompt'
import { renderPrompt } from '../prompt-engine'

/** 生成章节正文（API 与旧 src/lib/ai/prompts/chapter.ts 一致） */
export function buildChapterContentPrompt(
  chapterTitle: string,
  chapterSummary: string,
  worldContext: string,
  characterContext: string,
  previousChapterEnding: string,
  userHint?: string,
): ChatMessage[] {
  const tpl = usePromptStore.getState().getActive('chapter.content')
  const { messages } = renderPrompt(tpl, {
    chapterTitle,
    chapterSummary,
    worldContext: worldContext || '（暂无）',
    characters: characterContext || '（暂无角色设定）',
    previousChapterEnding: previousChapterEnding || '（这是第一章）',
    userHint,
  })
  return messages
}

/** 续写正文 */
export function buildContinuePrompt(
  existingContent: string,
  chapterSummary: string,
  worldContext: string,
  userHint?: string,
): ChatMessage[] {
  const tpl = usePromptStore.getState().getActive('chapter.continue')
  const { messages } = renderPrompt(tpl, {
    chapterSummary,
    worldContext: worldContext || '（暂无）',
    existingContent: existingContent.slice(-3000),
    userHint,
  })
  return messages
}

/** 润色 */
export function buildPolishPrompt(text: string, instruction: string): ChatMessage[] {
  const tpl = usePromptStore.getState().getActive('chapter.polish')
  const { messages } = renderPrompt(tpl, { text, instruction })
  return messages
}

/** 扩写 */
export function buildExpandPrompt(text: string, hint?: string): ChatMessage[] {
  const tpl = usePromptStore.getState().getActive('chapter.expand')
  const { messages } = renderPrompt(tpl, { text, userHint: hint })
  return messages
}

/** 去 AI 味 */
export function buildDeAIPrompt(text: string): ChatMessage[] {
  const tpl = usePromptStore.getState().getActive('chapter.de-ai')
  const { messages } = renderPrompt(tpl, { text })
  return messages
}
