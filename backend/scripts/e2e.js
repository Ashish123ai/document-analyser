/* End-to-end smoke test against a RUNNING stack (backend + ai-service + MongoDB).
 *   BASE=http://localhost:5000/api node scripts/e2e.js
 * Creates throwaway users and removes them at the end. */
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://localhost:5000/api';
const SAMPLE = path.join(__dirname, '../../samples/sample_lease.txt');
let passed = 0;
const failures = [];

async function call(method, url, { token, body, form } = {}) {
  const res = await fetch(BASE + url, {
    method,
    headers: { ...(token && { Authorization: `Bearer ${token}` }), ...(body && { 'Content-Type': 'application/json' }) },
    body: form || (body && JSON.stringify(body)),
  });
  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json() : await res.text();
  return { status: res.status, data, headers: res.headers };
}

function check(name, cond, extra) {
  if (cond) { passed += 1; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ''); }
}

const upload = (token, content, name, type) => {
  const form = new FormData();
  form.append('file', new Blob([content], { type }), name);
  return call('POST', '/documents', { token, form });
};

async function waitReady(token, id) {
  for (let i = 0; i < 60; i++) {
    const { data } = await call('GET', `/documents/${id}`, { token });
    if (data.document.status !== 'processing') return data.document;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('document stayed in processing');
}

(async () => {
  const stamp = Date.now();
  const A = { name: 'Alice Tester', email: `alice${stamp}@example.com`, password: 'Str0ngPass1' };
  const B = { name: 'Bob Tester', email: `bob${stamp}@example.com`, password: 'Str0ngPass2' };

  console.log('health');
  let r = await call('GET', '/health');
  check('health reports db + ai service up', r.status === 200 && r.data.database && r.data.aiService, r.data);

  console.log('auth');
  r = await call('POST', '/auth/register', { body: A });
  check('register', r.status === 201 && r.data.accessToken && r.data.refreshToken && !r.data.user.passwordHash, r.data);
  let ta = r.data.accessToken, ra = r.data.refreshToken;
  check('duplicate email rejected', (await call('POST', '/auth/register', { body: A })).status === 409);
  const rb = await call('POST', '/auth/register', { body: B });
  const tb = rb.data.accessToken;

  r = await call('POST', '/auth/login', { body: { email: A.email, password: 'wrong' } });
  check('wrong password -> 401 generic', r.status === 401 && r.data.message === 'Invalid email or password');
  r = await call('POST', '/auth/login', { body: { email: 'nobody@example.com', password: 'Str0ngPass1' } });
  check('unknown email -> same 401 message', r.status === 401 && r.data.message === 'Invalid email or password');
  r = await call('GET', '/auth/validate', { token: ta });
  check('validate token', r.status === 200 && r.data.valid && r.data.user.email === A.email.toLowerCase(), r.data);

  console.log('upload + isolation');
  const sample = fs.readFileSync(SAMPLE);
  r = await upload(ta, sample, 'sample_lease.txt', 'text/plain');
  check('upload accepted (201, processing)', r.status === 201 && r.data.document.status === 'processing' && !r.data.document.filePath, r.data);
  const docId = r.data.document._id;
  const doc = await waitReady(ta, docId);
  check('processing finished -> ready with counts', doc.status === 'ready' && doc.chunkCount >= 2 && doc.pageCount >= 1 && doc.wordCount > 100, { status: doc.status, error: doc.errorMessage, chunks: doc.chunkCount, pages: doc.pageCount, words: doc.wordCount });
  check('duplicate upload -> 409', (await upload(ta, sample, 'again.txt', 'text/plain')).status === 409);
  r = await upload(ta, Buffer.from('MZ\x00\x01 not really a pdf'), 'fake.pdf', 'application/pdf');
  check('disguised file -> 415', r.status === 415, r.data);
  r = await upload(ta, 'x', 'evil.exe', 'application/octet-stream');
  check('unsupported type -> 415', r.status === 415);

  r = await call('GET', '/documents', { token: ta });
  check('list shows own doc', r.data.documents.length === 1 && r.data.total === 1);
  r = await call('GET', '/documents', { token: tb });
  check('other user list is empty', r.data.documents.length === 0);
  for (const [m, u] of [['GET', `/documents/${docId}`], ['GET', `/documents/${docId}/download`], ['POST', `/documents/${docId}/analyze`], ['DELETE', `/documents/${docId}`], ['GET', `/chat/${docId}`]]) {
    r = await call(m, u, { token: tb });
    check(`other user ${m} ${u.replace(docId, ':id')} -> 404`, r.status === 404, r.status);
  }
  r = await call('POST', `/chat/${docId}`, { token: tb, body: { question: 'What is the rent?' } });
  check('other user cannot chat with it -> 404', r.status === 404);

  console.log('analysis');
  r = await call('POST', `/documents/${docId}/analyze`, { token: ta });
  const a = r.data.document?.analysis;
  check('analyze ok', r.status === 200 && a && r.data.document.analysisStatus === 'done', r.data);
  check('risk level high + risks mapped to camelCase', a?.riskLevel === 'high' && a.risks.length >= 4 && a.risks[0].clauseText, a?.risks?.[0]);
  check('summary has fields', a?.summary?.contract_type && Array.isArray(a.summary.parties), a?.summary);
  check('clauses + missing clauses', a?.clauses.some((c) => c.type === 'termination') && Array.isArray(a.missingClauses), a?.clauses?.length);
  r = await call('GET', `/documents/${docId}/report`, { token: ta });
  check('markdown report', r.status === 200 && String(r.data).includes('Unlimited liability'), String(r.data).slice(0, 100));
  r = await call('GET', `/documents/${docId}/download`, { token: ta });
  check('download original', r.status === 200 && String(r.data).includes('LEASE AGREEMENT'));

  console.log('chat');
  r = await call('POST', `/chat/${docId}`, { token: ta, body: { question: 'How much notice must the tenant give to terminate early?' } });
  check('answer found with sources', r.status === 201 && r.data.chat.found && r.data.chat.sources.length > 0 && /thirty/i.test(r.data.chat.sources.map((s) => s.text).join(' ')), r.data);
  r = await call('POST', `/chat/${docId}`, { token: ta, body: { question: 'quantum chromodynamics gluon spectroscopy' } });
  check('unrelated question -> not found, no sources', r.status === 201 && r.data.chat.found === false && r.data.chat.sources.length === 0, r.data);
  r = await call('POST', `/chat/${docId}`, { token: ta, body: { question: 'hi' } });
  check('too-short question -> 422', r.status === 422);
  r = await call('GET', `/chat/${docId}`, { token: ta });
  check('conversation stored (2)', r.data.chats.length === 2);
  r = await call('GET', '/chat?search=notice', { token: ta });
  check('history search', r.status === 200 && r.data.chats.length >= 1 && r.data.chats[0].documentName === 'sample_lease.txt', r.data);
  r = await call('GET', '/dashboard/stats', { token: ta });
  check('dashboard stats', r.data.stats.documents === 1 && r.data.stats.questions === 2 && r.data.stats.risksFound === a.risks.length && r.data.stats.risksByLevel.high >= 1 && r.data.stats.documentsByRisk.high === 1, r.data.stats);

  console.log('token lifecycle');
  r = await call('POST', '/auth/refresh', { body: { refreshToken: ra } });
  check('refresh issues new pair', r.status === 200 && r.data.accessToken && r.data.refreshToken !== ra, r.data);
  const ra2 = r.data.refreshToken; ta = r.data.accessToken;
  r = await call('POST', '/auth/refresh', { body: { refreshToken: ra } });
  check('reusing a rotated refresh token -> 401', r.status === 401 && r.data.code === 'REFRESH_REUSED', r.data);
  r = await call('POST', '/auth/logout', { token: ta, body: { refreshToken: ra2 } });
  check('logout', r.status === 200);
  r = await call('GET', '/auth/validate', { token: ta });
  check('access token revoked after logout', r.status === 401 && r.data.code === 'TOKEN_REVOKED', r.data);
  r = await call('POST', '/auth/refresh', { body: { refreshToken: ra2 } });
  check('refresh token revoked after logout', r.status === 401);

  console.log('password reset');
  r = await call('POST', '/auth/login', { body: { email: A.email, password: A.password } });
  const oldAccess = r.data.accessToken;
  r = await call('POST', '/auth/forgot-password', { body: { email: A.email } });
  check('forgot password gives dev link', r.status === 200 && r.data.devResetUrl, r.data);
  const token = r.data.devResetUrl.split('/').pop();
  r = await call('POST', '/auth/forgot-password', { body: { email: 'ghost@example.com' } });
  check('unknown email -> same generic response, no link', r.status === 200 && !r.data.devResetUrl);
  r = await call('POST', '/auth/reset-password', { body: { token: 'x'.repeat(64), password: 'NewStr0ngPass9' } });
  check('bad reset token -> 400', r.status === 400);
  r = await call('POST', '/auth/reset-password', { body: { token, password: 'NewStr0ngPass9' } });
  check('reset password', r.status === 200, r.data);
  r = await call('POST', '/auth/reset-password', { body: { token, password: 'AnotherPass1' } });
  check('reset link is single-use', r.status === 400);
  r = await call('GET', '/auth/validate', { token: oldAccess });
  check('old sessions invalidated by reset', r.status === 401 && r.data.code === 'TOKEN_INVALIDATED', r.data);
  r = await call('POST', '/auth/login', { body: { email: A.email, password: A.password } });
  check('old password no longer works', r.status === 401);
  r = await call('POST', '/auth/login', { body: { email: A.email, password: 'NewStr0ngPass9' } });
  check('new password works', r.status === 200);
  ta = r.data.accessToken;
  r = await call('POST', '/auth/change-password', { token: ta, body: { currentPassword: 'wrong', newPassword: 'Third3Password' } });
  check('change password needs correct current password', r.status === 400);
  r = await call('POST', '/auth/change-password', { token: ta, body: { currentPassword: 'NewStr0ngPass9', newPassword: 'Third3Password' } });
  check('change password returns fresh tokens', r.status === 200 && r.data.accessToken, r.data);
  ta = r.data.accessToken;
  r = await call('GET', '/user/activity', { token: ta });
  check('audit trail recorded', r.data.activity.some((x) => x.action === 'auth.password_reset') && r.data.activity.some((x) => x.action === 'document.upload'), r.data.activity?.map((x) => x.action));

  console.log('lockout');
  for (let i = 0; i < 5; i++) await call('POST', '/auth/login', { body: { email: B.email, password: 'wrong' + i } });
  r = await call('POST', '/auth/login', { body: { email: B.email, password: B.password } });
  check('account locks after 5 failures (correct password still 423)', r.status === 423, r.data);

  console.log('delete');
  r = await call('DELETE', `/documents/${docId}`, { token: ta });
  check('delete document', r.status === 200);
  check('document gone', (await call('GET', `/documents/${docId}`, { token: ta })).status === 404);
  check('chat history gone', (await call('GET', '/chat', { token: ta })).data.chats.length === 0);
  r = await call('DELETE', '/user/account', { token: ta, body: { password: 'wrong' } });
  check('delete account needs password', r.status === 400);
  r = await call('DELETE', '/user/account', { token: ta, body: { password: 'Third3Password' } });
  check('delete account', r.status === 200);
  check('deleted user token rejected', (await call('GET', '/auth/validate', { token: ta })).status === 401);

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) { console.log('Failed:\n - ' + failures.join('\n - ')); process.exit(1); }
})().catch((e) => { console.error('E2E crashed:', e); process.exit(1); });
