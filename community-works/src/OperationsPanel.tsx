import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'

type Operations = {
  sampledAt: string
  storage: { valid: boolean; bucketSafe: boolean; unknownSizeObjects: number; observedBytes: number | null;
    reservedBytes: number | null; budgetBytes: number; reservationBytes: number; canAllocate: boolean;
    objectCount: number; unboundObjects: number; missingVerifiedObjects: number; pendingSessions: number; cleanupEligibleSessions: number }
  queues: { submissions: number; comments: number; reports: number; urgentReports: number; appeals: number;
    oldestPendingAt: string | null; expiredModelLeases: number }
  gateway: { acceptingSubmissions: boolean; socialWritesPaused: boolean }
}
const size = (bytes: number | null) => bytes === null ? '未知' : `${(bytes / 1048576).toFixed(2)} MiB`

export function OperationsPanel({ session }: { session: Pick<Session, 'access_token'> }) {
  const [data, setData] = useState<Operations | null>(null)
  const [error, setError] = useState(false)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    let reading = false
    setData(null); setError(false)
    const refresh = async () => {
      if (reading || document.visibilityState !== 'visible') return
      reading = true
      try {
        const response = await fetch('/api/community/v1/operations', {
          headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store', signal: controller.signal,
        })
        if (!response.ok) throw new Error('unavailable')
        const result = await response.json() as Operations
        if (!controller.signal.aborted) { setData(result); setError(false) }
      } catch { if (!controller.signal.aborted) { setData(null); setError(true) } }
      finally { reading = false }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 60000)
    document.addEventListener('visibilitychange', refresh)
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [session.access_token, version])
  const s = data?.storage, q = data?.queues
  return <section className="operations-panel" aria-label="社区运行概览">
    <h2>社区运行概览</h2>
    <p>仅审核员可见；页面打开时每分钟刷新。<button type="button" onClick={() => setVersion(v => v + 1)}>刷新运行状态</button></p>
    {error ? <p role="alert">运行状态读取失败，当前容量和队列状态未知。请重试或检查服务控制台。</p> : !data || !s || !q ?
      <p role="status">正在读取运行状态…</p> : <>
      <p>采样时间：<time dateTime={data.sampledAt}>{new Date(data.sampledAt).toLocaleString('zh-CN')}</time></p>
      <p>投稿入口：{data.gateway.acceptingSubmissions ? '允许分配上传（还需容量及定稿服务允许）' : '暂停收稿'}；互动写入：{data.gateway.socialWritesPaused ? '暂停' : '开放'}。</p>
      {!s.valid && <p role="alert">存储配置或对象大小异常，已停止分配上传。请核对私有桶配置和对象元数据。</p>}
      {s.valid && !s.canAllocate && <p role="alert">剩余预留额度不足，已停止分配新上传。保留已提交稿件，先检查过期上传及实际存储用量。</p>}
      {s.valid && s.canAllocate && s.reservedBytes! >= s.budgetBytes * .8 && <p role="alert">容量预留已达到预算的 80%，请安排清理检查或调整接收节奏。</p>}
      <dl className="operations-metrics">
        <div><dt>已完成对象</dt><dd>{size(s.observedBytes)} · {s.objectCount} 个</dd></div>
        <div><dt>已计入容量（含上传预留）</dt><dd>{size(s.reservedBytes)} / {size(s.budgetBytes)}</dd></div>
        <div><dt>未验证上传 / 过期待清理</dt><dd>{s.pendingSessions} / {s.cleanupEligibleSessions}</dd></div>
        <div><dt>待审作品 / 评论</dt><dd>{q.submissions} / {q.comments}</dd></div>
        <div><dt>待处理举报 / 申诉</dt><dd>{q.reports} / {q.appeals}</dd></div>
        <div><dt>最早待办</dt><dd>{q.oldestPendingAt ? new Date(q.oldestPendingAt).toLocaleString('zh-CN') : '无待办'}</dd></div>
      </dl>
      {q.urgentReports > 0 && <p role="alert">有 {q.urgentReports} 项未成年人安全、现实威胁或性暴力举报待优先核查。举报类别不代表违规已确认。</p>}
      {q.expiredModelLeases > 0 && <p role="alert">有 {q.expiredModelLeases} 个模型任务租约已失效，处理结果不明。检查调度及人工待办，不直接重发模型调用。</p>}
      {s.missingVerifiedObjects > 0 && <p role="alert">有 {s.missingVerifiedObjects} 份已验证稿件找不到对应对象，需检查存储或恢复证据。</p>}
      {s.unboundObjects > 0 && <p role="alert">有 {s.unboundObjects} 个对象没有有效上传会话，仍计入容量；先核对归属，不自动删除。</p>}
    </>}
    <p className="muted">容量仅覆盖社区私有桶的已完成对象及上传预留。临时上传分片、其他桶、组织总用量、流量、邮件额度及备份状态须另行核对。</p>
  </section>
}
