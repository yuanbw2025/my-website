import { response } from '../_lib/catalog.js'
import { privateCors } from '../_lib/cors.js'
import { settings, uidFromToken, adminJson, reviewer } from '../_lib/reports.js'

export default {async fetch(request,fetcher=fetch){
  const cors=privateCors(request,'GET');if(cors.early)return cors.early
  const reply=(status,body)=>cors.apply(response(status,body))
  if(request.method!=='GET')return reply(405,{error:'method_not_allowed'})
  const config=settings();if(!config)return reply(503,{error:'review_unavailable'})
  const scope=new URL(request.url).searchParams.get('scope')??'queue'
  if(!['badge','queue'].includes(scope))return reply(400,{error:'invalid_scope'})
  try{
    const auth=request.headers.get('authorization'),uid=await uidFromToken(config,auth,fetcher, true)
    if(!uid)return reply(401,{error:'authentication_required'})
    if(scope==='queue'&&!await reviewer(config,uid,auth,fetcher))return reply(403,{error:'reviewer_second_factor_required'})
    const result=await adminJson(config,'/rest/v1/rpc/community_automod_inbox',{method:'POST',body:JSON.stringify({p_actor:uid,p_badge:scope==='badge'})},fetcher)
    return reply(200,result)
  }catch{return reply(503,{error:'review_unavailable'})}
}}
