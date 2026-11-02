export function reviewerToken(uid, aal = 'aal2', exp = Math.floor(Date.now() / 1000) + 3600) {
  const encoded = value => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `Bearer ${encoded({ alg: 'HS256', typ: 'JWT' })}.${encoded({
    sub: uid, role: 'authenticated', aal, exp,
  })}.signature`
}
