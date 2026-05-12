import { useCallback, useRef, useState } from 'react'
import { streamChat } from '../lib/ai/client'
import { useAIConfigStore } from '../stores/ai-config'
import type { AIConfig, ChatMessage } from '../lib/types'

export interface UseAIStreamReturn {
  /** 当前累积的输出文本 */
  output: string
  /** 是否正在生成 */
  isStreaming: boolean
  /** 错误信息 */
  error: string | null
  /**
   * 开始流式生成。
   * @param messages 聊天消息
   * @param overrideConfig 临时覆盖的配置片段（例如导入面板需要 maxTokens=16384）
   */
  start: (messages: ChatMessage[], overrideConfig?: Partial<AIConfig>) => Promise<string>
  /** 停止生成 */
  stop: () => void
  /** 重置状态 */
  reset: () => void
}


/**
 * 流式 AI 输出 Hook
 * 封装 streamChat，提供 start/stop/reset 控制
 */
export function useAIStream(): UseAIStreamReturn {
  const [output, setOutput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsStreaming(false)
  }, [])

  const reset = useCallback(() => {
    stop()
    setOutput('')
    setError(null)
  }, [stop])

  const start = useCallback(async (
    messages: ChatMessage[],
    overrideConfig?: Partial<AIConfig>,
  ): Promise<string> => {
    // 重置状态
    setOutput('')
    setError(null)
    setIsStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    const baseConfig = useAIConfigStore.getState().config
    const config: AIConfig = overrideConfig
      ? { ...baseConfig, ...overrideConfig }
      : baseConfig


    if (!config.apiKey) {
      const errMsg = '请先在「设置」中配置 AI API Key'
      setError(errMsg)
      setIsStreaming(false)
      return ''
    }

    let accumulated = ''

    try {
      const stream = streamChat(messages, config, controller.signal)
      for await (const chunk of stream) {
        if (controller.signal.aborted) break
        accumulated += chunk
        setOutput(accumulated)
      }
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') {
        // 用户主动停止，不算错误
      } else {
        const errMsg = err instanceof Error ? err.message : '未知错误'
        setError(errMsg)
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }

    return accumulated
  }, [])

  return { output, isStreaming, error, start, stop, reset }
}
