import test from 'node:test'
import assert from 'node:assert/strict'
import { reviewerToken } from './reviewer-token.mjs'

test('deployed Edge review handler treats live management grants as a distinct authority and preserves MFA for ordinary users',async()=>{
 const uid='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',base='https://abcdefghijklmnopqrst.supabase.co',auth='Bearer sfmgmt_'+'a'.repeat(43)
 const env={SUPABASE_URL:base,COMMUNITY_PUBLISHABLE_KEY:'public-fixture',COMMUNITY_SECRET_KEY:'private-fixture',COMMUNITY_MANAGEMENT_VERIFIER:'v'.repeat(43),COMMUNITY_PUBLISH_ENABLED:'0'}
 const previousDeno=globalThis.Deno,previousFetch=globalThis.fetch
 let handler,live=true,member=true,introspections=0,userAuthCalls=0
 globalThis.Deno={env:{get:k=>env[k]},serve:h=>{handler=h}}
 globalThis.fetch=async(raw,options={})=>{
  const path=new URL(raw).pathname
  if(path==='/v1/management/community/verify'){
   introspections++;assert.equal(options.headers.Authorization,'Bearer '+env.COMMUNITY_MANAGEMENT_VERIFIER)
   return Response.json(live?{active:true,subject:uid,audience:'storyforge-community-review',backendOrigin:base,expiresAt:Date.now()+120000}:{active:false})
  }
  if(path==='/auth/v1/user'){userAuthCalls++;return Response.json({id:uid})}
  if(path==='/rest/v1/community_reviewers')return Response.json(member?[{uid}]:[])
  if(path==='/rest/v1/community_submissions')return Response.json([])
  throw Error('unexpected upstream '+path)
 }
 try{
  await import('../supabase/functions/review-submission/index.ts')
  const req=(authorization=auth,query='')=>new Request(base+'/functions/v1/review-submission'+query,{headers:{Authorization:authorization}})
  assert.equal((await handler(req())).status,200);assert.equal(introspections,1);assert.equal(userAuthCalls,0)
  live=false;assert.equal((await handler(req())).status,403)
  live=true;member=false;assert.equal((await handler(req())).status,403)
  member=true;assert.equal((await handler(req(reviewerToken(uid,'aal1')))).status,403)
  assert.equal((await handler(req(reviewerToken(uid)))).status,200)
  assert.equal((await handler(req(reviewerToken(uid,'aal1'),'?scope=eligibility'))).status,200)
  env.COMMUNITY_MANAGEMENT_VERIFIER='';assert.equal((await handler(req())).status,403)
 }finally{globalThis.Deno=previousDeno;globalThis.fetch=previousFetch}
})
