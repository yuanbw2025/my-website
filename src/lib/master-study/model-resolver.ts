/**
 * 作品学习模型解析器
 *
 * 从 master settings 中读取模型覆盖配置，
 * 如果用户选了专用模型就用专用的，否则跟随全局 AI 配置。
 * 这样可以让用户在全局用 deepseek-v4-pro 写作，
 * 但在作品分析时自动切到更便宜的 flash 模型。
 */
import { useAIConfigStore } from '../../stores/ai-config'
import { PROVIDER_PRESETS } from '../types/ai'
import type { AIConfig } from '../types'

interface MasterModelOverride {
  provider: string
  model: string
}

interface MasterSettings {
  modelOverride?: MasterModelOverride
}

const SETTINGS_KEY = 'sf-master-settings'

/**
 * 获取作品学习的 AI 配置。
 * 如果用户在学习设置中配了专用模型，则覆盖 provider/model/baseUrl，
 * 但保留全局的 apiKey（同 provider 才能共享 key）和 temperature。
 */
export function getMasterAIConfig(maxTokens?: number): AIConfig {
  const baseConfig = useAIConfigStore.getState().config

  let settings: MasterSettings | null = null
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) settings = JSON.parse(raw)
  } catch { /* ignore */ }

  const override = settings?.modelOverride

  // 没有覆盖配置 或 provider 为 'global' → 直接用全局
  if (!override || override.provider === 'global') {
    return { ...baseConfig, maxTokens: maxTokens ?? baseConfig.maxTokens }
  }

  // 有覆盖配置 → 基于 provider preset 构建
  const preset = PROVIDER_PRESETS[override.provider] || {}

  const config: AIConfig = {
    provider: override.provider as AIConfig['provider'],
    model: override.model || preset.model || baseConfig.model,
    baseUrl: preset.baseUrl || baseConfig.baseUrl,
    // 如果覆盖 provider 和全局相同，复用 apiKey；否则用 preset 的（通常为空，需用户自己填）
    apiKey: override.provider === baseConfig.provider
      ? baseConfig.apiKey
      : (preset.apiKey || baseConfig.apiKey),
    temperature: baseConfig.temperature,
    maxTokens: maxTokens ?? baseConfig.maxTokens,
  }

  if (!config.apiKey) {
    throw new Error(
      `作品学习配置了 ${override.provider} 模型，但未找到对应的 API Key。` +
      `请在「系统设置 → AI 配置」中填写，或在「学习设置」中切回全局模型。`
    )
  }

  return config
}

/**
 * 估算分析费用（粗略）
 *
 * 各主流模型的输入/输出价格（每百万 token，单位：元）
 */
const PRICE_TABLE: Record<string, { input: number; output: number; label: string }> = {
  // DeepSeek
  'deepseek:deepseek-v4-flash': { input: 1, output: 4, label: 'DeepSeek V4 Flash' },
  'deepseek:deepseek-v4-pro':   { input: 4, output: 16, label: 'DeepSeek V4 Pro' },
  'deepseek:deepseek-chat':     { input: 1, output: 4, label: 'DeepSeek Chat' },
  // Gemini（按免费额度内=0，超出后的价格）
  'gemini:gemini-2.5-flash':    { input: 0.5, output: 2, label: 'Gemini 2.5 Flash' },
  'gemini:gemini-2.5-pro':      { input: 8, output: 32, label: 'Gemini 2.5 Pro' },
  // Qwen
  'qwen:qwen-max':              { input: 4, output: 12, label: 'Qwen Max' },
  'qwen:qwen-plus':             { input: 0.8, output: 2, label: 'Qwen Plus' },
  // Kimi
  'kimi:moonshot-v1-8k':        { input: 12, output: 12, label: 'Moonshot 8K' },
  'kimi:moonshot-v1-128k':      { input: 60, output: 60, label: 'Moonshot 128K' },
  // GLM
  'glm:glm-4-flash':            { input: 0, output: 0, label: 'GLM-4 Flash (免费)' },
  // ModelScope
  'modelscope:Qwen/Qwen3-235B-A22B': { input: 0, output: 0, label: 'ModelScope (免费)' },
}

export interface CostEstimate {
  provider: string
  model: string
  label: string
  estimatedInputTokens: number
  estimatedOutputTokens: number
  estimatedCostYuan: number | null // null = 无法估算
  isFree: boolean
}

/**
 * 估算分析成本
 * @param totalChars 总字数
 * @param chunkCount 分块数
 * @param maxTokensPerChunk 每块最大输出 token
 */
export function estimateCost(
  totalChars: number,
  chunkCount: number,
  maxTokensPerChunk: number,
): CostEstimate {
  const config = getMasterAIConfig()
  const key = `${config.provider}:${config.model}`

  // 输入 token 估算：每个 chunk ≈ chunkChars * 1.5 + system prompt ~500 tokens
  const avgChunkChars = totalChars / chunkCount
  const inputTokensPerChunk = Math.round(avgChunkChars * 1.5 + 500)
  const totalInput = inputTokensPerChunk * chunkCount
  const totalOutput = maxTokensPerChunk * chunkCount

  const price = PRICE_TABLE[key]
  let cost: number | null = null
  let isFree = false

  if (price) {
    cost = (totalInput / 1_000_000) * price.input + (totalOutput / 1_000_000) * price.output
    isFree = price.input === 0 && price.output === 0
  }

  return {
    provider: config.provider,
    model: config.model,
    label: price?.label || `${config.provider}/${config.model}`,
    estimatedInputTokens: totalInput,
    estimatedOutputTokens: totalOutput,
    estimatedCostYuan: cost,
    isFree,
  }
}
