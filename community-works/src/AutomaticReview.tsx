import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useCommunitySession } from './auth'

type Job={id:string;submissionId:string|null;commentId:string|null;state:string;reasonCode:string|null;completedUnits:number;totalUnits:number;categories:string[]}
type Inbox={reviewer:boolean;pending:number;enabled:boolean;autoPublish:boolean;callsToday:number;dailyLimit:number;items:Job[]}
const labels:Record<string,string>={queued:'排队中',processing:'正在审核',needs_review:'需要你复核',clear:'模型通过，等待发布',published:'已通过并公开',stale:'内容状态已变化'}
const reasons:Record<string,string>={model_needs_review:'模型无法明确放行，需要结合上下文判断。',coverage_budget:'内容超出本轮自动审核预算，原稿完整保留，转人工审核。',daily_model_budget:'今日模型调用额度已用完，请人工处理或调整后续审核安排。',worker_interrupted:'上次处理被中断，结果不明，系统没有重复调用。',processing_unknown:'处理未能确认完成，内容保持私有待审。',invalid_model_response:'模型返回格式不符合审核要求。',model_auth_failed:'模型服务鉴权失败，自动审核已暂停。',model_rate_limited:'模型服务限流，自动审核已暂停。',model_unavailable:'模型服务暂不可用。',model_config:'模型配置不一致，自动审核已暂停。'}
const categoryLabels:Record<string,string>={child_safety:'未成年人安全',explicit_sexual:'露骨性内容',sexual_violence:'性暴力',graphic_harm:'血腥伤害',threats:'现实威胁',hate:'仇恨煽动',privacy:'隐私',harassment:'骚扰',illegal_trade:'违法交易',copyright:'版权疑点',manipulation:'规避审核',uncertain:'上下文不确定'}

async function read<T>(session:Pick<Session, 'access_token'>,scope:string,signal?:AbortSignal):Promise<T>{
 const response=await fetch(`/api/community/v1/automoderation?scope=${scope}`,{headers:{Authorization:`Bearer ${session.access_token}`},cache:'no-store',signal})
 if(!response.ok)throw new Error('review_unavailable')
 return response.json() as Promise<T>
}

/** Only a count before MFA, never manuscript excerpts or private model signals. */
export function ReviewerNotice(){
 const session=useCommunitySession();const [value,setValue]=useState<{reviewer:boolean;pending:number}|null>(null)
 useEffect(()=>{
  setValue(null);if(!session)return
  const controller=new AbortController()
  const refresh=()=>{if(document.visibilityState==='visible')void read<{reviewer:boolean;pending:number}>(session,'badge',controller.signal).then(v=>{if(!controller.signal.aborted)setValue(v)}).catch(()=>{})}
  refresh();const interval=window.setInterval(refresh,60000);document.addEventListener('visibilitychange',refresh)
  return()=>{controller.abort();window.clearInterval(interval);document.removeEventListener('visibilitychange',refresh)}
 },[session?.access_token])
 return value?.reviewer?<a href="/community-works/review" className="reviewer-notice" aria-label={`审核后台，${value.pending} 项需要复核`}>审核后台{value.pending>0?` · 待复核 ${value.pending}`:''}</a>:null
}

export function AutomaticReview({session,onSubmission,onComment}:{session:Pick<Session, 'access_token'>;onSubmission:(id:string)=>void;onComment:(id:string)=>void}){
 const [data,setData]=useState<Inbox|null>(null),[error,setError]=useState(false),[version,setVersion]=useState(0)
 useEffect(()=>{
  const controller=new AbortController()
  const refresh=()=>{if(document.visibilityState==='visible')void read<Inbox>(session,'queue',controller.signal).then(v=>{if(!controller.signal.aborted){setData(v);setError(false)}}).catch(()=>{if(!controller.signal.aborted)setError(true)})}
  refresh();const interval=window.setInterval(refresh,30000)
  return()=>{controller.abort();window.clearInterval(interval)}
 },[session.access_token,version])
 return <section className="automod-panel" aria-label="模型审核与疑难待办"><h2>模型审核与疑难待办</h2>
  <p>Agnes 按同一内容规则分别检查每段内容两次；有疑点、结果不一致或调用失败时转到这里。模型判断可能有误，你可以结合原稿复核，举报和申诉继续由人工处理。</p>
  {error?<p role="alert">自动审核状态暂时无法读取。<button onClick={()=>setVersion(v=>v+1)}>重新读取</button></p>:!data?<p role="status">正在读取模型审核状态…</p>:<>
   <p role="status">{data.enabled?'自动审核运行中':'自动审核已暂停'} · {data.autoPublish?'自动公开开关已开启（还需服务端发布开关）':'自动公开未开启'} · 需要复核 {data.pending} 项</p>
   <p className="muted">今日调用已预约 {data.callsToday} / {data.dailyLimit} 次（UTC 日界）。以下显示最近 50 项，疑难项优先。</p>
   {!data.items.length&&<p>当前没有自动审核任务。</p>}
   {data.items.map(job=><article className="review-list-item" key={job.id}><strong>{job.submissionId?'作品':'评论'} · {labels[job.state]??job.state}</strong>
    <p>已完成 {job.completedUnits} / {job.totalUnits||'待计算'} 段次</p>
    {job.reasonCode&&<p>{reasons[job.reasonCode]??'需要人工复核。'}</p>}
    {!!job.categories.length&&<p>复核方向：{job.categories.map(c=>categoryLabels[c]??'其他疑点').join('、')}。这些是模型信号，不是违规结论。</p>}
    {job.submissionId&&<button onClick={()=>onSubmission(job.submissionId!)}>查看待审作品</button>}
    {job.commentId&&<button onClick={()=>onComment(job.commentId!)}>定位待审评论</button>}
   </article>)}
  </>}
 </section>
}
