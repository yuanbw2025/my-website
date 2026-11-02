import type { Session } from '@supabase/supabase-js'

const messages: Record<string, string> = {
  social_paused:'社区互动暂时暂停，已有内容仍可阅读。', social_capacity_limit:'该项收藏或互动记录已达 2000 条，请先整理现有记录。',
  already_claimed: '今天已经领过花了，明天再来吧。', wallet_full: '花篮最多存 30 朵，请先送出一些；今天的领取机会仍保留。',
  insufficient_flowers: '花花不够了，可以先领取今日鲜花。', self_gift_forbidden: '不能给自己的作品送花。',
  interaction_unavailable: '当前无法进行这项互动。', authentication_required: '登录已过期，请重新登录。',
  work_not_available: '作品暂不可访问。', anchor_mismatch: '正文版本或选中范围不匹配，请重新打开正文后选择。',
  revision_mismatch: '作品版本不匹配，请刷新后重试。', invalid_reply: '原评论已不可回复。',
  idempotency_conflict: '这次操作与原请求不同，请先确认原操作的结果。', daily_comment_limit: '今天的评论数量已达上限，请明天再来。',
  review_already_started: '审核已经开始，不能再更改作品归属。', revision_pending: '这部作品已有一份更新在审核中。',
}
export class SocialError extends Error {
  constructor(public code: string, public uncertain = false) { super(messages[code] ?? (uncertain ? '结果暂时无法确认，请保留本次操作并重试。' : '操作未完成，请稍后重试。')) }
}
export async function socialJson<T>(path: string, session?: Session | null, body?: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api/community/v1/${path}`, {
      method: body === undefined ? 'GET' : 'POST', cache: 'no-store', signal: signal ?? AbortSignal.timeout(55000),
      headers: { Accept: 'application/json', ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) { if (signal?.aborted) throw error; throw new SocialError('network', true) }
  const result = await response.json().catch(() => { throw new SocialError('invalid_response', true) })
  if (!response.ok || result.error) throw new SocialError(result.error ?? 'unavailable', response.status >= 500)
  return result as T
}
export type SocialState = { workId: string; revisionId: string; revisionHash: string; currentSlug: string | null;
  likes: number; flowers: number; liked: boolean; saved: boolean; following: boolean; isAuthor: boolean }
export type Wallet = { balance: number; claimed: boolean; day: string; items: Array<{ id: string; kind: 'claim' | 'gift'; amount: number; balanceAfter: number; createdAt: string; title: string | null }> }
export const action = <T = { ok: boolean }>(session: Session, body: unknown) => socialJson<T>('social', session, body)
