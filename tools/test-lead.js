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
  assert(task.body.description.includes('utm_source=meta') && task.body.description.includes('utm_campaign=nov'));
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
  assert.strictEqual(b.cf_campaign_utm, 'utm_source=meta | utm_campaign=nov');
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
  assert.strictEqual(calls.length, 0);
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
  assert.strictEqual(leadPosts(calls).length, 5);
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
