// Isolated in-memory browser fixture; never contacts a hosted project or storage.
import http from 'node:http'
import { createHash } from 'node:crypto'
import { createServer } from 'vite'
import { database, transition, owner, reviewer, reporter, slug, submission, upload } from '../database-fixture.mjs'
import { handleSocial, handleConversation } from '../../server/_lib/social.js'
import { handleComments } from '../../server/_lib/comments.js'
import automoderation from '../../server/v1/automoderation.js'
import operations from '../../server/v1/operations.js'
import { reviewerSessionAal2 } from '../../server/_lib/reports.js'
import { readCatalog, readPart, readTocPage } from '../../server/_lib/catalog.js'

process.env.COMMUNITY_SUPABASE_URL='https://community-fixture.invalid'
process.env.COMMUNITY_SUPABASE_PUBLISHABLE_KEY='sb_publishable_fixture'
process.env.COMMUNITY_SUPABASE_SECRET_KEY='sb_secret_fixture'
const vite=await createServer({ server:{middlewareMode:true,hmr:false}, define:{
  'import.meta.env.VITE_COMMUNITY_SUPABASE_URL':JSON.stringify('https://community-fixture.invalid'),
  'import.meta.env.VITE_COMMUNITY_SUPABASE_PUBLISHABLE_KEY':JSON.stringify('sb_publishable_fixture'),
} })
const db=await database()
const bytes=Buffer.from(JSON.stringify({kind:'novel',chapters:[{content:'风穿过旧书店的窗户。\n她翻开最后一页，发现一个没有署名的故事。😀\n灯光亮起，街上的人慢慢停下脚步。'}]}))
const digest=createHash('sha256').update(bytes).digest('hex')
await db.query('update public.community_submissions set sha256=$1 where id=$2',[digest,submission])
await db.query('update public.community_upload_sessions set sha256=$1 where id=$2',[digest,upload])
for(const decision of ['begin_review','approve','publish']) await transition(db,decision,decision==='publish'?{
  kind:'novel',title:'旧书店的灯',description:'隔离浏览器测试作品',language:'zh-CN',toc:{chapters:[{title:'第一章 · 灯光'}]},
}:null,reviewer,digest)
const user=id=>({id,aud:'authenticated',role:'authenticated',email:'fixture@example.invalid',created_at:new Date().toISOString()})
const fetcher=async(raw,options={})=>{
  const url=new URL(raw)
  if(url.pathname==='/auth/v1/user') {
    try { const token=options.headers.Authorization.split(' ')[1];const id=JSON.parse(Buffer.from(token.split('.')[1],'base64url')).sub
      return [owner,reporter,reviewer].includes(id)?Response.json(user(id)):Response.json({}, {status:401})
    }catch{return Response.json({}, {status:401})}
  }
  if(url.pathname.includes('/storage/'))return new Response(bytes)
  if(url.pathname.startsWith('/rest/v1/rpc/')) {
    const name=url.pathname.split('/').at(-1);if(!/^community_[a-z_0-9]+$/.test(name))throw Error('invalid fixture RPC')
    const args=JSON.parse(options.body);const keys=Object.keys(args)
    if(keys.some(key=>!/^p_[a-z_0-9]+$/.test(key)))throw Error('invalid fixture argument')
    try {const result=await db.query(`select public.${name}(${keys.map((key,i)=>`${key} => $${i+1}`).join(',')}) as value`,keys.map(key=>args[key]&&typeof args[key]==='object'?JSON.stringify(args[key]):args[key]));return Response.json(result.rows[0].value)}
    catch(error){return Response.json({message:error.message},{status:400})}
  }
  if(url.pathname==='/rest/v1/community_comments'){const id=url.searchParams.get('id')?.slice(3);return Response.json((await db.query("select * from community_comments where status='pending'"+(id?' and id=$1':'')+' order by created_at asc limit 50',id?[id]:[])).rows)}
  if(url.pathname==='/rest/v1/community_reviewers')return Response.json(url.searchParams.get('uid')===`eq.${reviewer}`?[{uid:reviewer}]:[])
  if(url.pathname==='/rest/v1/community_publications')return Response.json((await db.query("select * from public.community_publications where status='published'")).rows)
  throw Error(`unsupported fixture path ${url.pathname}`)
}
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1:4187')
    if(url.pathname==='/__fixture/reset') {
      await db.exec('delete from public.community_moderator_alerts;delete from public.community_automod_attempts;delete from public.community_comment_events;delete from public.community_automod_jobs where comment_id is not null;delete from public.community_notifications;delete from public.community_comments;delete from public.community_likes;delete from public.community_bookshelf;delete from public.community_reading_progress;delete from public.community_blocks;alter table public.community_flower_ledger disable trigger community_flower_immutable;delete from public.community_flower_ledger;alter table public.community_flower_ledger enable trigger community_flower_immutable;delete from public.community_flower_wallets;')
      res.end('{}');return
    }
    if(url.pathname==='/__fixture/doubt') {
      await db.query(`insert into community_comments(publication_id,author_uid,idempotency_key,display_name,body) select p.id,$1,gen_random_uuid(),'其他读者','更早的待审评论' from community_publications p cross join generate_series(1,50) n`,[reporter])
      const {rows:[comment]}=await db.query(`insert into community_comments(publication_id,author_uid,idempotency_key,display_name,body)
        select id,$1,gen_random_uuid(),'测试读者','这里需要结合上下文判断。' from community_publications limit 1 returning id`,[reporter])
      await db.query(`select community_automod_alert(id,'model_needs_review') from community_automod_jobs where comment_id=$1`,[comment.id])
      res.end('{}');return
    }
    if(url.pathname==='/__fixture/approve') {
      const rows=(await db.query("select id from public.community_comments where status='pending'")).rows
      for(const row of rows)await db.query("select public.community_review_comment($1,$2,'approve','reviewed','')",[reviewer,row.id])
      res.end('{}');return
    }
    if(!url.pathname.startsWith('/api/')) {vite.middlewares(req,res);return}
    const chunks=[];for await(const chunk of req)chunks.push(chunk)
    const request=new Request(url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})})
    let result
    if(url.pathname.endsWith('/automoderation'))result=await automoderation.fetch(request,fetcher)
    else if(url.pathname.endsWith('/operations'))result=await operations.fetch(request,fetcher)
    else if(url.pathname.endsWith('/comments'))result=await handleComments(request,fetcher)
    else if(['/review','/reports','/comments','/comment-reports','/appeals'].some(path=>url.pathname.endsWith(path))) {
      // Fixture-only transport for the pre-existing manual review API, never hosted Auth.
      const auth=request.headers.get('authorization');let actor
      try {actor=JSON.parse(Buffer.from(auth.split(' ')[1].split('.')[1],'base64url')).sub}catch{}
      if(actor!==reviewer)result=Response.json({error:'reviewer_required'},{status:403})
      else if(url.searchParams.get('scope')==='eligibility')result=Response.json({reviewer:true})
      else if(!reviewerSessionAal2(auth,reviewer))result=Response.json({error:'second_factor_required'},{status:403})
      else result=Response.json({items:url.pathname.endsWith('/comments')?(await db.query("select * from community_comments where status='pending'")).rows:[]})
    }
    else if(url.pathname.endsWith('/social'))result=await handleSocial(request,fetcher)
    else if(url.pathname.endsWith('/conversation'))result=await handleConversation(request,fetcher)
    else if(url.pathname.endsWith('/part'))result=await readPart({slug,...Object.fromEntries(url.searchParams)},fetcher)
    else if(url.pathname.endsWith('/toc'))result=await readTocPage({slug,...Object.fromEntries(url.searchParams)},fetcher)
    else result=await readCatalog(url.pathname.endsWith('/publications')?{}:{slug},fetcher)
    res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()))
  }catch(error){res.writeHead(500);res.end(JSON.stringify({error:error.message}))}
})
server.listen(4187,'127.0.0.1')
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{server.close();void vite.close();void db.close().finally(()=>process.exit(0))})
