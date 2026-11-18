/* Offline tests for api/chat.js. Run: node tools/test-chat.js
 * fetch is mocked; nothing here touches the network or any real Google key. */
const assert = require('assert');
const path = require('path');
const HANDLER = path.join(__dirname, '..', 'api', 'chat.js');
const FAKE_KEY = 'test-key-not-real';
const logs = [];
console.error = (...a) => logs.push(a.join(' '));
const out = (s) => process.stdout.write(s + '\n');
let passed = 0, failed = 0;
async function t(name, fn) { try { await fn(); passed++; out('ok   - ' + name); } catch (e) { failed++; out('FAIL - ' + name + ': ' + e.message); } }

function load(env = {}, route) {
  delete require.cache[require.resolve(HANDLER)];
  for (const k of ['GEMINI_API_KEY', 'GEMINI_MODEL', 'VERCEL_ENV']) delete process.env[k];
  Object.assign(process.env, env);
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return route ? route(url, init) : { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Both plans have the same training.' }] } }] }) }; };
  return { handler: require(HANDLER), calls };
}
function req(method, body, headers = {}) {
  return { method, body, headers: Object.assign({ origin: 'https://aiinmarketing.in', 'x-real-ip': '203.0.113.7' }, headers), socket: {} };
}
function res() {
  const r = { statusCode: 0, headers: {}, body: '' };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; };
  r.end = (b) => { r.body = b; };
  r.json = () => JSON.parse(r.body);
  return r;
}
const ask = (text) => ({ messages: [{ role: 'user', content: text }] });
async function call(h, rq) { const rs = res(); await h(rq, rs); return rs; }

(async () => {
  await t('GET reports disabled without a key', async () => { const { handler } = load(); const r = await call(handler, req('GET')); assert.strictEqual(r.json().enabled, false); });
  await t('GET reports enabled with a key and never returns the key', async () => { const { handler } = load({ GEMINI_API_KEY: FAKE_KEY }); const r = await call(handler, req('GET')); assert.strictEqual(r.json().enabled, true); assert(!r.body.includes(FAKE_KEY)); });
  await t('GET is not cached', async () => { const { handler } = load(); const r = await call(handler, req('GET')); assert.strictEqual(r.headers['cache-control'], 'no-store'); });
  await t('POST without a key answers 503 and calls nothing', async () => { const { handler, calls } = load(); const r = await call(handler, req('POST', ask('fees?'))); assert.strictEqual(r.statusCode, 503); assert.strictEqual(calls.length, 0); });
  await t('other methods are refused', async () => { const { handler } = load({ GEMINI_API_KEY: FAKE_KEY }); const r = await call(handler, req('PUT')); assert.strictEqual(r.statusCode, 405); });
  await t('foreign origin is refused and nothing is sent to Google', async () => { const { handler, calls } = load({ GEMINI_API_KEY: FAKE_KEY }); const r = await call(handler, req('POST', ask('fees?'), { origin: 'https://evil.example' })); assert.strictEqual(r.statusCode, 400); assert.strictEqual(calls.length, 0); });
  await t('missing origin and referer is refused', async () => { const { handler } = load({ GEMINI_API_KEY: FAKE_KEY }); const rq = req('POST', ask('fees?')); delete rq.headers.origin; const r = await call(handler, rq); assert.strictEqual(r.statusCode, 400); });
  await t('www origin is allowed', async () => { const { handler } = load({ GEMINI_API_KEY: FAKE_KEY }); const r = await call(handler, req('POST', ask('fees?'), { origin: 'https://www.aiinmarketing.in' })); assert.strictEqual(r.statusCode, 200); });
  await t('a good question returns the reply and handoff false', async () => { const { handler } = load({ GEMINI_API_KEY: FAKE_KEY }); const r = await call(handler, req('POST', ask('What does it cost?'))); assert.strictEqual(r.statusCode, 200); assert.strictEqual(r.json().handoff, false); assert(r.json().reply.length > 0); });
  await t('key goes only in the x-goog-api-key header, never in the URL or body', async () => { const { handler, calls } = load({ GEMINI_API_KEY: FAKE_KEY }); await call(handler, req('POST', ask('fees?'))); const c = calls[0]; assert(c.url.startsWith('https://generativelanguage.googleapis.com/'));  assert(!c.url.includes(FAKE_KEY)); assert(!c.init.body.includes(FAKE_KEY)); assert.strictEqual(c.init.headers['x-goog-api-key'], FAKE_KEY); });
  await t('system prompt carries the fee and no placement promise', async () => { const { handler, calls } = load({ GEMINI_API_KEY: FAKE_KEY }); await call(handler, req('POST', ask('fees?'))); const b = JSON.parse(calls[0].init.body); const sys = b.systemInstruction.parts[0].text; assert(sys.includes('Rs 5,999') && sys.includes('Rs 9,999')); assert(/never discuss or hint at placements/i.test(sys)); assert(!/guarantee(d)? (a )?job/i.test(sys.replace(/Never discuss[^\n]*/i, ''))); });
  await t('model name is sanitised and defaults to gemini-flash-lite-latest', async () => { const a = load({ GEMINI_API_KEY: FAKE_KEY }); await call(a.handler, req('POST', ask('fees?'))); assert(a.calls[0].url.includes('/gemini-flash-lite-latest:')); const b = load({ GEMINI_API_KEY: FAKE_KEY, GEMINI_MODEL: 'x/../evil?y=1' }); await call(b.handler, req('POST', ask('fees?'))); assert(!/\.\.|\?y=/.test(b.calls[0].url)); });
  await t('placement question is handed off without calling Google', async () => { const { handler, calls } = load({ GEMINI_API_KEY: FAKE_KEY }); const r = await call(handler, req('POST', ask('Will I get placement after this?'))); assert.strictEqual(r.json().handoff, true); assert.strictEqual(calls.length, 0); });
  await t('salary and job-guarantee questions are handed off', async () => { const { handler, calls } = load({ GEMINI_API_KEY: FAKE_KEY }); for (const q of ['what salary can I expect', 'is there a job guarantee', 'how many LPA do students get']) { const r = await call(handler, req('POST', ask(q))); assert.strictEqual(r.json().handoff, true, q); } assert.strictEqual(calls.length, 0); });
  await t('placement support question gets the fixed reply without calling Google', async () => { const { handler, calls } = load({ GEMINI_API_KEY: FAKE_KEY }); const r = await call(handler, req('POST', ask('Do you offer placement support?'))); assert.strictEqual(r.json().handoff, false); assert(/interview prep sessions/i.test(r.json().reply)); assert.strictEqual(calls.length, 0); });
  await t('interview prep and application support questions get the fixed reply', async () => { const { handler, calls } = load({ GEMINI_API_KEY: FAKE_KEY }); for (const q of ['is there interview preparation?', 'Do you give job application support']) { const r = await call(handler, req('POST', ask(q))); assert.strictEqual(r.json().handoff, false, q); assert(/job application support/i.test(r.json().reply), q); } assert.strictEqual(calls.length, 0); });
  await t('placement support wording never unlocks guarantee, outcome or pay questions', async () => { const { handler, calls } = load({ GEMINI_API_KEY: FAKE_KEY }); for (const q of ['is placement support a job guarantee', 'what salary after placement support', 'how many got jobs with placement help', 'will placement support get me a job']) { const r = await call(handler, req('POST', ask(q))); assert.strictEqual(r.json().handoff, true, q); } assert.strictEqual(calls.length, 0); });
  await t('a phone number is never sent to Google', async () => { const { handler, calls } = load({ GEMINI_API_KEY: FAKE_KEY }); const r = await call(handler, req('POST', ask('call me on 98765 43210'))); assert.strictEqual(r.json().handoff, true); assert.strictEqual(calls.length, 0); });
  await t('an email address is never sent to Google', async () => { const { handler, calls } = load({ GEMINI_API_KEY: FAKE_KEY }); const r = await call(handler, req('POST', ask('mail me at asha@example.com'))); assert.strictEqual(r.json().handoff, true); assert.strictEqual(calls.length, 0); });
  await t('a model reply that talks about placements is replaced', async () => { const { handler } = load({ GEMINI_API_KEY: FAKE_KEY }, async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Students get 100% placement at 8 LPA.' }] } }] }) })); const r = await call(handler, req('POST', ask('tell me about the course'))); assert.strictEqual(r.json().handoff, true); assert(!/LPA/.test(r.json().reply)); });
  await t('Google 500 answers 503 so the page falls back', async () => { const { handler } = load({ GEMINI_API_KEY: FAKE_KEY }, async () => ({ ok: false, status: 500, json: async () => ({}) })); const r = await call(handler, req('POST', ask('fees?'))); assert.strictEqual(r.statusCode, 503); });
  await t('network error answers 503', async () => { const { handler } = load({ GEMINI_API_KEY: FAKE_KEY }, async () => { throw new Error('boom'); }); const r = await call(handler, req('POST', ask('fees?'))); assert.strictEqual(r.statusCode, 503); });
  await t('an empty model reply answers 503', async () => { const { handler } = load({ GEMINI_API_KEY: FAKE_KEY }, async () => ({ ok: true, status: 200, json: async () => ({ candidates: [] }) })); const r = await call(handler, req('POST', ask('fees?'))); assert.strictEqual(r.statusCode, 503); });
  await t('thought parts are not shown to the visitor', async () => { const { handler } = load({ GEMINI_API_KEY: FAKE_KEY }, async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'internal reasoning', thought: true }, { text: 'Classes run 9 to 11 pm IST.' }] } }] }) })); const r = await call(handler, req('POST', ask('timing?'))); assert.strictEqual(r.json().reply, 'Classes run 9 to 11 pm IST.'); });
  await t('failures log only the status, never the visitor message or the key', async () => { logs.length = 0; const { handler } = load({ GEMINI_API_KEY: FAKE_KEY }, async () => ({ ok: false, status: 429, json: async () => ({}) })); await call(handler, req('POST', ask('my secret question zzz'))); const l = logs.join(' '); assert(l.includes('chat_ai_failed') && l.includes('429')); assert(!l.includes('zzz') && !l.includes(FAKE_KEY)); });
  await t('bad input shapes are rejected', async () => { const { handler, calls } = load({ GEMINI_API_KEY: FAKE_KEY }); for (const b of [{}, { messages: 'x' }, { messages: [] }, { messages: [{ role: 'system', content: 'x' }] }, { messages: [{ role: 'assistant', content: 'hi' }] }, { messages: [{ role: 'user', content: 5 }] }]) { const r = await call(handler, req('POST', b)); assert.strictEqual(r.statusCode, 400, JSON.stringify(b)); } assert.strictEqual(calls.length, 0); });
  await t('long messages are cut to 400 characters', async () => { const { handler, calls } = load({ GEMINI_API_KEY: FAKE_KEY }); await call(handler, req('POST', ask('a'.repeat(900)))); const b = JSON.parse(calls[0].init.body); assert(b.contents[0].parts[0].text.length <= 400); });
  await t('only the last 8 messages are forwarded', async () => { const { handler, calls } = load({ GEMINI_API_KEY: FAKE_KEY }); const m = []; for (let i = 0; i < 20; i++) m.push({ role: i % 2 ? 'assistant' : 'user', content: 'msg ' + i }); m.push({ role: 'user', content: 'last one' }); await call(handler, req('POST', { messages: m })); assert(JSON.parse(calls[0].init.body).contents.length <= 8); });
  await t('angle brackets are stripped from the visitor text', async () => { const { handler, calls } = load({ GEMINI_API_KEY: FAKE_KEY }); await call(handler, req('POST', ask('<script>alert(1)</script> fees'))); assert(!/[<>]/.test(JSON.parse(calls[0].init.body).contents[0].parts[0].text)); });
  await t('rate limit answers 429 after 14 requests from one IP', async () => { const { handler } = load({ GEMINI_API_KEY: FAKE_KEY }); let last; for (let i = 0; i < 15; i++) last = await call(handler, req('POST', ask('fees ' + i))); assert.strictEqual(last.statusCode, 429); });
  await t('another IP is not affected by the limit', async () => { const { handler } = load({ GEMINI_API_KEY: FAKE_KEY }); for (let i = 0; i < 15; i++) await call(handler, req('POST', ask('fees ' + i))); const r = await call(handler, req('POST', ask('fees'), { 'x-real-ip': '198.51.100.9' })); assert.strictEqual(r.statusCode, 200); });
  await t('the request to Google has a timeout signal', async () => { const { handler, calls } = load({ GEMINI_API_KEY: FAKE_KEY }); await call(handler, req('POST', ask('fees?'))); assert(calls[0].init.signal); });
  await t('thinking is switched off, and a 400 retries once without it', async () => { let n = 0; const seen = []; const { handler } = load({ GEMINI_API_KEY: FAKE_KEY }, async (u, init) => { n++; seen.push(JSON.parse(init.body).generationConfig); return n === 1 ? { ok: false, status: 400, json: async () => ({}) } : { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Fine.' }] } }] }) }; }); const r = await call(handler, req('POST', ask('fees?'))); assert.strictEqual(r.statusCode, 200); assert.strictEqual(n, 2); assert.strictEqual(seen[0].thinkingConfig.thinkingBudget, 0); assert(!seen[1].thinkingConfig); });
  await t('a failing first model falls back to the second model', async () => { const urls = []; const { handler } = load({ GEMINI_API_KEY: FAKE_KEY }, async (u) => { urls.push(u); return urls.length === 1 ? { ok: false, status: 503, json: async () => ({}) } : { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Backup answer.' }] } }] }) }; }); const r = await call(handler, req('POST', ask('fees?'))); assert.strictEqual(r.statusCode, 200); assert(urls[0].includes('flash-lite-latest') && urls[1].includes('/gemini-flash-latest:')); assert.strictEqual(r.json().reply, 'Backup answer.'); });
  await t('both models failing answers 503 and logs the model and status only', async () => { logs.length = 0; const { handler } = load({ GEMINI_API_KEY: FAKE_KEY }, async () => ({ ok: false, status: 503, json: async () => ({}) })); const r = await call(handler, req('POST', ask('secret zzz'))); assert.strictEqual(r.statusCode, 503); const l = logs.join(' '); assert(l.includes('"model"') && l.includes('503')); assert(!l.includes('zzz')); });
  out(`\n${passed}/${passed + failed} passed`);
  process.exit(failed ? 1 : 0);
})();
