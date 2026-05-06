import type { ChatMessage } from '../../types'
import { usePromptStore } from '../../../stores/prompt'
import { renderPrompt } from '../prompt-engine'

/** 生成卷级大纲（API 与旧 src/lib/ai/prompts/outline.ts 一致） */
export function buildVolumeOutlinePrompt(
  projectName: string,
  genre: string,
  worldContext: string,
  storyCoreContext: string,
  targetWordCount: number,
  userHint?: string,
): ChatMessage[] {
  const estimatedVolumes = Math.max(1, Math.ceil(targetWordCount / 300000))
  const tpl = usePromptStore.getState().getActive('outline.volume')
  const { messages } = renderPrompt(tpl, {
    projectName,
    genres: genre,
    targetWordCount,
    estimatedVolumes,
    worldContext: worldContext || '（暂无，请自由发挥）',
    storyCore: storyCoreContext || '（暂无，请自由发挥）',
    userHint,
  })
  return messages
}

/** 将卷展开为章节大纲 */
export function buildChapterOutlinePrompt(
  volumeTitle: string,
  volumeSummary: string,
  worldContext: string,
  prevVolumeSummary: string,
  userHint?: string,
): ChatMessage[] {
  const tpl = usePromptStore.getState().getActive('outline.chapter')
  const { messages } = renderPrompt(tpl, {
    volumeTitle,
    volumeSummary,
    worldContext: worldContext || '（暂无）',
    prevVolumeSummary: prevVolumeSummary || '（这是第一卷）',
    userHint,
  })
  return messages
}
