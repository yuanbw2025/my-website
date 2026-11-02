import { useEffect, useRef, useState } from 'react'
import { readingBlocks, type ReadingAnchor } from '../shared/anchors.js'
import { apiRoot, loadJson } from './publications'
import { Comments } from './Comments'
import { useCommunitySession } from './auth'
import { action } from './social'

type Document = { text: string; revisionId: string; revisionHash: string }
async function readDocument(slug: string, section: number, entry: number, signal: AbortSignal): Promise<Document> {
  const parts: string[] = []; let identity: Document | null = null; let length = 0
  for(let part=0;part<=1000;part++) {
    const value = await loadJson(`${apiRoot}/${slug}/part?section=${section}&entry=${entry}&part=${part}`,signal) as Document & { hasMore: boolean }
    if (!value || typeof value.text !== 'string' || value.text.length>1000000 || typeof value.hasMore!=='boolean' ||
      !/^[0-9a-f-]{36}$/.test(value.revisionId) || !/^[0-9a-f]{64}$/.test(value.revisionHash)) throw new Error('正文版本无效')
    if (identity && (identity.revisionId!==value.revisionId || identity.revisionHash!==value.revisionHash)) throw new Error('正文版本发生变化')
    identity=value; length+=value.text.length; if(length>33554432) throw new Error('正文超出预算')
    parts.push(value.text); if(!value.hasMore) return { text:parts.join(''),revisionId:value.revisionId,revisionHash:value.revisionHash }
    if(!value.text) throw new Error('正文不完整')
  }
  throw new Error('正文分段过多')
}
const sha = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),byte=>byte.toString(16).padStart(2,'0')).join('')

export function ReadingText({ slug, section, entry }: { slug: string; section: number; entry: number }) {
  const session=useCommunitySession()
  const [doc,setDoc]=useState<Document|null>(null)
  const [error,setError]=useState('')
  const [target,setTarget]=useState<ReadingAnchor|null>(null)
  const [selection,setSelection]=useState<ReadingAnchor|null>(null)
  const [message,setMessage]=useState('')
  const root=useRef<HTMLDivElement>(null)
  const selectionVersion=useRef(0)
  useEffect(()=> {
    const controller=new AbortController(); setDoc(null); setTarget(null); setSelection(null); setError('')
    readDocument(slug,section,entry,controller.signal).then(setDoc).catch(()=> { if(!controller.signal.aborted) setError('正文暂时无法读取，请重新打开作品。') })
    return ()=> { controller.abort(); selectionVersion.current++ }
  },[slug,section,entry])
  useEffect(()=> {
    if(!doc) return
    const q=new URLSearchParams(window.location.search)
    if(q.get('section')!==String(section)||q.get('entry')!==String(entry)) return
    const index=Number(q.get('block') ?? 0)
    root.current?.querySelector<HTMLElement>(`[data-block="${Number.isSafeInteger(index)&&index>=0 ? index : 0}"]`)?.scrollIntoView({block:'center'})
  },[doc,section,entry])
  const base = (): ReadingAnchor => ({version:1,kind:'section',revisionId:doc!.revisionId,revisionHash:doc!.revisionHash,section,entry})
  const blocks=doc ? readingBlocks(doc.text) : []
  const paragraph = async (block: number) => {
    const text=blocks[block]; if(!text) return
    const quote=Array.from(text).slice(0,500).join('')
    setTarget({...base(),kind:'paragraph',block,blockHash:await sha(text),start:0,end:Array.from(quote).length,quote})
  }
  const inspectSelection = async () => {
    const version=++selectionVersion.current
    const current=window.getSelection(); setSelection(null)
    if(!doc||!current||current.isCollapsed||current.rangeCount!==1) return
    const range=current.getRangeAt(0)
    const element=(node:Node)=>node.nodeType===Node.ELEMENT_NODE ? node as Element : node.parentElement
    const first=element(range.startContainer)?.closest<HTMLElement>('[data-block]')
    const last=element(range.endContainer)?.closest<HTMLElement>('[data-block]')
    if(!first || first!==last || !root.current?.contains(first)) { setMessage('划线评论请一次选择同一段文字。'); return }
    const before=range.cloneRange(); before.selectNodeContents(first); before.setEnd(range.startContainer,range.startOffset)
    const start=Array.from(before.toString()).length; const quote=range.toString(); const end=start+Array.from(quote).length
    if(end-start>500) {setMessage('一次最多选择 500 字；长段可以用段落评论。');return}
    const block=Number(first.dataset.block); const blockHash=await sha(blocks[block])
    if(version!==selectionVersion.current) return
    setMessage(''); setSelection({...base(),kind:'selection',block,blockHash,start,end,quote})
  }
  const remember=async(block:number)=> {
    if(!session||!doc) {setMessage('请先在阅读空间登录，即可保存阅读位置。');return}
    try {await action(session,{action:'progress',slug,data:{revisionId:doc.revisionId,section,entry,block}});setMessage('阅读位置已保存，书架可继续阅读。')}
    catch(error) {setMessage(error instanceof Error ? error.message : '位置保存失败。')}
  }
  if(error) return <p role="alert">{error}</p>
  if(!doc) return <p role="status">正在读取正文…</p>
  return <>
    <div className="reading-options"><button onClick={()=>setTarget(base())}>讨论本章 / 本条分析</button><span className="muted">选中文字可划线评论；每段右侧也可发起讨论。</span></div>
    <div ref={root} className="annotated-text" onMouseUp={()=>void inspectSelection()} onKeyUp={()=>void inspectSelection()} onTouchEnd={()=>void inspectSelection()}>
      {blocks.map((text,index)=><div className="reading-block" key={index}><p data-block={index}>{text}</p>
        <div className="paragraph-actions"><button aria-label={`评论第 ${index+1} 段`} onClick={()=>void paragraph(index)}>讨论</button>
          <button aria-label={`记住第 ${index+1} 段阅读位置`} onClick={()=>void remember(index)}>读到这里</button></div></div>)}
    </div>
    {selection && <div className="selection-toolbar" role="region" aria-label="选中文字操作"><p>“{selection.quote}”</p>
      <button onClick={()=> {setTarget(selection);setSelection(null)}}>划线评论</button><button onClick={()=>setSelection(null)}>取消选择</button></div>}
    {message && <p role="status">{message}</p>}
    {target && <aside className="annotation-panel" aria-label="文字讨论"><button className="close-discussion" onClick={()=>setTarget(null)}>关闭讨论</button>
      <Comments key={JSON.stringify(target)} slug={slug} anchor={target} initialCompose /></aside>}
  </>
}
