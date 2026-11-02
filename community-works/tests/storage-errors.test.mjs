import test from 'node:test'
import assert from 'node:assert/strict'
import { isMissingUploadObject } from '../supabase/functions/_shared/storage-errors.ts'

test('unfinished TUS objects accept the observed hosted 400/NoSuchKey response only',()=>{
 assert.equal(isMissingUploadObject(400,{statusCode:'404',code:'NoSuchKey',error:'not_found',message:'Object not found'}),true)
 assert.equal(isMissingUploadObject(404,null),true)
 for(const [status,body] of [[400,{statusCode:'403',code:'AccessDenied',error:'Unauthorized'}],[403,{statusCode:'404',code:'NoSuchKey',error:'not_found'}],[500,{statusCode:'404',code:'NoSuchKey',error:'not_found'}],[400,{}],[400,null]])assert.equal(isMissingUploadObject(status,body),false)
})
