import test from 'node:test'
import assert from 'node:assert/strict'
import { managementIdentity } from '../shared/management-auth.js'
import { uidFromToken, reviewer as isReviewer } from '../server/_lib/reports.js'
import { handleComments, handleCommentDecision } from '../server/_lib/comments.js'
import { handleReports } from '../server/_lib/reports.js'
import { handleMySubmissions, handleSubmissionAction, handleAppeals } from '../server/_lib/owner.js'
import { handleSocial } from '../server/_lib/social.js'
const uid='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',token='sfmgmt_'+'a'.repeat(43),authorization='Bearer '+token
const verifier='v'.repeat(43),base='https://abcdefghijklmnopqrst.supabase.co'
const config={base:new URL(base),publishable:'public-fixture',secret:'private-fixture'}
process.env.COMMUNITY_SUPABASE_URL=base;process.env.COMMUNITY_SUPABASE_PUBLISHABLE_KEY=config.publishable
process.env.COMMUNITY_SUPABASE_SECRET_KEY=config.secret;process.env.COMMUNITY_MANAGEMENT_VERIFIER=verifier
const active=()=>({active:true,subject:uid,audience:'storyforge-community-review',backendOrigin:base,expiresAt:Date.now()+120000})

test('management authority is online, exact-destination, audience-bound and fail closed; it never creates a Supabase session',async()=>{
 let calls=0,body=active()
 const fetcher=async(url,options)=>{calls++;assert.equal(url,'https://storyforge-lab.com/v1/management/community/verify');assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer '+verifier);assert.deepEqual(JSON.parse(options.body),{token});return Response.json(body)}
 assert.equal(await uidFromToken(config,authorization,fetcher),null);assert.equal(calls,0)
 assert.equal(await uidFromToken(config,authorization,fetcher,true),uid)
 body={active:false};assert.equal(await uidFromToken(config,authorization,fetcher,true),null)
 for(const altered of [{backendOrigin:'https://another.supabase.co'},{audience:'admin'},{subject:'not-a-uid'},{expiresAt:Date.now()-1},{expiresAt:Date.now()+3600000},{extra:'private'}]){
  body={...active(),...altered};assert.equal(await managementIdentity(authorization,verifier,base,fetcher),null)
 }
 assert.equal(await managementIdentity(authorization,undefined,base,fetcher),null)
 for (const response of [new Response(' '.repeat(1025)), new Response('{'), Response.json({...active(), subject: [uid]})]) {
  assert.equal(await managementIdentity(authorization,verifier,base,async()=>response),null)
 }
 await assert.rejects(managementIdentity(authorization,verifier,base,async()=>{throw Error('network')}),/network/)
})
test('review grants recheck active membership and every request observes revocation',async()=>{
 let live=true,member=true,checks=0
 const fetcher=async(url)=>{
  if(String(url).includes('/community/verify')){checks++;return Response.json(live?active():{active:false})}
  assert.equal(new URL(url).pathname,'/rest/v1/community_reviewers');return Response.json(member?[{uid}]:[])
 }
 assert.equal(await isReviewer(config,uid,authorization,fetcher),true)
 member=false;assert.equal(await isReviewer(config,uid,authorization,fetcher),false)
 member=true;live=false;assert.equal(await isReviewer(config,uid,authorization,fetcher),false)
 assert.equal(checks,3)
})
test('review-only tokens cannot submit reports/comments, spend flowers, read author data or withdraw works',async()=>{
 const fetcher=async()=>{throw Error('must reject before upstream')}
 const make=(path,method='GET',body={})=>new Request('https://site.example/api/community/v1/'+path,{method,headers:{Authorization:authorization,'Content-Type':'application/json',...(method==='POST'?{Origin:'https://site.example'}:{})},...(method==='POST'?{body:JSON.stringify(body)}:{})})
 for(const [fn,path,method]of[[handleReports,'reports','POST'],[handleComments,'comments','POST'],[handleSocial,'social','POST'],[handleMySubmissions,'my-submissions','GET'],[handleSubmissionAction,'submission-action','POST'],[handleAppeals,'appeals?scope=mine','GET']])assert.equal((await fn(make(path,method),fetcher)).status,401,path)
})
test('review decision keeps designated actor and membership gate; unknown callers cannot choose identities',async()=>{
 let writes=0,live=true
 const fetcher=async(raw,options)=>{
  const url=String(raw)
  if(url.includes('/community/verify'))return Response.json(live?active():{active:false})
  if(url.includes('/community_reviewers'))return Response.json([{uid}])
  assert(url.endsWith('/rpc/community_review_comment'));assert.equal(JSON.parse(options.body).p_actor_uid,uid);writes++;return Response.json('approved')
 }
 const request=()=>new Request('https://site.example/api/community/v1/comment-decision',{method:'POST',headers:{Authorization:authorization,Origin:'https://site.example','Content-Type':'application/json'},body:JSON.stringify({commentId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',decision:'approve',reasonCode:'reviewed',privateNote:''})})
 assert.equal((await handleCommentDecision(request(),fetcher)).status,200);assert.equal(writes,1)
 live=false;assert.equal((await handleCommentDecision(request(),fetcher)).status,401);assert.equal(writes,1)
})
