import test from 'node:test'
import assert from 'node:assert/strict'
import { secondFactorVerified } from '../supabase/functions/_shared/reviewer-session.ts'
import { reviewerToken } from './reviewer-token.mjs'

const uid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

test('Edge review requires a current second-factor JWT for the authenticated member', () => {
  assert.equal(secondFactorVerified(reviewerToken(uid), uid), true)
  assert.equal(secondFactorVerified(reviewerToken(uid, 'aal1'), uid), false)
  assert.equal(secondFactorVerified(reviewerToken(uid, 'aal2', 1), uid), false)
  assert.equal(secondFactorVerified(reviewerToken(uid), 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), false)
  assert.equal(secondFactorVerified('Bearer a.b.c', uid), false)
})
