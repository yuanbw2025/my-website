import type { ChatMessage } from '../types'
import type { PromptTemplate, PromptVariableContext } from '../types/prompt'

/**
 * 渲染提示词模板。
 *
 * 支持语法：
 *   {{var}}              字符串替换；缺失时替换为空串并 console.warn
 *   {{#if var}}...{{/if}} 条件块；var 真值且非空字符串时保留块内容，否则去掉整块
 *
 * 不支持嵌套 {{#if}}（Phase 1 内置模板没有这个需求；后续按需扩展）。
 */
export function renderPrompt(
  template: PromptTemplate,
  ctx: PromptVariableContext,
): { messages: ChatMessage[]; modelOverride?: { temperature?: number; maxTokens?: number } } {
  const userContent = renderString(template.userPromptTemplate, ctx, template.moduleKey)
  const systemContent = renderString(template.systemPrompt, ctx, template.moduleKey)

  const messages: ChatMessage[] = []
  if (systemContent.trim()) {
    messages.push({ role: 'system', content: systemContent })
  }
  messages.push({ role: 'user', content: userContent })

  return {
    messages,
    modelOverride: template.modelOverride,
  }
}

function renderString(tpl: string, ctx: PromptVariableContext, moduleKey: string): string {
  // 1. 先处理 {{#if var}}...{{/if}} 块
  let out = tpl.replace(
    /\{\{#if\s+([a-zA-Z0-9_]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, varName: string, block: string) => {
      const v = ctx[varName]
      const truthy =
        v !== undefined &&
        v !== null &&
        !(typeof v === 'string' && v.trim() === '')
      return truthy ? block : ''
    },
  )

  // 2. 处理 {{var}} 替换
  out = out.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, varName: string) => {
    const v = ctx[varName]
    if (v === undefined || v === null) {
      console.warn(`[prompt-engine] missing variable {{${varName}}} in module ${moduleKey}`)
      return ''
    }
    return String(v)
  })

  return out
}
