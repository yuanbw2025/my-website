import { readVerifiedSnapshot, publication } from '../_shared/review-snapshot.ts'
import { classify, moderationPlan, moderationModel, moderationPolicy, sha256 } from '../_shared/moderation.ts'

type Job = {id:string;lease:string;model:string;policy_version:string;next_unit:number;submission_id:string|null;unit_hashes:string[]|null;idle?:boolean}
const response=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})
const failures=new Set(['coverage_budget','empty_content','model_auth_failed','model_rate_limited','model_unavailable','model_config','invalid_model_response','database_unavailable','snapshot_unavailable','snapshot_length_mismatch','snapshot_hash_mismatch','invalid_public_snapshot','invalid_submission_record','target_not_available'])

export async function runModeration(env: (name:string)=>string|undefined, request:Request, fetcher:typeof fetch=fetch) {
  if(request.method!=='POST')return response(405,{error:'method_not_allowed'})
  const token=env('COMMUNITY_AUTOMOD_TOKEN')
  const supplied=request.headers.get('x-community-worker')??''
  if(!token || token.length<32 || supplied.length>256 || await sha256(supplied)!==await sha256(token))return response(401,{error:'worker_required'})
  const base=env('SUPABASE_URL'),secret=env('COMMUNITY_SECRET_KEY'),key=env('COMMUNITY_MODEL_API_KEY'),endpoint=env('COMMUNITY_MODEL_BASE_URL')
  if(!base || !secret || !key || !endpoint)return response(503,{error:'worker_not_configured'})
  try { if(new URL(base).protocol!=='https:')return response(503,{error:'worker_not_configured'}) }
  catch { return response(503,{error:'worker_not_configured'}) }
  const rpc=async(name:string,args:unknown={})=>{
    const result=await fetcher(new URL(`/rest/v1/rpc/${name}`,base),{method:'POST',headers:{apikey:secret,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(10000)})
    if(!result.ok)throw new Error('database_unavailable')
    // PostgreSQL void RPCs return 204/empty bodies in hosted PostgREST.
    // An empty successful response is not a transport failure.
    const body=await result.text()
    return body.length?JSON.parse(body):null
  }
  let job:Job|undefined
  let stage='claim'
  try {
    job=await rpc('community_automod_claim') as Job
    if(job.idle)return response(200,{idle:true})
    if(job.model!==moderationModel || job.policy_version!==moderationPolicy)throw new Error('model_config')
    stage='payload'
    const target=await rpc('community_automod_payload',{p_job:job.id,p_lease:job.lease}) as {submission?:Record<string,unknown>;comment?:Record<string,unknown>}|null
    if(!target)throw new Error('target_not_available')
    let content:unknown,projection:unknown=null
    if(target.submission){
      // The same verified snapshot loader and public projection are used by human review.
      stage='snapshot'
      const snapshot=await readVerifiedSnapshot(new URL(base),secret,target.submission,fetcher)
      content={publicPenName:target.submission.publicPenName,snapshot}
      projection=publication(snapshot,String(target.submission.object_path))
    }else if(target.comment){content=target.comment}
    else throw new Error('target_not_available')
    stage='coverage'
    const plan=await moderationPlan(content)
    await rpc('community_automod_plan',{p_job:job.id,p_lease:job.lease,p_manifest:plan.manifest,p_hashes:plan.hashes,p_projection:projection})
    if(job.next_unit===plan.units.length){
      stage='publish'
      const state=await rpc('community_automod_publish',{p_job:job.id,p_lease:job.lease,p_publish_enabled:env('COMMUNITY_PUBLISH_ENABLED')==='1'})
      return response(200,{state})
    }
    const unit=plan.units[job.next_unit]
    if(!unit)throw new Error('coverage_changed')
    stage='reserve'
    const reservation=await rpc('community_automod_begin',{p_job:job.id,p_lease:job.lease,p_index:job.next_unit,p_hash:plan.hashes[job.next_unit]}) as {allowed:boolean}
    if(!reservation.allowed)return response(200,{state:'needs_review'})
    // Exactly one external model request. Errors/unknown outcomes go to a human.
    stage='model'
    const result=await classify({endpoint,key},unit,fetcher)
    stage='finish'
    const state=await rpc('community_automod_finish',{p_job:job.id,p_lease:job.lease,p_index:job.next_unit,p_decision:result.verdict.decision,
      p_categories:result.verdict.categories,p_response_hash:result.responseHash,p_reason:result.verdict.decision==='clear'?null:'model_needs_review'})
    return response(200,{state})
  }catch(error){
    const reason=error instanceof Error&&failures.has(error.message)?error.message:'processing_unknown'
    if(job?.id&&job.lease){
      await rpc('community_automod_fail',{p_job:job.id,p_lease:job.lease,p_reason:reason}).catch(()=>{})
    }
    return response(503,{error:'automatic_review_needs_attention',reason,stage})
  }
}

if(typeof Deno!=='undefined')Deno.serve(request=>runModeration(name=>Deno.env.get(name),request))
