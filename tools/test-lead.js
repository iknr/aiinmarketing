/* Offline tests for api/lead.js. Run: node tools/test-lead.js
 * fetch is mocked; nothing here touches the network or any real Heffl account. */
const assert = require('assert');
const path = require('path');

const HANDLER = path.join(__dirname, '..', 'api', 'lead.js');
const FAKE_KEY = 'test-key-not-real';
const GOOD = {
  'form_fields[name]': 'Asha Verma',
  'form_fields[phone]': '+91 98765 43210',
  'form_fields[email]': 'asha@example.com',
  'form_fields[stage]': 'working professional',
  'form_fields[source]': 'magnet-syllabus',
  form_name: 'Syllabus',
  referer: 'https://aiinmarketing.in/index?utm_source=meta&utm_campaign=nov&x=1#top',
};
const SOURCES = { items: [{ id: 'src_web', name: 'Website' }, { id: 'src_ref', name: 'Referral' }] };
const STAGES = { items: [{ id: 'lstg_new', label: 'New', type: 'x', position: 0 }, { id: 'lstg_c', label: 'Contacted', type: 'x', position: 1 }] };

const logs = [];
console.log = (...a) => logs.push(['log', a.join(' ')]);
console.warn = (...a) => logs.push(['warn', a.join(' ')]);
console.error = (...a) => logs.push(['error', a.join(' ')]);
const out = (s) => process.stdout.write(s + '\n');

function resp(status, data, headers = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => data, headers: { get: (k) => headers[k.toLowerCase()] ?? null } };
}

/** Fresh module + env + mocked fetch. routes: fn(url, init) -> response | Promise | 'hang' */
function setup({ env = {}, route } = {}) {
  delete require.cache[require.resolve(HANDLER)];
  for (const k of ['HEFFL_API_KEY', 'HEFFL_LEAD_SOURCE_NAME', 'HEFFL_LEAD_STAGE_NAME', 'HEFFL_USE_CUSTOM_FIELDS', 'LEAD_WEBHOOK_URL', 'VERCEL_ENV', 'HEFFL_TIMEOUT_MS']) delete process.env[k];
  Object.assign(process.env, env);
  logs.length = 0;
  const calls = [];
  global.fetch = (url, init = {}) => {
    calls.push({ url, init, body: init.body ? JSON.parse(init.body) : undefined });
    const r = route(url, init, calls);
    if (r === 'hang') return new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
    return Promise.resolve(r);
  };
  return { handler: require(HANDLER), calls };
}

const okRoute = (extra = {}) => (url, init) => {
  if (url.endsWith('/leads/sources')) return resp(200, SOURCES);
  if (url.endsWith('/leads/stages')) return resp(200, STAGES);
  if (url.endsWith('/api/v1/leads')) return extra.lead ? extra.lead(url, init) : resp(200, { id: 'ld_1', number: 'L-1', name: 'x', archived: false, createdAt: 'now' });
  if (url.endsWith('/api/v2/tasks')) return extra.task ? extra.task() : resp(200, { id: 'tsk_1' });
  if (url === 'https://hook.test/x') return extra.hook ? extra.hook() : resp(200, {});
  throw new Error('unexpected url ' + url);
};

let ipN = 0;
function call(handler, { method = 'POST', body = GOOD, headers, ip } = {}) {
  ipN += 1;
  const req = {
    method,
    body,
    headers: { origin: 'https://aiinmarketing.in', 'x-forwarded-for': ip || `10.0.0.${ipN}, 1.2.3.4`, ...headers },
  };
  return new Promise((resolve) => {
    const res = {
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      status(c) { this.code = c; return this; },
      json(p) { resolve({ status: this.code, body: p }); },
    };
    handler(req, res);
  });
}
const uniq = (n) => ({ ...GOOD, 'form_fields[email]': `u${n}@example.com`, 'form_fields[phone]': String(9000000000 + n) });
const heffCalls = (calls) => calls.filter((c) => c.url.includes('heffl.com'));
const leadPosts = (calls) => calls.filter((c) => c.url.endsWith('/api/v1/leads') && c.init.method === 'POST');
const SUCCESS = { success: true, data: { message: 'Your submission was successful.' } };

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('valid submission: headers, URLs, body, +91, task with context, lookups cached', async () => {
  const { handler, calls } = setup({ env: { HEFFL_API_KEY: FAKE_KEY }, route: okRoute() });
  const r = await call(handler);
  assert.deepStrictEqual(r.body, SUCCESS);
  assert.strictEqual(r.status, 200);
  const h = heffCalls(calls);
  assert.deepStrictEqual(h.map((c) => c.url).sort(), [
    'https://api.heffl.com/api/v1/leads',
    'https://api.heffl.com/api/v1/leads/sources',
    'https://api.heffl.com/api/v1/leads/stages',
    'https://api.heffl.com/api/v2/tasks',
  ]);
  for (const c of h) assert.strictEqual(c.init.headers['x-api-key'], FAKE_KEY);
  const lead = leadPosts(calls)[0];
  assert.strictEqual(lead.init.headers['Content-Type'], 'application/json');
  assert.deepStrictEqual(lead.body, { name: 'Asha Verma', mobile: '+919876543210', email: 'asha@example.com', sourceId: 'src_web', stageId: 'lstg_new' });
  const task = calls.find((c) => c.url.endsWith('/api/v2/tasks'));
  assert.strictEqual(task.body.title, 'Follow up: Asha Verma (working professional, via magnet-syllabus)');
  assert.strictEqual(task.body.type, 'call');
  assert.strictEqual(task.body.priority, 'MEDIUM');
  assert.strictEqual(task.body.entity, 'leads');
  assert.strictEqual(task.body.entityId, 'ld_1');
  const due = Date.parse(task.body.dueDate) - Date.now();
  assert(due > 23.9 * 3600e3 && due < 24.1 * 3600e3, 'due in ~1 day');
  assert(task.body.description.includes('Page: https://aiinmarketing.in/index'));
  assert(!task.body.description.includes('x=1'), 'query stripped from page');
  assert(task.body.description.includes('Campaign / UTM: meta / - / nov / - / -; click id present: no; referrer: -; first landing: -; attribution: last'));
  // second submission: lookups come from cache
  await call(handler, { body: uniq(2) });
  assert.strictEqual(calls.filter((c) => c.url.endsWith('/leads/sources')).length, 1);
  assert.strictEqual(calls.filter((c) => c.url.endsWith('/leads/stages')).length, 1);
  assert.strictEqual(leadPosts(calls).length, 2);
  assert(!logs.some(([, m]) => m.includes(FAKE_KEY)), 'key never logged');
});

test('custom source/stage names from env', async () => {
  const { handler, calls } = setup({ env: { HEFFL_API_KEY: FAKE_KEY, HEFFL_LEAD_SOURCE_NAME: 'referral', HEFFL_LEAD_STAGE_NAME: 'Contacted' }, route: okRoute() });
  await call(handler);
  assert.strictEqual(leadPosts(calls)[0].body.sourceId, 'src_ref');
  assert.strictEqual(leadPosts(calls)[0].body.stageId, 'lstg_c');
});

test('custom fields mode: cf_* sent, no task when Heffl echoes them', async () => {
  const { handler, calls } = setup({
    env: { HEFFL_API_KEY: FAKE_KEY, HEFFL_USE_CUSTOM_FIELDS: 'true' },
    route: okRoute({ lead: () => resp(200, { id: 'ld_2', customFields: { x: 1 } }) }),
  });
  await call(handler);
  const b = leadPosts(calls)[0].body;
  assert.strictEqual(b.cf_current_situation, 'working professional');
  assert.strictEqual(b.cf_form_source, 'magnet-syllabus');
  assert.strictEqual(b.cf_page_url, 'https://aiinmarketing.in/index');
  assert.strictEqual(b.cf_campaign_utm, 'meta / - / nov / - / -; click id present: no; referrer: -; first landing: -; attribution: last');
  assert(!calls.some((c) => c.url.endsWith('/api/v2/tasks')));
});

test('custom fields mode: rejected (400) -> retry without cf_* and use the task', async () => {
  let n = 0;
  const { handler, calls } = setup({
    env: { HEFFL_API_KEY: FAKE_KEY, HEFFL_USE_CUSTOM_FIELDS: 'true' },
    route: okRoute({ lead: () => (++n === 1 ? resp(400, { code: 'BAD_REQUEST', message: 'Unknown field cf_form_source' }) : resp(200, { id: 'ld_3' })) }),
  });
  const r = await call(handler);
  assert.deepStrictEqual(r.body, SUCCESS);
  assert.strictEqual(leadPosts(calls).length, 2);
  assert(!Object.keys(leadPosts(calls)[1].body).some((k) => k.startsWith('cf_')));
  assert(calls.some((c) => c.url.endsWith('/api/v2/tasks')));
});

test('custom fields mode: accepted but not echoed -> task fallback', async () => {
  const { handler, calls } = setup({ env: { HEFFL_API_KEY: FAKE_KEY, HEFFL_USE_CUSTOM_FIELDS: 'true' }, route: okRoute({ lead: () => resp(200, { id: 'ld_4', customFields: null }) }) });
  await call(handler);
  assert(calls.some((c) => c.url.endsWith('/api/v2/tasks')));
});

test('no HEFFL_API_KEY: no Heffl call, log only', async () => {
  const { handler, calls } = setup({ route: okRoute() });
  const r = await call(handler);
  assert.deepStrictEqual(r.body, SUCCESS);
  assert.strictEqual(calls.length, 0);
  assert(logs.some(([l, m]) => l === 'log' && m.startsWith('lead (no LEAD_WEBHOOK_URL set)')));
});

test('no HEFFL_API_KEY with LEAD_WEBHOOK_URL: forwards as before, 502 when it fails', async () => {
  let s = setup({ env: { LEAD_WEBHOOK_URL: 'https://hook.test/x' }, route: okRoute() });
  let r = await call(s.handler);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(s.calls.length, 1);
  assert.strictEqual(s.calls[0].body.phone, '9876543210');
  s = setup({ env: { LEAD_WEBHOOK_URL: 'https://hook.test/x' }, route: okRoute({ hook: () => resp(500, {}) }) });
  r = await call(s.handler);
  assert.strictEqual(r.status, 502);
});

test('lookup failure: lead still created without sourceId/stageId, warning logged', async () => {
  const { handler, calls } = setup({
    env: { HEFFL_API_KEY: FAKE_KEY },
    route: (url, init) => (url.includes('/leads/s') ? resp(500, {}) : okRoute()(url, init)),
  });
  const r = await call(handler);
  assert.deepStrictEqual(r.body, SUCCESS);
  assert.deepStrictEqual(leadPosts(calls)[0].body, { name: 'Asha Verma', mobile: '+919876543210', email: 'asha@example.com' });
  assert(logs.some(([l, m]) => l === 'warn' && m.includes('heffl_lookup_failed')));
});

test('name not found in Heffl: that id omitted', async () => {
  const { handler, calls } = setup({ env: { HEFFL_API_KEY: FAKE_KEY, HEFFL_LEAD_STAGE_NAME: 'Nope' }, route: okRoute() });
  await call(handler);
  assert.strictEqual(leadPosts(calls)[0].body.sourceId, 'src_web');
  assert.strictEqual(leadPosts(calls)[0].body.stageId, undefined);
});

test('timeout: visitor still gets success, lead_crm_failed logged, webhook fallback', async () => {
  const { handler, calls } = setup({
    env: { HEFFL_API_KEY: FAKE_KEY, HEFFL_TIMEOUT_MS: '300', LEAD_WEBHOOK_URL: 'https://hook.test/x' },
    route: (url, init) => (url.includes('heffl.com') ? 'hang' : okRoute()(url, init)),
  });
  const t0 = Date.now();
  const r = await call(handler);
  assert(Date.now() - t0 < 1500, 'bounded wait');
  assert.deepStrictEqual(r.body, SUCCESS);
  const line = logs.find(([l, m]) => l === 'error' && m.includes('lead_crm_failed'));
  assert(line, 'structured error');
  const parsed = JSON.parse(line[1]);
  assert.strictEqual(parsed.code, 'timeout');
  assert.strictEqual(parsed.lead.email, 'asha@example.com');
  assert(!line[1].includes(FAKE_KEY));
  assert.strictEqual(calls.filter((c) => c.url === 'https://hook.test/x').length, 1);
});

for (const code of [401, 403]) {
  test(`${code}: logs "check HEFFL_API_KEY permissions", success to visitor, recovery`, async () => {
    const { handler } = setup({
      env: { HEFFL_API_KEY: FAKE_KEY },
      route: okRoute({ lead: () => resp(code, { code: code === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN', message: 'no' }) }),
    });
    const r = await call(handler);
    assert.deepStrictEqual(r.body, SUCCESS);
    assert(logs.some(([, m]) => m.includes('check HEFFL_API_KEY permissions')));
    const f = JSON.parse(logs.find(([, m]) => m.includes('lead_crm_failed'))[1]);
    assert.strictEqual(f.status, code);
  });
}

test('429 with reset hint < 2 s: single retry then success', async () => {
  let n = 0;
  const { handler, calls } = setup({
    env: { HEFFL_API_KEY: FAKE_KEY },
    route: okRoute({ lead: () => (++n === 1 ? resp(429, { code: 'TOO_MANY_REQUESTS' }, { 'ratelimit-reset': '1' }) : resp(200, { id: 'ld_5' })) }),
  });
  const r = await call(handler);
  assert.deepStrictEqual(r.body, SUCCESS);
  assert.strictEqual(leadPosts(calls).length, 2);
  assert(!logs.some(([, m]) => m.includes('lead_crm_failed')));
});

test('429 with reset hint >= 2 s: no retry, treated as failure', async () => {
  const { handler, calls } = setup({
    env: { HEFFL_API_KEY: FAKE_KEY },
    route: okRoute({ lead: () => resp(429, { code: 'TOO_MANY_REQUESTS' }, { 'ratelimit-reset': '30' }) }),
  });
  const r = await call(handler);
  assert.deepStrictEqual(r.body, SUCCESS);
  assert.strictEqual(leadPosts(calls).length, 1);
  assert.strictEqual(JSON.parse(logs.find(([, m]) => m.includes('lead_crm_failed'))[1]).status, 429);
});

test('duplicate (409 and 400 duplicate message): logged as duplicate_lead, success, no retry, no task', async () => {
  for (const dup of [() => resp(409, { code: 'CONFLICT' }), () => resp(400, { code: 'BAD_REQUEST', message: 'Lead already exists with this email' })]) {
    const { handler, calls } = setup({ env: { HEFFL_API_KEY: FAKE_KEY, LEAD_WEBHOOK_URL: 'https://hook.test/x' }, route: okRoute({ lead: dup }) });
    const r = await call(handler);
    assert.deepStrictEqual(r.body, SUCCESS);
    assert.strictEqual(leadPosts(calls).length, 1);
    assert(logs.some(([, m]) => m.includes('duplicate_lead')));
    assert(!logs.some(([, m]) => m.includes('lead_crm_failed')));
    assert(!calls.some((c) => c.url.endsWith('/tasks') || c.url === 'https://hook.test/x'));
  }
});

test('Heffl 500 without LEAD_WEBHOOK_URL: success + structured log only', async () => {
  const { handler, calls } = setup({ env: { HEFFL_API_KEY: FAKE_KEY }, route: okRoute({ lead: () => resp(500, { code: 'INTERNAL_SERVER_ERROR' }) }) });
  const r = await call(handler);
  assert.deepStrictEqual(r.body, SUCCESS);
  const f = JSON.parse(logs.find(([, m]) => m.includes('lead_crm_failed'))[1]);
  assert.deepStrictEqual([f.event, f.status, f.code, f.lead.phone, f.lead.name], ['lead_crm_failed', 500, 'INTERNAL_SERVER_ERROR', '9876543210', 'Asha Verma']);
  assert(!calls.some((c) => c.url.includes('hook.test')));
});

test('Heffl 500 with LEAD_WEBHOOK_URL: lead posted to the webhook', async () => {
  const { handler, calls } = setup({ env: { HEFFL_API_KEY: FAKE_KEY, LEAD_WEBHOOK_URL: 'https://hook.test/x' }, route: okRoute({ lead: () => resp(500, {}) }) });
  const r = await call(handler);
  assert.deepStrictEqual(r.body, SUCCESS);
  const hook = calls.filter((c) => c.url === 'https://hook.test/x');
  assert.strictEqual(hook.length, 1);
  assert.strictEqual(hook[0].body.email, 'asha@example.com');
  assert.strictEqual(hook[0].body.crmFailed.status, 500);
  assert(!JSON.stringify(hook[0]).includes(FAKE_KEY));
});

test('bad origin / referer rules', async () => {
  const { handler, calls } = setup({ env: { HEFFL_API_KEY: FAKE_KEY }, route: okRoute() });
  const bad = { success: false, data: { message: 'Please check your details and try again.' } };
  for (const headers of [
    { origin: 'https://evil.example' },
    { origin: 'https://aiinmarketing.in.evil.example' },
    { origin: undefined, referer: undefined },
    { origin: undefined, referer: 'https://evil.example/a' },
    { origin: 'null' },
    { origin: 'http://localhost:3000' }, // production
  ]) {
    process.env.VERCEL_ENV = 'production';
    const r = await call(handler, { headers });
    assert.strictEqual(r.status, 400, JSON.stringify(headers));
    assert.deepStrictEqual(r.body, bad);
  }
  // no Unqualified stage in this mock: abuse records are skipped, never created as New leads, no task
  assert.strictEqual(leadPosts(calls).length, 0);
  assert(!calls.some((c) => c.url.endsWith('/api/v2/tasks')));
  assert.strictEqual((await call(handler, { body: uniq(11), headers: { origin: undefined, referer: 'https://www.aiinmarketing.in/x' } })).status, 200);
  assert.strictEqual((await call(handler, { body: uniq(12), headers: { origin: 'https://www.aiinmarketing.in' } })).status, 200);
  process.env.VERCEL_ENV = 'preview';
  assert.strictEqual((await call(handler, { body: uniq(13), headers: { origin: 'http://localhost:3000' } })).status, 200);
});

test('rate limit: 6th submission from one IP in 10 minutes gets 429, other IPs unaffected', async () => {
  const { handler, calls } = setup({ env: { HEFFL_API_KEY: FAKE_KEY }, route: okRoute() });
  for (let i = 1; i <= 5; i++) assert.strictEqual((await call(handler, { body: uniq(100 + i), ip: '9.9.9.9' })).status, 200);
  const r = await call(handler, { body: uniq(106), ip: '9.9.9.9, 8.8.8.8' });
  assert.strictEqual(r.status, 429);
  assert.strictEqual(r.body.success, false);
  assert.strictEqual(leadPosts(calls).length, 2, 'the 3rd to 5th different identity from one IP are same_ip_multiple, not real leads');
  assert.strictEqual((await call(handler, { body: uniq(107), ip: '9.9.9.10' })).status, 200);
  // spoofed long header is capped, first value used
  assert.strictEqual((await call(handler, { body: uniq(108), ip: 'a'.repeat(500) })).status, 200);
});

test('exact repeat of email+phone within 60 s: success, no second CRM call', async () => {
  const { handler, calls } = setup({ env: { HEFFL_API_KEY: FAKE_KEY }, route: okRoute() });
  assert.strictEqual((await call(handler)).status, 200);
  const before = calls.length;
  const r = await call(handler);
  assert.deepStrictEqual(r.body, SUCCESS);
  assert.strictEqual(calls.length, before);
});

test('invalid input keeps the existing 400s', async () => {
  const { handler, calls } = setup({ env: { HEFFL_API_KEY: FAKE_KEY }, route: okRoute() });
  const bad = { success: false, data: { message: 'Please check your details and try again.' } };
  for (const patch of [
    { 'form_fields[name]': 'A' },
    { 'form_fields[phone]': '12345' },
    { 'form_fields[phone]': '5876543210' },
    { 'form_fields[email]': 'nope' },
    { 'form_fields[email]': undefined },
  ]) {
    const r = await call(handler, { body: { ...GOOD, ...patch } });
    assert.strictEqual(r.status, 400);
    assert.deepStrictEqual(r.body, bad);
  }
  assert.strictEqual((await call(handler, { body: null })).status, 400);
  assert.strictEqual(calls.length, 0);
});

test('control characters stripped and lengths capped before Heffl', async () => {
  const { handler, calls } = setup({ env: { HEFFL_API_KEY: FAKE_KEY }, route: okRoute() });
  await call(handler, { body: { ...GOOD, 'form_fields[name]': 'Asha\u0000\n\u0007 ' + 'V'.repeat(300) } });
  const n = leadPosts(calls)[0].body.name;
  assert(!/[\u0000-\u001f]/.test(n));
  assert(n.length <= 100);
});

test('GET and other methods: 405 JSON', async () => {
  const { handler, calls } = setup({ env: { HEFFL_API_KEY: FAKE_KEY }, route: okRoute() });
  for (const method of ['GET', 'PUT', 'OPTIONS']) {
    const r = await call(handler, { method, headers: { origin: 'https://evil.example' } });
    assert.strictEqual(r.status, 405);
    assert.deepStrictEqual(r.body, { success: false, data: { message: 'Method not allowed.' } });
  }
  assert.strictEqual(calls.length, 0);
});


// ------------------------------------------------------------ v2: failure task, abuse, IP/geo, IST, labels
const taskCalls = (calls) => calls.filter((c) => c.url.endsWith('/api/v2/tasks'));
const abuseLeads = (calls) => leadPosts(calls).filter((c) => String(c.body.title || '').startsWith('ABUSE: '));
const STAGES_U = { items: [...STAGES.items, { id: 'lstg_unq', label: 'Unqualified', type: 'x', position: 9 }] };
const abuseRoute = (extra = {}) => (url, init, calls) =>
  url.endsWith('/leads/stages') ? resp(200, STAGES_U) : okRoute(extra)(url, init, calls);
const setupAbuse = (extra = {}, env = {}) => setup({ env: { HEFFL_API_KEY: FAKE_KEY, ...env }, route: abuseRoute(extra) });

test('A) 400 from Heffl -> one HIGH todo task "Lead capture failed", no webhook, visitor sees success', async () => {
  const { handler, calls } = setupAbuse({ lead: () => resp(400, { code: 'BAD_REQUEST', message: 'Invalid mobile' }) }, { LEAD_WEBHOOK_URL: 'https://hook.test/x' });
  const r = await call(handler);
  assert.deepStrictEqual(r.body, SUCCESS);
  const t = taskCalls(calls);
  assert.strictEqual(t.length, 1);
  assert.strictEqual(t[0].body.title, 'Lead capture failed: Asha Verma, +919876543210, magnet-syllabus');
  assert.strictEqual(t[0].body.type, 'todo');
  assert.strictEqual(t[0].body.priority, 'HIGH');
  assert(Math.abs(Date.parse(t[0].body.dueDate) - Date.now()) < 5000, 'due today');
  assert(!('entityId' in t[0].body));
  assert(t[0].body.description.includes('asha@example.com'));
  assert(!calls.some((c) => c.url === 'https://hook.test/x'));
  assert(!logs.some(([, m]) => m.includes('"lead_crm_failed"')));
});

test('A) failure task also failing -> webhook + lead_crm_failed fallback kept', async () => {
  const { handler, calls } = setupAbuse({ lead: () => resp(422, { code: 'X' }), task: () => resp(500, {}) }, { LEAD_WEBHOOK_URL: 'https://hook.test/x' });
  const r = await call(handler);
  assert.deepStrictEqual(r.body, SUCCESS);
  assert.strictEqual(taskCalls(calls).length, 1);
  assert.strictEqual(calls.filter((c) => c.url === 'https://hook.test/x').length, 1);
  assert(logs.some(([l, m]) => l === 'error' && m.includes('"lead_crm_failed"')));
});

test('A) no failure task for unreachable Heffl, 401/403/429, 5xx', async () => {
  for (const lead of [() => resp(401, {}), () => resp(403, {}), () => resp(429, {}, { 'ratelimit-reset': '30' }), () => resp(503, {})]) {
    const { handler, calls } = setupAbuse({ lead });
    await call(handler);
    assert.strictEqual(taskCalls(calls).length, 0);
    assert(logs.some(([, m]) => m.includes('"lead_crm_failed"')));
  }
  const s = setup({ env: { HEFFL_API_KEY: FAKE_KEY, HEFFL_TIMEOUT_MS: '300' }, route: (url, init) => (url.includes('heffl.com') ? 'hang' : okRoute()(url, init)) });
  await call(s.handler);
  assert.strictEqual(taskCalls(s.calls).length, 0);
});

test('B) repeat within 60 s -> Unqualified lead "ABUSE: repeat_within_60s", no task, same response', async () => {
  const { handler, calls } = setupAbuse();
  await call(handler);
  const r = await call(handler, { headers: { 'x-real-ip': '203.0.113.9', 'x-vercel-ip-country': 'IN', 'x-vercel-ip-country-region': 'KL', 'x-vercel-ip-city': 'Kochi' } });
  assert.deepStrictEqual(r.body, SUCCESS);
  assert.strictEqual(r.status, 200);
  const a = abuseLeads(calls);
  assert.strictEqual(a.length, 1);
  assert.strictEqual(a[0].body.stageId, 'lstg_unq');
  assert.notStrictEqual(a[0].body.stageId, 'lstg_new');
  assert.strictEqual(a[0].body.title, 'ABUSE: repeat_within_60s | IP 203.0.113.9 | IN, KL, Kochi | src=meta cmp=nov');
  assert.strictEqual(taskCalls(calls).length, 1, 'only the first, real lead has its follow-up task');
});

test('B) repeat abuse record falls back to contact-in-title when Heffl rejects the duplicate contact', async () => {
  let n = 0;
  const { handler, calls } = setupAbuse({ lead: () => (++n === 2 ? resp(409, { code: 'CONFLICT' }) : resp(200, { id: 'ld_' + n })) });
  await call(handler);
  await call(handler);
  const a = abuseLeads(calls);
  assert.strictEqual(a.length, 2, 'first attempt (duplicate) + retry without contact');
  assert.deepStrictEqual(Object.keys(a[0].body).sort(), ['email', 'mobile', 'name', 'sourceId', 'stageId', 'title']);
  assert.deepStrictEqual(Object.keys(a[1].body).sort(), ['name', 'sourceId', 'stageId', 'title']);
  assert(a[1].body.title.startsWith('ABUSE: repeat_within_60s | IP ') && a[1].body.title.includes('| asha@example.com +919876543210 |'));
  assert.strictEqual(a[1].body.stageId, 'lstg_unq');
});

test('B) bad_origin and rate_limit records; responses unchanged (400 / 429)', async () => {
  const { handler, calls } = setupAbuse();
  const r1 = await call(handler, { headers: { origin: 'https://evil.example' } });
  assert.strictEqual(r1.status, 400);
  for (let i = 1; i <= 5; i++) await call(handler, { body: uniq(300 + i), ip: '7.7.7.7' });
  const r2 = await call(handler, { body: uniq(306), ip: '7.7.7.7' });
  assert.strictEqual(r2.status, 429);
  assert.deepStrictEqual(r2.body, { success: false, data: { message: 'Too many submissions. Please try again in a few minutes.' } });
  const titles = abuseLeads(calls).map((c) => c.body.title.split(' | ')[0]);
  assert.deepStrictEqual(titles, ['ABUSE: bad_origin', 'ABUSE: same_ip_multiple', 'ABUSE: same_ip_multiple', 'ABUSE: same_ip_multiple', 'ABUSE: rate_limit']);
  for (const c of abuseLeads(calls)) assert.strictEqual(c.body.stageId, 'lstg_unq');
  assert.strictEqual(taskCalls(calls).length, 2, 'tasks only for the 2 real leads');
});

test('B) bot_user_agent: flagged for automation UAs, silent success; normal browsers and missing UA are not', async () => {
  const { handler, calls } = setupAbuse();
  const uas = ['curl/8.4.0', 'python-requests/2.31', 'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0 Safari/537.36', 'Go-http-client/2.0'];
  for (let i = 0; i < uas.length; i++) {
    const r = await call(handler, { body: uniq(400 + i), headers: { 'user-agent': uas[i] } });
    assert.deepStrictEqual(r.body, SUCCESS);
  }
  assert.strictEqual(abuseLeads(calls).length, 4);
  assert(abuseLeads(calls).every((c) => c.body.title.startsWith('ABUSE: bot_user_agent')));
  assert.strictEqual(taskCalls(calls).length, 0);
  const ok = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1';
  await call(handler, { body: uniq(410), headers: { 'user-agent': ok } });
  await call(handler, { body: uniq(411) });
  assert.strictEqual(abuseLeads(calls).length, 4);
  assert.strictEqual(taskCalls(calls).length, 2);
});

test('B) abuse records: capped at 20 per hour (then only logged), invalid input skipped, no key -> no Heffl call', async () => {
  const { handler, calls } = setupAbuse();
  for (let i = 0; i < 25; i++) await call(handler, { body: uniq(500 + i), headers: { origin: 'https://evil.example' } });
  assert.strictEqual(abuseLeads(calls).length, 20);
  assert(logs.some(([, m]) => m.includes('abuse_record_skipped') && m.includes('hourly cap')));
  const before = calls.length;
  for (const patch of [{ 'form_fields[name]': 'A' }, { 'form_fields[phone]': '123' }, { 'form_fields[email]': 'nope' }]) {
    const r = await call(handler, { body: { ...GOOD, ...patch }, headers: { origin: 'https://evil.example' } });
    assert.strictEqual(r.status, 400);
  }
  assert.strictEqual(calls.length, before, 'invalid input never reaches Heffl');
  const s = setup({ route: okRoute() });
  await call(s.handler, { headers: { origin: 'https://evil.example' } });
  assert.strictEqual(s.calls.length, 0);
});

test('B) no Unqualified stage in Heffl: nothing created (never falls back to New)', async () => {
  const { handler, calls } = setup({ env: { HEFFL_API_KEY: FAKE_KEY }, route: okRoute() });
  await call(handler, { headers: { origin: 'https://evil.example' } });
  assert.strictEqual(leadPosts(calls).length, 0);
  assert(logs.some(([, m]) => m.includes('abuse_record_skipped')));
});

test('C) IP/geo capture: task text, structured log, never in the response', async () => {
  const { handler, calls } = setupAbuse({ lead: () => resp(500, {}) });
  const h = { 'x-real-ip': '203.0.113.7', 'x-vercel-ip-country': 'in', 'x-vercel-ip-country-region': 'KL', 'x-vercel-ip-city': 'Thiruvananthapuram%20North' };
  const r = await call(handler, { headers: h });
  assert(!JSON.stringify(r).includes('203.0.113.7'));
  const f = JSON.parse(logs.find(([, m]) => m.includes('"lead_crm_failed"'))[1]);
  assert.deepStrictEqual([f.ip, f.country, f.region, f.city, f.abuse], ['203.0.113.7', 'IN', 'KL', 'Thiruvananthapuram North', null]);
  assert.strictEqual(f.lead.ip, '203.0.113.7');
  const ok = setupAbuse();
  await call(ok.handler, { headers: h });
  const d = taskCalls(ok.calls)[0].body.description;
  assert(d.includes('IP address: 203.0.113.7') && d.includes('Approximate location: Thiruvananthapuram North, KL, IN'));
  // custom fields mode carries them too
  const cf = setupAbuse({ lead: () => resp(200, { id: 'ld_9', customFields: { a: 1 } }) }, { HEFFL_USE_CUSTOM_FIELDS: 'true' });
  await call(cf.handler, { headers: h });
  const b = leadPosts(cf.calls)[0].body;
  assert.deepStrictEqual([b.cf_ip_address, b.cf_country, b.cf_region, b.cf_city], ['203.0.113.7', 'IN', 'KL', 'Thiruvananthapuram North']);
});

test('C) IP header parsing: order, hops, IPv6, garbage, missing', async () => {
  const seen = async (headers, socket) => {
    const { handler } = setup({ env: { HEFFL_API_KEY: FAKE_KEY }, route: okRoute() });
    const req = { method: 'POST', body: GOOD, headers: { origin: 'https://aiinmarketing.in', 'x-vercel-ip-city': '%E0%A4', ...headers }, socket };
    // run twice: the abuse log of a rejected-origin copy exposes the parsed ip without any Heffl state
    logs.length = 0;
    await new Promise((resolve) => handler({ ...req, headers: { ...req.headers, origin: 'https://evil.example' } }, { setHeader() {}, status() { return this; }, json: resolve }));
    return JSON.parse(logs.find(([, m]) => m.includes('abuse_flagged'))[1]);
  };
  assert.strictEqual((await seen({ 'x-real-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' })).ip, '1.1.1.1', 'x-real-ip first');
  assert.strictEqual((await seen({ 'x-forwarded-for': ' 2.2.2.2 , 3.3.3.3, 4.4.4.4' })).ip, '2.2.2.2', 'first of several hops, trimmed');
  assert.strictEqual((await seen({ 'x-real-ip': '2001:db8::1' })).ip, '2001:db8::1', 'IPv6');
  assert.strictEqual((await seen({ 'x-forwarded-for': '2001:db8::ff00:42:8329, 1.2.3.4' })).ip, '2001:db8::ff00:42:8329');
  assert.strictEqual((await seen({ 'x-real-ip': 'garbage', 'x-forwarded-for': '5.5.5.5' })).ip, '5.5.5.5', 'invalid x-real-ip falls through');
  assert.strictEqual((await seen({ 'x-real-ip': '999.1.1.1', 'x-forwarded-for': 'not-an-ip, 6.6.6.6' })).ip, '', 'garbage only');
  assert.strictEqual((await seen({ 'x-real-ip': '1'.repeat(50) })).ip, '', 'over 45 chars');
  assert.strictEqual((await seen({ 'x-forwarded-for': '<script>alert(1)</script>' })).ip, '');
  assert.strictEqual((await seen({})).ip, '', 'missing headers');
  assert.strictEqual((await seen({}, { remoteAddress: '9.9.9.9' })).ip, '9.9.9.9', 'socket fallback');
  const g = await seen({ 'x-vercel-ip-country': 'IND', 'x-vercel-ip-country-region': 'K<L>' });
  assert.deepStrictEqual([g.country, g.region, g.city], ['', 'KL', '%E0%A4'], 'bad country dropped, region sanitised, undecodable city kept raw');
});

test('D) submission time is shown in IST (task text), ISO UTC stays in logs', async () => {
  const realNow = Date.now;
  Date.now = () => Date.parse('2026-11-03T20:45:00Z'); // 4 Nov 2026, 2:15 AM IST
  try {
    const ok = setupAbuse();
    await call(ok.handler);
    assert(taskCalls(ok.calls)[0].body.description.includes('Submitted: 4 Nov 2026, 2:15 AM IST'));
    const bad = setupAbuse({ lead: () => resp(500, {}) });
    await call(bad.handler);
    assert.strictEqual(JSON.parse(logs.find(([, m]) => m.includes('"lead_crm_failed"'))[1]).lead.receivedAt, '2026-11-03T20:45:00.000Z');
    Date.now = () => Date.parse('2026-12-31T18:30:00Z'); // 1 Jan 2027, 12:00 AM IST
    const ny = setupAbuse();
    await call(ny.handler, { body: uniq(600) });
    assert(taskCalls(ny.calls)[0].body.description.includes('Submitted: 1 Jan 2027, 12:00 AM IST'));
    Date.now = () => Date.parse('2026-11-04T07:30:00Z'); // 1:00 PM IST
    const pm = setupAbuse();
    await call(pm.handler, { body: uniq(601) });
    assert(taskCalls(pm.calls)[0].body.description.includes('Submitted: 4 Nov 2026, 1:00 PM IST'));
  } finally {
    Date.now = realNow;
  }
});

test('D) friendly labels in task title and text; unknown names fall back to the raw value', async () => {
  const cases = [
    [{ form_name: 'dm_by_adsmentor_apply', 'form_fields[source]': undefined }, 'Apply form'],
    [{ form_name: 'magnet_syllabus', 'form_fields[source]': undefined }, 'Free guide: 12-week syllabus'],
    [{ form_name: 'magnet_checklist', 'form_fields[source]': undefined }, 'Free guide: 5-question course checklist'],
    [{ form_name: 'magnet_ad_account', 'form_fields[source]': undefined }, 'Free guide: ad account ownership checklist'],
    [{ form_name: 'magnet_brochure', 'form_fields[source]': undefined }, 'Brochure download'],
    [{ form_name: 'magnet_syllabus', 'form_fields[source]': 'magnet-rtcros-prompt-guide' }, 'Free guide: RTCROS prompt guide'],
    [{ form_name: 'x', 'form_fields[source]': 'magnet-meta-mcp-cli-sop' }, 'Free guide: Meta Ads MCP and CLI SOP'],
    [{ form_name: 'mystery_form', 'form_fields[source]': undefined }, 'mystery_form'],
    [{ form_name: 'mystery_form', 'form_fields[source]': 'new-source' }, 'new-source'],
  ];
  let n = 700;
  for (const [patch, label] of cases) {
    const { handler, calls } = setupAbuse();
    await call(handler, { body: { ...uniq(n++), ...patch } });
    const t = taskCalls(calls)[0].body;
    assert.strictEqual(t.title, `Follow up: Asha Verma (working professional, via ${label})`);
    assert(t.description.includes(`Form: ${label}`));
  }
});

// ------------------------------------------------------------ attribution (UTM / click id / referrer / landing path)
const ATTR_BODY = {
  'form_fields[utm_source]': 'google',
  'form_fields[utm_medium]': 'cpc',
  'form_fields[utm_campaign]': 'spring',
  'form_fields[utm_term]': 'ai marketing course',
  'form_fields[utm_content]': 'ad-a',
  'form_fields[click_id]': 'gclid:ABCDEF123456XYZ',
  'form_fields[referrer_host]': 'www.google.com',
  'form_fields[landing_path]': '/blog/post',
  'form_fields[attribution]': 'first',
};
const H = { 'x-real-ip': '203.0.113.50', 'x-vercel-ip-country': 'IN', 'x-vercel-ip-country-region': 'KL', 'x-vercel-ip-city': 'Kochi' };
const wholeLogs = () => logs.map(([, m]) => m).join('\n');

test('E) real lead: follow-up task carries the full campaign line; click id value never in Heffl text or logs', async () => {
  const { handler, calls } = setupAbuse();
  await call(handler, { body: { ...GOOD, ...ATTR_BODY } });
  const d = taskCalls(calls)[0].body.description;
  assert(d.includes('Campaign / UTM: google / cpc / spring / ai marketing course / ad-a; click id present: yes; referrer: www.google.com; first landing: /blog/post; attribution: first'));
  assert(!JSON.stringify(calls).includes('ABCDEF123456XYZ'));
  assert(!wholeLogs().includes('ABCDEF123456XYZ'));
});

test('E) sanitisation and caps of attribution fields; own host dropped; bad attribution value ignored', async () => {
  const { handler, calls } = setupAbuse();
  await call(handler, { body: { ...GOOD, 'form_fields[utm_source]': '<script>alert(1)</script>\u0001x'.padEnd(300, 'y'), 'form_fields[referrer_host]': 'www.aiinmarketing.in', 'form_fields[attribution]': 'weird', 'form_fields[landing_path]': 'no-slash', 'form_fields[click_id]': 'evil:123', referer: 'https://aiinmarketing.in/' } });
  const d = taskCalls(calls)[0].body.description;
  const line = d.split('\n').find((l) => l.startsWith('Campaign / UTM:'));
  assert(!/[<>\u0001]/.test(line));
  assert(line.split(' / ')[0].length <= 'Campaign / UTM: '.length + 120 + 3);
  assert(line.includes('click id present: no; referrer: -; first landing: -; attribution: last'));
});

test('E) referer fallback: utm_* and click ids parsed from the Referer URL when the fields are missing', async () => {
  const { handler, calls } = setupAbuse();
  await call(handler, { body: { ...GOOD, referer: 'https://aiinmarketing.in/p?utm_source=meta&utm_medium=social&utm_campaign=c1&fbclid=FB1234567890' } });
  const d = taskCalls(calls)[0].body.description;
  assert(d.includes('Campaign / UTM: meta / social / c1 / - / -; click id present: yes; referrer: -; first landing: -; attribution: last'));
  assert(!JSON.stringify(calls).includes('FB1234567890'));
  // fields win over the referer
  const b = setupAbuse();
  await call(b.handler, { body: { ...uniq(801), 'form_fields[utm_source]': 'fromfield', referer: 'https://aiinmarketing.in/?utm_source=fromreferer' } });
  assert(taskCalls(b.calls)[0].body.description.includes('Campaign / UTM: fromfield /'));
  // no data at all -> direct
  const c = setupAbuse();
  await call(c.handler, { body: { ...uniq(802), referer: 'https://aiinmarketing.in/' } });
  assert(taskCalls(c.calls)[0].body.description.includes('Campaign / UTM: - / - / - / - / -; click id present: no; referrer: -; first landing: -; attribution: direct'));
});

test('E) abuse title: exact format, empty parts omitted', async () => {
  const { handler, calls } = setupAbuse();
  await call(handler, { body: { ...GOOD, ...ATTR_BODY, referer: 'https://aiinmarketing.in/' }, headers: { ...H, origin: 'https://evil.example' } });
  const a = abuseLeads(calls);
  assert.strictEqual(a.length, 1);
  assert.strictEqual(a[0].body.title, 'ABUSE: bad_origin | IP 203.0.113.50 | IN, KL, Kochi | src=google med=cpc cmp=spring | ref=www.google.com | term=ai marketing course content=ad-a click=gclid | land=/blog/post');
  assert.strictEqual(a[0].body.stageId, 'lstg_unq');
  const b = setupAbuse();
  await call(b.handler, { headers: { 'x-real-ip': '198.51.100.4', origin: 'https://evil.example' }, body: { ...GOOD, referer: 'https://evil.example/' } });
  assert.strictEqual(abuseLeads(b.calls)[0].body.title, 'ABUSE: bad_origin | IP 198.51.100.4');
});

test('E) abuse title is cut from the right at 190 chars; type and IP always survive', async () => {
  const { handler, calls } = setupAbuse();
  const long = 'z'.repeat(120);
  await call(handler, { body: { ...GOOD, ...ATTR_BODY, 'form_fields[utm_source]': long, 'form_fields[utm_medium]': long, 'form_fields[utm_campaign]': long, 'form_fields[referrer_host]': 'a.example' }, headers: { ...H, origin: 'https://evil.example' } });
  const t = abuseLeads(calls)[0].body.title;
  assert.strictEqual(t.length, 190);
  assert(t.startsWith('ABUSE: bad_origin | IP 203.0.113.50 | IN, KL, Kochi | src=zzz'));
  // the duplicate-contact retry keeps the same cap and the leading parts
  let n = 0;
  const d = setupAbuse({ lead: () => (++n === 1 ? resp(409, {}) : resp(200, { id: 'ld_x' })) });
  await call(d.handler, { body: { ...GOOD, ...ATTR_BODY, 'form_fields[utm_source]': long, 'form_fields[utm_medium]': long }, headers: { ...H, origin: 'https://evil.example' } });
  const t2 = abuseLeads(d.calls)[1].body.title;
  assert(t2.length <= 190 && t2.startsWith('ABUSE: bad_origin | IP 203.0.113.50 | asha@example.com +919876543210 |'));
});

test('E) abuse records carry IP and UTM for bad_origin, rate_limit, repeat_within_60s and bot_user_agent (and logs)', async () => {
  const { handler, calls } = setupAbuse();
  const full = { ...ATTR_BODY };
  await call(handler, { body: { ...uniq(900), ...full }, headers: { ...H, origin: 'https://evil.example' } });
  for (let i = 1; i <= 5; i++) await call(handler, { body: { ...uniq(910 + i), ...full }, ip: '9.9.9.9', headers: { 'x-real-ip': '9.9.9.9' } });
  await call(handler, { body: { ...uniq(920), ...full }, headers: { 'x-real-ip': '9.9.9.9' } }); // rate limited
  await call(handler, { body: { ...uniq(930), ...full }, headers: H });
  await call(handler, { body: { ...uniq(930), ...full }, headers: H }); // repeat
  await call(handler, { body: { ...uniq(940), ...full }, headers: { ...H, 'user-agent': 'curl/8.4.0' } });
  const types = abuseLeads(calls).map((c) => c.body.title.split(' | ')[0]);
  assert.deepStrictEqual(types, ['ABUSE: bad_origin', 'ABUSE: same_ip_multiple', 'ABUSE: same_ip_multiple', 'ABUSE: same_ip_multiple', 'ABUSE: rate_limit', 'ABUSE: repeat_within_60s', 'ABUSE: bot_user_agent']);
  const ips = ['203.0.113.50', '9.9.9.9', '9.9.9.9', '9.9.9.9', '9.9.9.9', '203.0.113.50', '203.0.113.50'];
  abuseLeads(calls).forEach((c, i) => {
    assert(c.body.title.includes(` | IP ${ips[i]}`), c.body.title);
    assert(c.body.title.includes('src=google med=cpc cmp=spring'), c.body.title);
    assert(!c.body.title.includes('ABCDEF123456XYZ'));
  });
  const flagged = logs.filter(([, m]) => m.includes('"abuse_flagged"')).map(([, m]) => JSON.parse(m));
  assert.strictEqual(flagged.length, 7);
  for (const f of flagged) {
    assert(f.ip && f.campaign.utm_source === 'google' && f.campaign.utm_campaign === 'spring');
    assert.strictEqual(f.campaign.click, 'gclid:ABCDEF');
  }
  assert.strictEqual(flagged[0].country, 'IN');
  assert(!wholeLogs().includes('ABCDEF123456XYZ'), 'click id value redacted to type + first 6 chars');
});

test('E) abuse records without any UTM (bots) still carry IP and geo; rejected requests log IP too', async () => {
  const { handler, calls } = setupAbuse();
  await call(handler, { body: { ...GOOD, referer: 'https://aiinmarketing.in/' }, headers: { ...H, 'user-agent': 'python-requests/2.31' } });
  assert.strictEqual(abuseLeads(calls)[0].body.title, 'ABUSE: bot_user_agent | IP 203.0.113.50 | IN, KL, Kochi');
  // bad origin, even with invalid input: nothing sent to Heffl, but IP/geo/campaign are logged
  logs.length = 0;
  const r = await call(handler, { body: { 'form_fields[name]': 'x', ...ATTR_BODY }, headers: { ...H, origin: 'https://evil.example' } });
  assert.strictEqual(r.status, 400);
  const rej = logs.map(([, m]) => m).filter((m) => m.includes('"request_rejected"')).map((m) => JSON.parse(m));
  assert.deepStrictEqual(rej.map((x) => x.reason), ['bad_origin']);
  await call(handler, { body: { 'form_fields[name]': 'x', ...ATTR_BODY }, headers: H });
  const rej2 = logs.map(([, m]) => m).filter((m) => m.includes('"request_rejected"')).map((m) => JSON.parse(m));
  assert.deepStrictEqual(rej2.map((x) => x.reason), ['bad_origin', 'invalid_input']);
  assert(rej2.every((x) => x.ip === '203.0.113.50' && x.city === 'Kochi' && x.campaign.utm_source === 'google'));
  assert(!wholeLogs().includes('ABCDEF123456XYZ'));
});

test('E) click id redaction: type + first 6 chars only, in every log line and Heffl payload', async () => {
  const { handler, calls } = setupAbuse({ lead: () => resp(500, {}) });
  await call(handler, { body: { ...GOOD, 'form_fields[click_id]': 'msclkid:SECRETVALUE99' } });
  const all = wholeLogs() + JSON.stringify(calls);
  assert(!all.includes('SECRETVALUE99'));
  assert(all.includes('msclkid:SECRET'));
  assert(!all.includes('SECRETV'), 'only 6 characters');
});

test('F) same IP, different details: 3rd distinct email+phone within 10 min is an abuse record with the typed details and the IP', async () => {
  const { handler, calls } = setupAbuse();
  const h = { 'x-real-ip': '198.51.100.77', 'x-vercel-ip-country': 'IN', 'x-vercel-ip-country-region': 'KL', 'x-vercel-ip-city': 'Kochi' };
  const r = [];
  for (let i = 1; i <= 3; i++) r.push(await call(handler, { body: { ...uniq(1000 + i), 'form_fields[name]': `Person ${i}`, ...ATTR_BODY }, headers: h }));
  assert(r.every((x) => x.status === 200 && JSON.stringify(x.body) === JSON.stringify(SUCCESS)), 'visitor always sees success');
  assert.strictEqual(taskCalls(calls).length, 2, 'two real leads with follow-up tasks');
  const a = abuseLeads(calls);
  assert.strictEqual(a.length, 1);
  assert.strictEqual(a[0].body.title, 'ABUSE: same_ip_multiple | IP 198.51.100.77 | IN, KL, Kochi | src=google med=cpc cmp=spring | ref=www.google.com | term=ai marketing course content=ad-a click=gclid | land=/blog/post');
  assert.strictEqual(a[0].body.stageId, 'lstg_unq');
  assert.deepStrictEqual([a[0].body.name, a[0].body.email, a[0].body.mobile], ['Person 3', 'u1003@example.com', '+919000001003'], 'details they typed are on the abuse lead');
  const flagged = logs.map(([, m]) => m).filter((m) => m.includes('"abuse_flagged"')).map((m) => JSON.parse(m));
  assert.strictEqual(flagged[0].abuse, 'same_ip_multiple');
  assert.strictEqual(flagged[0].ip, '198.51.100.77');
});

test('F) same_ip_multiple: same details again is not counted, other IPs and the 10-minute window are independent, no IP -> not applied', async () => {
  const { handler, calls } = setupAbuse();
  const h = { 'x-real-ip': '198.51.100.78' };
  await call(handler, { body: uniq(1010), headers: h });
  await call(handler, { body: uniq(1011), headers: h });
  // third identity from ANOTHER IP is a normal lead
  await call(handler, { body: uniq(1012), headers: { 'x-real-ip': '198.51.100.79' } });
  assert.strictEqual(abuseLeads(calls).length, 0);
  assert.strictEqual(taskCalls(calls).length, 3);
  // after 10 minutes the old identities no longer count
  const realNow = Date.now;
  Date.now = () => realNow() + 11 * 60 * 1000;
  try {
    await call(handler, { body: uniq(1013), headers: h });
  } finally {
    Date.now = realNow;
  }
  assert.strictEqual(abuseLeads(calls).length, 0);
  assert.strictEqual(taskCalls(calls).length, 4);
});

test('F) same_ip_multiple abuse lead falls back to details-in-title when Heffl rejects the duplicate contact', async () => {
  let n = 0;
  const { handler, calls } = setupAbuse({ lead: () => (++n === 3 ? resp(409, { code: 'CONFLICT' }) : resp(200, { id: 'ld_' + n })) });
  const h = { 'x-real-ip': '198.51.100.80' };
  for (let i = 1; i <= 3; i++) await call(handler, { body: uniq(1020 + i), headers: h });
  const a = abuseLeads(calls);
  assert.strictEqual(a.length, 2);
  assert(a[1].body.title.startsWith('ABUSE: same_ip_multiple | IP 198.51.100.80 | u1023@example.com +919000001023'));
});

(async () => {
  let failed = 0;
  for (const [name, fn] of tests) {
    try {
      await fn();
      out(`ok   - ${name}`);
    } catch (e) {
      failed++;
      out(`FAIL - ${name}\n       ${e.stack.split('\n').slice(0, 4).join('\n       ')}`);
    }
  }
  out(`\n${tests.length - failed}/${tests.length} passed`);
  process.exit(failed ? 1 : 0);
})();
