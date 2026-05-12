/**
 * 统一解析结果结构 —— 跨 session / chunk 共享。
 *
 * 独立成文件避免 import-session.ts 与 import-adapter.ts 循环依赖。
 */
export interface UnifiedParseResult {
  worldview?: Record<string, string>
  characters?: Array<Record<string, unknown>>
  outline?: Array<Record<string, unknown>>
}
