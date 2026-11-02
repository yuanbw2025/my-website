import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { handleSocial, handleConversation } from '../server/_lib/social.js'
import { readingBlocks, validateAnchor } from '../shared/anchors.js'

const uid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', revision='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const sha=text=>createHash('sha256').update(text).digest('hex')
const config=()=>{
  process.env.COMMUNITY_SUPABASE_URL='https://example.supabase.co'
  process.env.COMMUNITY_SUPABASE_PUBLISHABLE_KEY='sb_publishable_test'
  process.env.COMMUNITY_SUPABASE_SECRET_KEY='sb_secret_test'
}
const request=(body,authenticated=true,path='social')=>new Request(`https://site.example/api/community/v1/${path}`,{method:'POST',
  headers:{'Content-Type':'application/json',...(authenticated?{Authorization:`Bearer ${'a'.repeat(50)}`}:{})},body:JSON.stringify(body)})

test('anchor protocol normalizes CRLF/NFC and counts Unicode points without changing selection meaning',async()=>{
  const text='A\r\n\r\ne\u0301😀文字\r末段'
  assert.deepEqual(readingBlocks(text),['A','é😀文字','末段'])
  const anchor={version:1,kind:'selection',revisionId:revision,revisionHash:'a'.repeat(64),section:0,entry:0,
    block:1,blockHash:sha('é😀文字'),start:1,end:3,quote:'😀文'}
  assert.equal(await validateAnchor(anchor,text,revision,'a'.repeat(64),sha),true)
  for(const patch of [{quote:'私稿'},{blockHash:'b'.repeat(64)},{revisionId:uid},{end:4},{block:2},{kind:'paragraph'},{start:-1}]) {
    assert.equal(await validateAnchor({...anchor,...patch},text,revision,'a'.repeat(64),sha),false)
  }
})

test('social API never accepts an actor supplied by the client and private reads require Auth',async()=>{
  config();let calls=0
  const noNetwork=async()=>{calls++;throw Error('unexpected')}
  assert.equal((await handleSocial(request({action:'claim',idempotencyKey:revision},false),noNetwork)).status,401)
  assert.equal((await handleSocial(new Request('https://site.example/api/community/v1/social?scope=shelf'),noNetwork)).status,401)
  const fetcher=async(url,options)=>{
    if(url.pathname==='/auth/v1/user')return Response.json({id:uid})
    assert.equal(options.headers.apikey,'sb_secret_test')
    const args=JSON.parse(options.body);assert.equal(args.p_actor_uid,uid)
    assert.equal(args.p_key,revision);return Response.json({ok:true,balanceAfter:3})
  }
  const good=await handleSocial(request({action:'claim',idempotencyKey:revision}),fetcher);assert.equal(good.status,200)
  assert.equal((await handleSocial(request({action:'claim',idempotencyKey:revision,actorUid:revision}),fetcher)).status,400)
  assert.equal(calls,0)
})

test('invalid tokens cannot silently fall back to anonymous and gift limits are enforced before RPC',async()=>{
  config()
  assert.equal((await handleSocial(new Request('https://site.example/api/community/v1/social?slug=work-test',{headers:{Authorization:'Bearer invalid'}}))).status,401)
  let mutations=0
  const fetcher=async(url)=>{if(url.pathname==='/auth/v1/user')return Response.json({id:uid});mutations++;return Response.json({ok:true})}
  for(const amount of [0,4,1.5,-1,'1']) assert.equal((await handleSocial(request({action:'gift',slug:'work-test',idempotencyKey:revision,amount}),fetcher)).status,400)
  assert.equal(mutations,0)
})

test('anchored posting checks approved private object bytes and quote before any insertion',async()=>{
  config()
  const text='第一段\n第二段😀结束'
  const bytes=Buffer.from(JSON.stringify({kind:'novel',chapters:[{content:text}]}));const digest=sha(bytes)
  const anchor={version:1,kind:'selection',revisionId:revision,revisionHash:digest,section:0,entry:0,
    block:1,blockHash:sha('第二段😀结束'),start:0,end:4,quote:'第二段😀'}
  let writes=0
  const fetcher=async(url,options)=>{
    if(url.pathname==='/auth/v1/user')return Response.json({id:uid})
    if(url.pathname.endsWith('community_read_part'))return Response.json({kind:'novel',sha256:digest,objectPath:`${uid}/${revision}/snapshot.json`,revisionId:revision})
    if(url.pathname.includes('/storage/'))return new Response(bytes)
    assert(url.pathname.endsWith('community_file_comment_v2'));writes++
    const args=JSON.parse(options.body);assert.deepEqual(args.p_anchor,anchor);assert.equal(args.p_author_uid,uid)
    return Response.json({commentId:revision,status:'pending'})
  }
  const body={slug:'work-test',idempotencyKey:revision,displayName:'读者',body:'讨论',anchor}
  assert.equal((await handleConversation(request(body,true,'conversation'),fetcher)).status,201)
  assert.equal((await handleConversation(request({...body,anchor:{...anchor,quote:'伪造句😀'}},true,'conversation'),fetcher)).status,409)
  assert.equal(writes,1)
  assert.equal((await handleConversation(request({...body,anchor:{...anchor,revisionHash:'c'.repeat(64)}},true,'conversation'),fetcher)).status,409)
  assert.equal(writes,1)
})

test('database denials are definite receipts, while unknown upstream failures stay retryable',async()=>{
  config()
  const fetcher=async(url)=>url.pathname==='/auth/v1/user'?Response.json({id:uid}):Response.json({error:'already_claimed'})
  const result=await handleSocial(request({action:'claim',idempotencyKey:revision}),fetcher)
  assert.equal(result.status,409);assert.equal((await result.json()).error,'already_claimed')
  const failed=await handleSocial(request({action:'claim',idempotencyKey:revision}),async()=>{throw Error('timeout')})
  assert.equal(failed.status,503)
})
