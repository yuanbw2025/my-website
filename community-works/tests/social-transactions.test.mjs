import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { database, transition, owner, reviewer, reporter, submission, hash, slug } from './database-fixture.mjs'

const projection = { kind: 'novel', title: '测试小说', description: '', language: 'zh-CN', toc: { chapters: [{ title: '第一章' }] } }
async function published(db) {
  await transition(db,'begin_review'); await transition(db,'approve'); await transition(db,'publish',projection)
  return (await db.query('select * from public.community_publications where slug=$1',[slug])).rows[0]
}
const rpc = async (db,name,args) => (await db.query(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) as value`,args)).rows[0].value
const act = (db,actor,action,options={}) => rpc(db,'community_social_action',[actor,action,options.slug??null,options.value??null,options.key??null,options.amount??null,JSON.stringify(options.data??{})])
const state = (db,actor=reporter) => rpc(db,'community_social_state',[slug,actor])
const personal = (db,actor,scope) => rpc(db,'community_social_private',[actor,scope,0])
const conversation = (db,actor=null,filter={},parent=null) => rpc(db,'community_conversation',[slug,actor,JSON.stringify(filter),parent,0])
const comment = (db,actor,options={}) => rpc(db,'community_file_comment_v2',[actor,slug,options.key??randomUUID(),options.name??'读者',options.body??'讨论作品',options.anchor?JSON.stringify(options.anchor):null,options.parent??null])
const approve = (db,id) => rpc(db,'community_review_comment',[reviewer,id,'approve','reviewed',''])

test('migration backfills separate stable works without changing any approved snapshots',async()=> {
  const db=await database({beforeSocial:true})
  try {
    const before=await published(db)
    for(const name of readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(n=>n.startsWith('202611')).sort()) {
      await db.exec(readFileSync(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8'))
    }
    const after=(await db.query('select * from public.community_publications where id=$1',[before.id])).rows[0]
    for(const key of Object.keys(before)) assert.deepEqual(after[key],before[key])
    assert.equal(after.community_work_id,before.id)
    assert.equal((await state(db)).revisionId,before.id)
    await assert.rejects(db.query('update public.community_publications set approved_revision_sha256=$1 where id=$2',['b'.repeat(64),before.id]),/immutable_publication/)
  }finally{await db.close()}
})

test('all private social tables and actor-bearing RPCs deny direct public access',async()=> {
  const db=await database()
  try {
    await published(db)
    for(const role of ['anon','authenticated']) {
      await db.exec(`set role ${role}`)
      for(const table of ['works','submission_works','likes','bookshelf','reading_progress','blocks','flower_wallets','flower_ledger','notifications']) {
        await assert.rejects(db.query(`select * from public.community_${table}`),/permission denied/)
      }
      await assert.rejects(act(db,owner,'claim',{key:randomUUID()}),/permission denied/)
      await assert.rejects(personal(db,owner,'shelf'),/permission denied/)
      await assert.rejects(db.query('select author_uid from public.community_comments'),/permission denied/)
      await db.exec('reset role')
    }
    await db.exec('set role service_role')
    await assert.rejects(db.query('update public.community_flower_wallets set balance=30'),/permission denied/)
    assert.equal((await act(db,reporter,'claim',{key:randomUUID()})).ok,true)
  }finally{await db.close()}
})

test('daily flowers and gifts are idempotent, bounded, atomic and never overspend across retries',async()=> {
  const db=await database()
  try {
    await published(db)
    const key=randomUUID()
    const claims=await Promise.all(Array.from({length:8},()=>act(db,reporter,'claim',{key})))
    assert.equal(new Set(claims.map(x=>x.receiptId)).size,1)
    assert.equal((await act(db,reporter,'claim',{key:randomUUID()})).error,'already_claimed')
    assert.equal((await personal(db,reporter,'wallet')).balance,3)
    const giftKey=randomUUID()
    const gifts=await Promise.all(Array.from({length:10},()=>act(db,reporter,'gift',{key:giftKey,slug,amount:2})))
    assert.equal(new Set(gifts.map(x=>x.receiptId)).size,1)
    assert.equal((await act(db,reporter,'gift',{key:giftKey,slug,amount:1})).error,'idempotency_conflict')
    assert.equal((await act(db,reporter,'gift',{key:randomUUID(),slug,amount:2})).error,'insufficient_flowers')
    assert.equal((await state(db)).flowers,2)
    const wallet=await personal(db,reporter,'wallet')
    assert.equal(wallet.balance,1); assert.equal(wallet.items.length,2)
    assert.equal(wallet.items.reduce((a,x)=>a+x.amount,0),wallet.balance)
    await assert.rejects(db.query('update public.community_flower_ledger set amount=3 where actor_uid=$1',[reporter]),/immutable_flower_ledger/)
    const notices=(await personal(db,owner,'notifications')).items.filter(x=>x.kind==='flowers');assert.equal(notices.length,1);assert.equal(notices[0].quantity,2)
    await act(db,owner,'claim',{key:randomUUID()})
    assert.equal((await act(db,owner,'gift',{key:randomUUID(),slug,amount:1})).error,'self_gift_forbidden')
    assert.equal((await personal(db,owner,'wallet')).balance,3)
    await transition(db,'take_down')
    assert.equal((await act(db,reporter,'gift',{key:giftKey,slug,amount:2})).replayed,true)
    assert.equal((await act(db,reporter,'gift',{key:randomUUID(),slug,amount:1})).error,'work_not_available')
    assert.equal((await personal(db,owner,'notifications')).items.find(x=>x.kind==='flowers').slug,null)
  }finally{await db.close()}
})

test('full flower basket preserves the daily claim and uses the explicit Shanghai day',async()=> {
  const db=await database()
  try {
    await published(db)
    await db.query('insert into public.community_flower_wallets(actor_uid,balance) values($1,30)',[reporter])
    const key=randomUUID()
    assert.equal((await act(db,reporter,'claim',{key})).error,'wallet_full')
    assert.equal((await personal(db,reporter,'wallet')).claimed,false)
    await act(db,reporter,'gift',{key:randomUUID(),slug,amount:3})
    assert.equal((await act(db,reporter,'claim',{key})).balanceAfter,30)
    const wallet=await personal(db,reporter,'wallet')
    const day=(await db.query("select to_char(now() at time zone 'Asia/Shanghai','YYYY-MM-DD') as day")).rows[0].day
    assert.equal(wallet.day,day);assert.equal(wallet.claimed,true)
  }finally{await db.close()}
})

test('likes are sets; bookshelves, subscriptions and exact revision progress are private',async()=> {
  const db=await database()
  try {
    const p=await published(db)
    await Promise.all(Array.from({length:5},()=>act(db,reporter,'like',{slug,value:true})))
    assert.equal((await state(db)).likes,1);assert.equal((await state(db,owner)).liked,false)
    await act(db,reporter,'like',{slug,value:false});assert.equal((await state(db)).likes,0)
    await act(db,reporter,'save',{slug,value:true});await act(db,reporter,'follow',{slug,value:false})
    assert.equal((await personal(db,owner,'shelf')).items.length,0)
    assert.equal((await act(db,reporter,'progress',{slug,data:{revisionId:randomUUID(),section:0,entry:0,block:0}})).error,'invalid_progress')
    await act(db,reporter,'progress',{slug,data:{revisionId:p.id,section:0,entry:0,block:7}})
    const shelf=(await personal(db,reporter,'shelf')).items[0]
    assert.equal(shelf.block,7);assert.equal(shelf.following,false);assert.equal(shelf.resumeSlug,slug)
  }finally{await db.close()}
})

test('only explicit same-owner unreviewed revisions inherit social identity and notify followers',async()=> {
  const db=await database()
  try {
    const p=await published(db);await act(db,reporter,'save',{slug,value:true});await act(db,reporter,'like',{slug,value:true})
    const next=randomUUID();const upload=randomUUID();const digest='b'.repeat(64);const path=`${owner}/${upload}/snapshot.json`
    await db.query(`insert into public.community_upload_sessions(id,owner_uid,idempotency_key,kind,object_path,sha256,byte_length,expires_at)
      values($1,$2,$1,'novel',$3,$4,100,now()+interval '1 hour')`,[upload,owner,path,digest])
    await db.query(`insert into public.community_submissions(id,owner_uid,upload_session_id,kind,object_path,sha256,byte_length,public_pen_name,license,rights_statement_version)
      values($1,$2,$3,'novel',$4,$5,100,'笔名','all-rights-reserved',1)`,[next,owner,upload,path,digest])
    assert.equal((await rpc(db,'community_choose_work',[reporter,next,p.community_work_id])).error,'submission_not_found')
    assert.equal((await rpc(db,'community_choose_work',[owner,next,p.community_work_id])).ok,true)
    for(const decision of ['begin_review','approve','publish']) {
      await rpc(db,'community_review_transition',[reviewer,next,digest,decision,'reviewed','',decision==='publish'?JSON.stringify({...projection,title:'第二个版本',objectPath:path}):null])
    }
    assert.equal((await rpc(db,'community_choose_work',[owner,next,null])).error,'review_already_started')
    const ps=(await db.query('select * from public.community_publications order by published_at')).rows
    assert.equal(ps.length,2);assert.equal(ps[0].community_work_id,ps[1].community_work_id)
    assert.equal(ps[0].is_current,false);assert.equal(ps[1].is_current,true);assert.equal(ps[0].approved_revision_sha256,hash)
    assert.equal((await state(db)).likes,1);assert.equal((await state(db)).currentSlug,ps[1].slug)
    assert.equal((await personal(db,reporter,'notifications')).items[0].kind,'update')
  }finally{await db.close()}
})

test('anchored comments and one-level replies require matching revisions, review and real author identity',async()=> {
  const db=await database()
  try {
    const p=await published(db)
    const anchor={version:1,kind:'section',revisionId:p.id,revisionHash:hash,section:0,entry:0}
    assert.equal((await comment(db,reporter,{anchor:{...anchor,revisionHash:'b'.repeat(64)}})).error,'revision_mismatch')
    const key=randomUUID();const filed=await comment(db,reporter,{key,anchor,name:'作者'})
    assert.equal((await comment(db,reporter,{key,anchor,name:'作者'})).commentId,filed.commentId)
    assert.equal((await comment(db,reporter,{key,anchor,name:'伪造'})).error,'idempotency_conflict')
    assert.equal((await conversation(db,null,{section:0,entry:0})).items.length,0)
    assert.equal((await personal(db,owner,'notifications')).items.filter(x=>x.kind==='comment').length,0)
    await approve(db,filed.commentId)
    assert.equal((await conversation(db,null,{section:0,entry:0})).items[0].isAuthor,false)
    assert.equal((await comment(db,owner,{parent:filed.commentId})).error,'invalid_reply')
    const reply=await comment(db,owner,{parent:filed.commentId,anchor});await approve(db,reply.commentId)
    const replies=(await conversation(db,reporter,{},filed.commentId)).items
    assert.equal(replies[0].isAuthor,true)
    assert.equal((await comment(db,reporter,{parent:reply.commentId,anchor})).error,'invalid_reply')
    assert.equal((await personal(db,reporter,'notifications')).items[0].kind,'reply')
    await rpc(db,'community_withdraw_comment',[reporter,filed.commentId])
    assert.equal((await conversation(db,owner,{},filed.commentId)).items.length,0)
    assert.equal((await personal(db,reporter,'notifications')).items[0].slug,null)
  }finally{await db.close()}
})

test('blocking hides both sides and prevents reply/gift; moderation remains authoritative',async()=> {
  const db=await database()
  try {
    await published(db)
    const c=await comment(db,owner);await approve(db,c.commentId)
    await act(db,reporter,'block',{data:{commentId:c.commentId}})
    assert.equal((await conversation(db,reporter)).items.length,0)
    assert.equal((await comment(db,reporter,{parent:c.commentId})).error,'interaction_unavailable')
    await act(db,reporter,'claim',{key:randomUUID()})
    assert.equal((await act(db,reporter,'gift',{key:randomUUID(),slug,amount:1})).error,'interaction_unavailable')
    assert.equal((await personal(db,owner,'blocks')).items.length,0)
    const block=(await personal(db,reporter,'blocks')).items[0]
    await act(db,owner,'unblock',{data:{blockId:block.id}});assert.equal((await conversation(db,reporter)).items.length,0)
    await act(db,reporter,'unblock',{data:{blockId:block.id}});assert.equal((await conversation(db,reporter)).items.length,1)
    await transition(db,'take_down');assert.equal((await conversation(db,reporter)).items.length,0)
  }finally{await db.close()}
})
