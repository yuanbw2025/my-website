import type { Session } from '@supabase/supabase-js'
import { communityAuthClient } from './auth'
import { validPublicSnapshotV1 } from '../supabase/functions/_shared/snapshot'

export type Novel = {
  schemaVersion: 1
  kind: 'novel'
  title: string
  description: string
  genres: string[]
  chapters: { title: string; content: string }[]
}
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/
class IntakeError extends Error {
  constructor(
    readonly code: string,
    status: number,
  ) {
    const labels: Record<string, string> = {
      intake_paused: '投稿入口暂时关闭。',
      storage_capacity_paused: '投稿存储已达容量限制。',
      daily_upload_limit: '今天的投稿次数已用完。',
      authentication_required: '请重新登录社区账号。',
      upload_session_expired_or_used: '上传会话已结束，请核对我的投稿后重新提交。',
      session_not_usable: '此上传会话已过期，请重新提交。',
    }
    super(labels[code] ?? `社区服务未能完成请求（${status}）。请重试或查看我的投稿。`)
  }
}
async function post(path: string, session: Session, body: object) {
  let response: Response
  try {
    response = await fetch('/api/community/v1/' + path, {
      method: 'POST',
      cache: 'no-store',
      headers: { Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw Error('连接中断。请保留页面并重试，系统会先核对原投稿。')
  }
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new IntakeError(result.error, response.status)
  return result
}

export async function sendNovel(novel: Novel, penName: string, session: Session) {
  const auth = communityAuthClient()
  if (!auth || !validPublicSnapshotV1(novel) || !penName.trim() || penName.length > 120)
    throw Error('请检查作品、章节与笔名。')
  const bytes = new TextEncoder().encode(JSON.stringify(novel))
  if (bytes.length > 32 * 1024 * 1024) throw Error('本次投稿超过 32 MiB，请减少章节。')
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
  // Only the request identifiers survive a reload. The manuscript stays in this form.
  const key = 'community-web-submit:' + session.user.id + ':' + hash
  const saved = JSON.parse(localStorage.getItem(key) ?? 'null')
  const requestId = saved?.requestId ?? crypto.randomUUID()
  const finish = async (id: string) => {
    const receipt = await post('submissions', session, {
      sessionId: id,
      publicPenName: penName.trim(),
      rightsConfirmed: true,
      license: 'all-rights-reserved',
    })
    if (!uuid.test(receipt.submissionId) || !receipt.status) throw Error('投稿回执未确认，请重试。')
    localStorage.removeItem(key)
    return String(receipt.submissionId)
  }
  if (saved?.sessionId) {
    try {
      return await finish(saved.sessionId)
    } catch (error) {
      if (error instanceof IntakeError && error.code === 'session_not_usable') localStorage.removeItem(key)
      if (!(error instanceof IntakeError && error.code === 'upload_not_complete')) throw error
    }
  }
  localStorage.setItem(key, JSON.stringify({ requestId, sessionId: saved?.sessionId }))
  let target
  try {
    target = await post('upload-sessions', session, {
      kind: novel.kind,
      sha256: hash,
      byteLength: bytes.length,
      idempotencyKey: requestId,
    })
  } catch (error) {
    if (error instanceof IntakeError && error.code === 'upload_session_expired_or_used')
      localStorage.removeItem(key)
    throw error
  }
  if (
    !uuid.test(target.sessionId) ||
    target.objectPath !== session.user.id + '/' + target.sessionId + '/snapshot.json' ||
    target.sha256 !== hash ||
    target.byteLength !== bytes.length ||
    !target.token
  )
    throw Error('上传回执与本次稿件不匹配。')
  localStorage.setItem(key, JSON.stringify({ requestId, sessionId: target.sessionId }))
  const { error } = await auth.storage
    .from('community-intake')
    .uploadToSignedUrl(target.objectPath, target.token, bytes, {
      contentType: 'application/json',
      upsert: false,
    })
  if (error) throw Error('上传未确认。保留当前内容并重试，将先核对原投稿。')
  return finish(target.sessionId)
}
