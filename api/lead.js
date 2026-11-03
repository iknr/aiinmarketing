/**
 * Form endpoint, mounted at /wp-admin/admin-ajax.php (see vercel.json).
 * Mirrors the response shape Elementor Pro's form handler returns.
 *
 * Environment variables (see CLAUDE.md / README.md):
 *   HEFFL_API_KEY            Heffl CRM API key. When set, every valid submission becomes a Heffl lead.
 *                            When unset the function only logs (or forwards to LEAD_WEBHOOK_URL).
 *   HEFFL_LEAD_SOURCE_NAME   Heffl lead source name (default "Website")
 *   HEFFL_LEAD_STAGE_NAME    Heffl lead stage name (default "New")
 *   HEFFL_USE_CUSTOM_FIELDS  "true" once the owner created the custom fields listed in CLAUDE.md
 *   LEAD_WEBHOOK_URL         Without HEFFL_API_KEY: receives every lead. With it: fallback that
 *                            receives leads Heffl could not store.
 *
 * The API key is only ever sent in the x-api-key header and is never logged.
 */
const FIELDS = ['name', 'phone', 'email', 'stage', 'plan', 'source'];

const HEFFL_V1 = 'https://api.heffl.com/api/v1';
const HEFFL_V2 = 'https://api.heffl.com/api/v2';
const HEFFL_BUDGET_MS = 6000; // total for all Heffl calls of one submission
const WEBHOOK_TIMEOUT_MS = 3000;
const REF_TTL_MS = 60 * 60 * 1000; // cache of source/stage ids per warm instance
const REF_FAIL_TTL_MS = 60 * 1000; // do not hammer Heffl when the lookup failed

const ALLOWED_HOSTS = ['aiinmarketing.in', 'www.aiinmarketing.in'];
const RATE_MAX = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const REPEAT_WINDOW_MS = 60 * 1000;

// Module-scope state (best effort: per warm serverless instance only).
const rate = new Map(); // ip -> [timestamps]
const recent = new Map(); // email|phone -> timestamp
let refCache = null; // { at, ok, key, sourceId, stageId }

function json(res, status, payload) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(payload);
}

const BAD = { success: false, data: { message: 'Please check your details and try again.' } };

// ---------------------------------------------------------------- helpers
function clean(value, max) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch (e) {
    return '';
  }
}

function hostAllowed(host) {
  if (ALLOWED_HOSTS.includes(host)) return true;
  return process.env.VERCEL_ENV !== 'production' && (host === 'localhost' || host === '127.0.0.1');
}

function originOk(req) {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  if (origin) return hostAllowed(hostOf(origin));
  return referer ? hostAllowed(hostOf(referer)) : false;
}

function clientIp(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = xff || String(req.headers['x-real-ip'] || '') || (req.socket && req.socket.remoteAddress) || 'unknown';
  return ip.slice(0, 64);
}

function prune(map, maxAge, now) {
  if (map.size < 2000) return;
  for (const [k, v] of map) {
    const t = Array.isArray(v) ? v[v.length - 1] : v;
    if (now - t > maxAge) map.delete(k);
  }
}

function rateLimited(ip, now) {
  prune(rate, RATE_WINDOW_MS, now);
  const hits = (rate.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX) {
    rate.set(ip, hits);
    return true;
  }
  hits.push(now);
  rate.set(ip, hits);
  return false;
}

function parsePage(referer) {
  const out = { pageUrl: '', utm: {} };
  try {
    const u = new URL(referer);
    out.pageUrl = (u.origin + u.pathname).slice(0, 200);
    for (const [k, v] of u.searchParams) {
      if (/^utm_[a-z_]{1,20}$/i.test(k)) out.utm[k.toLowerCase()] = clean(v, 100);
    }
  } catch (e) {
    /* referer missing or not a URL */
  }
  return out;
}

// ------------------------------------------------------------ Heffl client
/** One Heffl HTTP call, aborted when the shared deadline runs out. Never throws. */
async function heffl(url, method, body, deadline) {
  const remaining = deadline - Date.now();
  if (remaining < 100) return { error: 'timeout' };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), remaining);
  try {
    const r = await fetch(url, {
      method,
      headers: { 'x-api-key': process.env.HEFFL_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctl.signal,
    });
    let data = null;
    try {
      data = await r.json();
    } catch (e) {
      /* empty or non-JSON body */
    }
    const h = r.headers && typeof r.headers.get === 'function' ? r.headers : { get: () => null };
    return { status: r.status, ok: r.ok, data, resetSec: Number(h.get('ratelimit-reset') || h.get('retry-after')) };
  } catch (err) {
    return { error: ctl.signal.aborted ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}

/** heffl() plus the single allowed retry on 429 when the reset hint is under 2 s. */
async function hefflRetry(url, method, body, deadline) {
  let r = await heffl(url, method, body, deadline);
  if (r.status === 429 && r.resetSec >= 0 && r.resetSec < 2 && deadline - Date.now() > r.resetSec * 1000 + 300) {
    await new Promise((ok) => setTimeout(ok, Math.ceil(r.resetSec * 1000) + 50));
    r = await heffl(url, method, body, deadline);
  }
  return r;
}

function listOf(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

/** Public ids of the configured lead source and stage, looked up by name (v1 list endpoints). */
async function lookupRefs(deadline) {
  const sourceName = clean(process.env.HEFFL_LEAD_SOURCE_NAME || 'Website', 80);
  const stageName = clean(process.env.HEFFL_LEAD_STAGE_NAME || 'New', 80);
  const key = `${sourceName}|${stageName}`;
  const now = Date.now();
  if (refCache && refCache.key === key && now - refCache.at < (refCache.ok ? REF_TTL_MS : REF_FAIL_TTL_MS)) return refCache;

  const [src, stg] = await Promise.all([
    hefflRetry(`${HEFFL_V1}/leads/sources`, 'GET', undefined, deadline),
    hefflRetry(`${HEFFL_V1}/leads/stages`, 'GET', undefined, deadline),
  ]);
  const find = (res, field, name) => {
    if (!res.ok) return undefined;
    const hit = listOf(res.data).find((x) => x && clean(x[field], 80).toLowerCase() === name.toLowerCase());
    return hit && hit.id;
  };
  const sourceId = find(src, 'name', sourceName);
  const stageId = find(stg, 'label', stageName);
  const ok = Boolean(sourceId && stageId);
  if (!ok) {
    console.warn(
      JSON.stringify({
        event: 'heffl_lookup_failed',
        source: sourceId ? 'ok' : src.ok ? `"${sourceName}" not found` : src.status || src.error,
        stage: stageId ? 'ok' : stg.ok ? `"${stageName}" not found` : stg.status || stg.error,
        note: 'creating lead without the missing id; Heffl uses its defaults',
      })
    );
  }
  refCache = { at: now, ok, key, sourceId, stageId };
  return refCache;
}

function isDuplicate(r) {
  if (r.status === 409) return true;
  if (r.status === 400 || r.status === 422) {
    const e = (r.data && (r.data.error || r.data)) || {};
    const text = `${e.code || ''} ${e.message || ''}`;
    return /duplicate|already exist|CONFLICT/i.test(text);
  }
  return false;
}

function failureInfo(r) {
  const e = (r.data && (r.data.error || r.data)) || {};
  const out = { status: r.status || null, code: e.code || r.error || null };
  if (r.status === 401 || r.status === 403) out.hint = 'check HEFFL_API_KEY permissions';
  return out;
}

function recover(record, info) {
  // One structured line, runtime logs only (contains personal data, never the API key).
  console.error(JSON.stringify({ event: 'lead_crm_failed', ...info, lead: record }));
  const hook = process.env.LEAD_WEBHOOK_URL;
  if (!hook) return Promise.resolve();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), WEBHOOK_TIMEOUT_MS);
  return fetch(hook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...record, crmFailed: info }),
    signal: ctl.signal,
  })
    .then((r) => {
      if (!r.ok) console.error(JSON.stringify({ event: 'lead_recovery_webhook_failed', status: r.status }));
    })
    .catch((err) => console.error(JSON.stringify({ event: 'lead_recovery_webhook_failed', error: err.name })))
    .finally(() => clearTimeout(timer));
}

function contextText(ctx) {
  const utm = Object.entries(ctx.utm).map(([k, v]) => `${k}=${v}`).join(', ');
  return [
    `Current situation: ${ctx.situation || '-'}`,
    `Form source: ${ctx.formSource || '-'}`,
    `Form: ${ctx.form || '-'}`,
    `Page: ${ctx.pageUrl || '-'}`,
    `Campaign / UTM: ${utm || '-'}`,
    `Submitted: ${ctx.receivedAt}`,
  ].join('\n');
}

/**
 * Creates the lead in Heffl and preserves the form context. Returns
 * { ok: true, duplicate?: true } or { ok: false, info }.
 */
async function sendToHeffl(person, ctx) {
  const deadline = Date.now() + Math.min(Math.max(Number(process.env.HEFFL_TIMEOUT_MS) || HEFFL_BUDGET_MS, 100), HEFFL_BUDGET_MS);
  const refs = await lookupRefs(deadline);

  const payload = { name: person.name, mobile: person.mobile, email: person.email };
  if (refs.sourceId) payload.sourceId = refs.sourceId;
  if (refs.stageId) payload.stageId = refs.stageId;

  // (a) custom fields on the lead (documented: v1 intro "Custom fields", cf_ + snake_case label)
  const useCf = process.env.HEFFL_USE_CUSTOM_FIELDS === 'true';
  const cf = useCf
    ? {
        cf_current_situation: clean(ctx.situation, 100),
        cf_form_source: clean(ctx.formSource, 100),
        cf_page_url: clean(ctx.pageUrl, 200),
        cf_campaign_utm: clean(Object.entries(ctx.utm).map(([k, v]) => `${k}=${v}`).join(' | '), 300),
      }
    : null;

  let r = await hefflRetry(`${HEFFL_V1}/leads`, 'POST', cf ? { ...payload, ...cf } : payload, deadline);
  let cfSaved = false;
  if (cf && !r.ok && !isDuplicate(r) && r.status === 400) {
    console.warn(JSON.stringify({ event: 'heffl_custom_fields_rejected', note: 'retrying without cf_* keys; context goes into a task' }));
    r = await hefflRetry(`${HEFFL_V1}/leads`, 'POST', payload, deadline);
  } else if (cf && r.ok) {
    const saved = r.data && r.data.customFields;
    cfSaved = Boolean(saved && typeof saved === 'object' && Object.keys(saved).length);
  }

  if (isDuplicate(r)) {
    console.log(JSON.stringify({ event: 'duplicate_lead', status: r.status }));
    return { ok: true, duplicate: true };
  }
  if (!r.ok) {
    const info = failureInfo(r);
    if (info.hint) console.error(JSON.stringify({ event: 'heffl_auth', ...info }));
    return { ok: false, info };
  }

  const leadId = r.data && (r.data.id || (r.data.data && r.data.data.id));
  if (cfSaved) return { ok: true };

  // (b) follow-up task linked to the lead carrying the context (v2 POST /tasks, entity "leads", entityId "ld_…")
  if (!leadId) {
    console.warn(JSON.stringify({ event: 'lead_context_lost', reason: 'no lead id in response', context: ctx }));
    return { ok: true };
  }
  const title = clean(`Follow up: ${person.name} (${ctx.situation || 'n/a'}, via ${ctx.formSource || ctx.form || 'website'})`, 200);
  const t = await hefflRetry(
    `${HEFFL_V2}/tasks`,
    'POST',
    {
      title,
      description: contextText(ctx),
      type: 'call',
      priority: 'MEDIUM',
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      entity: 'leads',
      entityId: leadId,
    },
    deadline
  );
  if (!t.ok) {
    console.error(JSON.stringify({ event: 'lead_context_task_failed', ...failureInfo(t), leadId, context: ctx }));
  }
  return { ok: true };
}

// ----------------------------------------------------------------- handler
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { success: false, data: { message: 'Method not allowed.' } });

  if (!originOk(req)) return json(res, 400, BAD);

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const lead = {};
  for (const key of FIELDS) {
    const v = body[`form_fields[${key}]`];
    if (typeof v === 'string') lead[key] = v.trim().slice(0, 200);
  }

  const phone = (lead.phone || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  const valid =
    (lead.name || '').length >= 2 &&
    /^[6-9]\d{9}$/.test(phone) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email || '');
  if (!valid) return json(res, 400, BAD);

  const now = Date.now();

  // Same email+phone again within 60 s: acknowledge, do nothing else.
  prune(recent, REPEAT_WINDOW_MS, now);
  const repeatKey = `${lead.email.toLowerCase()}|${phone}`;
  if (now - (recent.get(repeatKey) || 0) < REPEAT_WINDOW_MS) {
    return json(res, 200, { success: true, data: { message: 'Your submission was successful.' } });
  }

  if (rateLimited(clientIp(req), now)) {
    return json(res, 429, { success: false, data: { message: 'Too many submissions. Please try again in a few minutes.' } });
  }
  recent.set(repeatKey, now);

  const record = {
    ...lead,
    phone,
    form: String(body.form_name || '').slice(0, 80),
    page: String(body.referer || '').slice(0, 300),
    receivedAt: new Date(now).toISOString(),
  };
  const ok200 = { success: true, data: { message: 'Your submission was successful.' } };

  if (process.env.HEFFL_API_KEY) {
    const page = parsePage(String(body.referer || ''));
    const ctx = {
      situation: clean(lead.stage, 100),
      formSource: clean(lead.source, 100),
      form: clean(record.form, 80),
      pageUrl: page.pageUrl,
      utm: page.utm,
      receivedAt: record.receivedAt,
    };
    const person = {
      name: clean(lead.name, 100),
      email: clean(lead.email, 120),
      mobile: `+91${phone}`,
    };
    try {
      const result = await sendToHeffl(person, ctx);
      if (!result.ok) await recover(record, result.info);
    } catch (err) {
      await recover(record, { status: null, code: 'exception', error: err && err.name });
    }
    return json(res, 200, ok200);
  }

  // No HEFFL_API_KEY: behave as before (webhook or log only).
  const hook = process.env.LEAD_WEBHOOK_URL;
  if (hook) {
    try {
      const r = await fetch(hook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      });
      if (!r.ok) throw new Error(`webhook responded ${r.status}`);
    } catch (err) {
      console.error('lead webhook failed', err.message, record);
      return json(res, 502, { success: false, data: { message: 'Server error.' } });
    }
  } else {
    console.log('lead (no LEAD_WEBHOOK_URL set)', JSON.stringify(record));
  }

  return json(res, 200, ok200);
};
