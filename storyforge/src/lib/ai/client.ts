import type { AIConfig, ChatMessage } from '../types'
import { AIError } from '../types'
import { createLog, updateLog } from './logger'

/**
 * 根据 provider 构造请求 URL 和 headers
 */
function buildRequest(config: AIConfig, messages: ChatMessage[], stream: boolean) {
  // 标准化 baseUrl：去除尾部斜杠
  const baseUrl = config.baseUrl.replace(/\/+$/, '')

  // 基础请求体：所有 provider 都需要的字段
  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    stream,
  }

  // Poe 官方文档明确只需 model + messages，不要传额外参数
  // （Claude 模型在 Poe 上自动启用 thinking，传 max_tokens/temperature 会冲突报 400）
  if (config.provider === 'poe') {
    // Poe: 不传额外参数
  } else if (config.provider === 'deepseek') {
    // DeepSeek 官方文档: https://api.deepseek.com, model = deepseek-v4-flash / deepseek-v4-pro
    // V4 Pro 和 Reasoner 支持 thinking 深度思考模式
    const isThinkingModel = config.model.includes('v4-pro')
    if (isThinkingModel) {
      body.thinking = { type: 'enabled' }
      body.reasoning_effort = 'high'
      // 思考模式下不传 temperature（DeepSeek 文档未在 thinking 示例中包含 temperature）
    } else {
      if (config.temperature !== undefined) body.temperature = config.temperature
    }
    if (config.maxTokens !== undefined) body.max_tokens = config.maxTokens
  } else {
    // 其他 provider 正常传 temperature 和 max_tokens
    if (config.temperature !== undefined) body.temperature = config.temperature
    if (config.maxTokens !== undefined) body.max_tokens = config.maxTokens
  }

  return {
    url: `${baseUrl}/chat/completions`,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  }
}

/**
 * 统一的流式聊天接口
 * 使用 AsyncGenerator 逐块 yield 文本内容
 */
export async function* streamChat(
  messages: ChatMessage[],
  config: AIConfig,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const req = buildRequest(config, messages, true)

  const log = createLog({
    type: 'stream',
    provider: config.provider,
    url: req.url,
    model: config.model,
    status: 'pending',
  })

  const startTime = Date.now()

  try {
    const response = await fetch(req.url, {
      method: 'POST',
      headers: req.headers,
      body: req.body,
      signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      const duration = Date.now() - startTime
      updateLog(log.id, { status: 'error', statusCode: response.status, duration, errorMessage: errorText.slice(0, 200) })
      throw new AIError(response.status, errorText)
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') {
            updateLog(log.id, { status: 'success', statusCode: response.status, duration: Date.now() - startTime })
            return
          }
          try {
            const json = JSON.parse(data)
            const content = json.choices?.[0]?.delta?.content
            if (content) yield content
          } catch {
            // 忽略解析错误
          }
        }
      }
    }

    updateLog(log.id, { status: 'success', statusCode: response.status, duration: Date.now() - startTime })
  } catch (err) {
    if (err instanceof AIError) throw err
    const duration = Date.now() - startTime
    updateLog(log.id, { status: 'error', duration, errorMessage: (err as Error).message })
    throw err
  }
}

/**
 * 非流式聊天（用于简单调用如测试连接）
 */
export async function chat(
  messages: ChatMessage[],
  config: AIConfig,
): Promise<string> {
  const req = buildRequest(config, messages, false)

  const response = await fetch(req.url, {
    method: 'POST',
    headers: req.headers,
    body: req.body,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new AIError(response.status, errorText)
  }

  const json = await response.json()
  return json.choices?.[0]?.message?.content || ''
}
