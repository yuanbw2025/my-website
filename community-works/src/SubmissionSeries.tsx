import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { action, socialJson } from './social'
type Work = { workId: string; kind: string; title: string }
export function SubmissionSeries({ session, submissionId, kind }: { session: Session; submissionId: string; kind: string }) {
  const [works,setWorks]=useState<Work[]>([])
  const [selected,setSelected]=useState('')
  const [more,setMore]=useState(false)
  const [offset,setOffset]=useState(0)
  const [ready,setReady]=useState(false)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const load=async(start=0)=> {
    const result=await socialJson<{items:Work[]}>(`social?scope=owned&offset=${start}`,session)
    setWorks(old=>start?[...old,...result.items]:result.items);setOffset(start+result.items.length);setMore(result.items.length===50)
  }
  useEffect(()=> {let active=true
    void Promise.all([load(),socialJson<{items:Array<{submissionId:string;workId:string}>}>('social?scope=assignments',session)])
      .then(([,assignments])=> {if(active){setSelected(assignments.items.find(item=>item.submissionId===submissionId)?.workId??'');setReady(true)}})
      .catch(()=>{if(active)setMessage('作品归属暂时无法读取。')})
    return ()=>{active=false}
  },[session.access_token,submissionId])
  const save=async()=> {
    if(busy||!ready) return
    if(!window.confirm(selected ? '确认将此投稿作为所选作品的新版本？通过审核后会沿用作品的收藏和鲜花，旧版本的评论仍保留在原版本。' : '确认将此投稿作为独立作品？')) return
    setBusy(true);setMessage('')
    try {await action(session,{action:'choose-work',data:{submissionId,workId:selected||null}});setMessage('作品归属已保存。更新仍需独立审核后才会公开。')}
    catch(error){setMessage(error instanceof Error ? error.message : '保存未完成。')}finally{setBusy(false)}
  }
  return <details className="submission-series"><summary>这是独立作品，还是已有作品的更新？</summary>
    <p>默认是独立作品。若是续更，请在审核开始前明确选择已有作品。</p>
    <label>投稿归属<select disabled={!ready||busy} value={selected} onChange={event=>setSelected(event.target.value)}><option value="">独立作品</option>
      {selected&&!works.some(item=>item.workId===selected)&&<option value={selected}>已关联的作品（可加载更多查找）</option>}
      {works.filter(item=>item.kind===kind).map(item=><option key={item.workId} value={item.workId}>{item.title}</option>)}</select></label>
    {more&&<button disabled={busy} onClick={()=>void load(offset).catch(()=>setMessage('作品列表暂时无法读取。'))}>加载更多我的作品</button>}
    <button disabled={!ready||busy} onClick={()=>void save()}>确认投稿归属</button>{message&&<p role="status">{message}</p>}
  </details>
}
