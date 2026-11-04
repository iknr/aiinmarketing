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
 * Abuse records: flagged but otherwise valid submissions become Heffl leads in the "Unqualified" stage with
 * "ABUSE: <type>" at the start of the lead title (max ABUSE_MAX_PER_HOUR per hour per warm instance).
 *
 * The API key is only ever sent in the x-api-key header and is never logged.
 */
const net = require('net');

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
const IP_IDENTITY_MAX = 1; // different email+phone pairs per IP per RATE_WINDOW_MS that count as normal; every further different pair is flagged as same_ip_multiple
const ABUSE_STAGE_NAME = 'Unqualified';
const ABUSE_MAX_PER_HOUR = 20;
const ABUSE_BUDGET_MS = 5000;
// Obvious automation only. A missing User-Agent is not flagged.
const BOT_UA = /HeadlessChrome|PhantomJS|python-requests|python-urllib|aiohttp|^curl\/|\bcurl\/|^wget|Go-http-client|node-fetch|undici|axios\/|okhttp|libwww-perl|scrapy|java\/|httpclient|\bbot\b|spider|crawler/i;

const FORM_LABELS = {
  dm_by_adsmentor_apply: 'Apply form',
  magnet_syllabus: 'Free guide: 12-week syllabus',
  magnet_checklist: 'Free guide: 5-question course checklist',
  magnet_ad_account: 'Free guide: ad account ownership checklist',
  magnet_brochure: 'Brochure download',
};
const SOURCE_LABELS = {
  'magnet-rtcros-prompt-guide': 'Free guide: RTCROS prompt guide',
  'magnet-meta-mcp-cli-sop': 'Free guide: Meta Ads MCP and CLI SOP',
};

// Module-scope state (best effort: per warm serverless instance only).
const rate = new Map(); // ip -> [timestamps]
const recent = new Map(); // email|phone -> timestamp
const ipIdentities = new Map(); // ip -> Map(email|phone -> timestamp) of distinct details seen from that IP
let abuseStamps = []; // timestamps of abuse records sent to Heffl (cap per hour)
let refCache = null; // { at, ok, key, sourceId, stageId, unqualifiedId }

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

/** A trimmed IPv4/IPv6 literal of at most 45 chars, otherwise ''. */
function validIp(value) {
  const v = String(value == null ? '' : value).trim();
  return v && v.length <= 45 && net.isIP(v) ? v : '';
}

/** Visitor IP: x-real-ip, then the first x-forwarded-for entry, then the socket. '' when none is valid. */
function clientIp(req) {
  const h = req.headers || {};
  const real = Array.isArray(h['x-real-ip']) ? h['x-real-ip'][0] : h['x-real-ip'];
  const fwd = Array.isArray(h['x-forwarded-for']) ? h['x-forwarded-for'].join(',') : h['x-forwarded-for'];
  return validIp(real) || validIp(String(fwd || '').split(',')[0]) || validIp(req.socket && req.socket.remoteAddress);
}

/** Approximate location from Vercel's geo headers (never shown to the visitor). */
function requestGeo(req) {
  const h = req.headers || {};
  const one = (k) => String(Array.isArray(h[k]) ? h[k][0] : h[k] || '');
  let city = one('x-vercel-ip-city');
  try {
    city = decodeURIComponent(city);
  } catch (e) {
    /* keep the raw value */
  }
  const country = one('x-vercel-ip-country').trim().toUpperCase();
  return {
    ip: clientIp(req),
    country: /^[A-Z]{2}$/.test(country) ? country : '',
    region: clean(one('x-vercel-ip-country-region'), 10).replace(/[^A-Za-z0-9-]/g, ''),
    city: clean(city, 60),
  };
}

function geoText(g) {
  const place = [g.city, g.region, g.country].filter(Boolean).join(', ');
  return place || '-';
}

/** '4 Nov 2026, 2:15 AM IST' for an ISO/epoch time. */
function formatIST(when) {
  const d = new Date(new Date(when).getTime() + 330 * 60 * 1000);
  if (Number.isNaN(d.getTime())) return '-';
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
  const h24 = d.getUTCHours();
  const h12 = h24 % 12 || 12;
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${d.getUTCDate()} ${mon} ${d.getUTCFullYear()}, ${h12}:${mm} ${h24 < 12 ? 'AM' : 'PM'} IST`;
}

/** Friendly name of the form: known source, else known form name, else the raw value. */
function friendlyLabel(formSource, form) {
  return SOURCE_LABELS[formSource] || FORM_LABELS[formSource] || FORM_LABELS[form] || formSource || form || 'website';
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
  ip = ip || 'unknown';
  const hits = (rate.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX) {
    rate.set(ip, hits);
    return true;
  }
  hits.push(now);
  rate.set(ip, hits);
  return false;
}

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
const CLICK_TYPES = ['gclid', 'fbclid', 'msclkid'];
const ATTR_MAX = 120;
const TITLE_MAX = 190; // Heffl documents no maximum for the lead title; keep it short

/** Attribution text from the browser: control characters and angle brackets removed, whitespace collapsed, capped. */
function cleanAttr(value, max) {
  return String(typeof value === 'string' ? value : '')
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max || ATTR_MAX);
}

function parsePage(referer) {
  const out = { pageUrl: '', utm: {}, clicks: {} };
  try {
    const u = new URL(referer);
    out.pageUrl = (u.origin + u.pathname).slice(0, 200);
    for (const [k, v] of u.searchParams) {
      const key = k.toLowerCase();
      if (UTM_KEYS.includes(key)) out.utm[key] = cleanAttr(v);
      else if (CLICK_TYPES.includes(key)) out.clicks[key] = cleanAttr(v);
    }
  } catch (e) {
    /* referer missing or not a URL */
  }
  return out;
}

/**
 * Campaign data of one submission. The browser (aim-track.js) sends form_fields[utm_*], [click_id], [referrer_host],
 * [landing_path] and [attribution]; anything missing falls back to the UTM and click ids in the Referer URL.
 * The full click id is kept only in `clickValue` for the type/first-6 redaction; it is never logged or sent to Heffl.
 */
function buildAttribution(body, page) {
  const f = (k) => (typeof body[`form_fields[${k}]`] === 'string' ? cleanAttr(body[`form_fields[${k}]`]) : '');
  const a = {};
  for (const k of UTM_KEYS) a[k] = f(k) || (page.utm[k] || '');
  let clickType = '';
  let clickValue = '';
  const m = /^(gclid|fbclid|msclkid):(.+)$/i.exec(f('click_id'));
  if (m) {
    clickType = m[1].toLowerCase();
    clickValue = m[2];
  } else {
    clickType = CLICK_TYPES.find((t) => page.clicks[t]) || '';
    clickValue = clickType ? page.clicks[clickType] : '';
  }
  a.clickType = clickType;
  a.clickPrefix = clickValue.slice(0, 6); // log/Heffl text: type + first 6 characters only
  a.hasClick = Boolean(clickValue);
  let host = f('referrer_host').toLowerCase();
  if (!/^[a-z0-9.-]{1,120}$/.test(host) || ALLOWED_HOSTS.includes(host)) host = '';
  a.referrerHost = host;
  const land = f('landing_path');
  a.landingPath = land.startsWith('/') ? land : '';
  const has = UTM_KEYS.some((k) => a[k]) || a.hasClick;
  const given = f('attribution').toLowerCase();
  a.attribution = ['first', 'last', 'direct'].includes(given) ? given : has ? 'last' : 'direct';
  return a;
}

/** Redacted, structured form for logs: never the full click id. */
function attrLog(a) {
  return {
    utm_source: a.utm_source,
    utm_medium: a.utm_medium,
    utm_campaign: a.utm_campaign,
    utm_term: a.utm_term,
    utm_content: a.utm_content,
    click: a.hasClick ? `${a.clickType}:${a.clickPrefix}` : '',
    referrer: a.referrerHost,
    landing: a.landingPath,
    attribution: a.attribution,
  };
}

function utmSummary(a) {
  return UTM_KEYS.map((k) => a[k] || '-').join(' / ');
}

/** Lead title of an abuse record: type and IP first, the rest is cut from the right at TITLE_MAX. */
function abuseTitle(type, ctx, contact) {
  const a = ctx.attr;
  const place = [ctx.country, ctx.region, ctx.city].filter(Boolean).join(', ');
  const src = [a.utm_source && `src=${a.utm_source}`, a.utm_medium && `med=${a.utm_medium}`, a.utm_campaign && `cmp=${a.utm_campaign}`].filter(Boolean).join(' ');
  const more = [a.utm_term && `term=${a.utm_term}`, a.utm_content && `content=${a.utm_content}`, a.hasClick && `click=${a.clickType}`].filter(Boolean).join(' ');
  const parts = [
    `ABUSE: ${type}`,
    ctx.ip ? `IP ${ctx.ip}` : '',
    contact || '',
    place,
    src,
    a.referrerHost ? `ref=${a.referrerHost}` : '',
    more,
    a.landingPath ? `land=${a.landingPath}` : '',
  ].filter(Boolean);
  return clean(parts.join(' | '), TITLE_MAX);
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
  const unqualifiedId = find(stg, 'label', ABUSE_STAGE_NAME);
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
  refCache = { at: now, ok, key, sourceId, stageId, unqualifiedId };
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

function recover(record, info, meta) {
  // One structured line, runtime logs only (contains personal data, never the API key).
  console.error(JSON.stringify({ event: 'lead_crm_failed', ...info, ...meta, lead: record }));
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
  const a = ctx.attr;
  const campaign = `${utmSummary(a)}; click id present: ${a.hasClick ? 'yes' : 'no'}; referrer: ${a.referrerHost || '-'}; first landing: ${a.landingPath || '-'}; attribution: ${a.attribution}`;
  return [
    `Current situation: ${ctx.situation || '-'}`,
    `Form: ${friendlyLabel(ctx.formSource, ctx.form)}`,
    `Form source (raw): ${ctx.formSource || '-'}`,
    `Form name (raw): ${ctx.form || '-'}`,
    `Page: ${ctx.pageUrl || '-'}`,
    `Campaign / UTM: ${campaign}`,
    `Submitted: ${formatIST(ctx.receivedAt)}`,
    `IP address: ${ctx.ip || '-'}`,
    `Approximate location: ${geoText(ctx)}`,
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
        cf_campaign_utm: clean(`${utmSummary(ctx.attr)}; click id present: ${ctx.attr.hasClick ? 'yes' : 'no'}; referrer: ${ctx.attr.referrerHost || '-'}; first landing: ${ctx.attr.landingPath || '-'}; attribution: ${ctx.attr.attribution}`, 300),
        cf_ip_address: ctx.ip || '',
        cf_country: ctx.country || '',
        cf_region: ctx.region || '',
        cf_city: ctx.city || '',
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

  let duplicate = false;
  if (isDuplicate(r)) {
    // Heffl refuses a second lead with the same phone/email. Never drop it: store the person again WITHOUT the
    // contact fields, with the contact in the title, so the team still sees the new enquiry and its follow-up task.
    console.log(JSON.stringify({ event: 'duplicate_lead', status: r.status, note: 'stored again without contact fields' }));
    duplicate = true;
    const { mobile, email, ...rest } = payload;
    r = await hefflRetry(`${HEFFL_V1}/leads`, 'POST', { ...rest, title: clean(`Repeat enquiry (contact already in Heffl): ${person.email} ${person.mobile}`, TITLE_MAX) }, deadline);
  }
  if (!r.ok) {
    const info = failureInfo(r);
    if (info.hint) console.error(JSON.stringify({ event: 'heffl_auth', ...info }));
    // A) Heffl answered with a rejection (4xx other than 401/403/429): ask the team to follow up by hand.
    // Not for unreachable Heffl (timeout/network), auth, rate limits or 5xx: those keep the log + webhook fallback.
    const rejected = r.status >= 400 && r.status < 500 && ![401, 403, 429].includes(r.status);
    if (rejected) {
      const ft = await hefflRetry(
        `${HEFFL_V2}/tasks`,
        'POST',
        {
          title: clean(`Lead capture failed: ${person.name}, ${person.mobile}, ${friendlyLabel(ctx.formSource, ctx.form)}`, 200),
          description: [`Heffl rejected this lead (HTTP ${info.status}, ${info.code || 'no code'}). Please add it by hand.`, `Email: ${person.email}`, contextText(ctx)].join('\n'),
          type: 'todo',
          priority: 'HIGH',
          dueDate: new Date().toISOString(),
        },
        deadline
      );
      if (ft.ok) return { ok: false, info, taskCreated: true };
      console.error(JSON.stringify({ event: 'lead_failure_task_failed', ...failureInfo(ft) }));
    }
    return { ok: false, info };
  }

  const leadId = r.data && (r.data.id || (r.data.data && r.data.data.id));
  if (cfSaved && !duplicate) return { ok: true };

  // (b) follow-up task linked to the lead carrying the context (v2 POST /tasks, entity "leads", entityId "ld_…")
  if (!leadId) {
    console.warn(JSON.stringify({ event: 'lead_context_lost', reason: 'no lead id in response', context: ctx }));
    return { ok: true };
  }
  const title = clean(`Follow up: ${person.name} (${ctx.situation || 'n/a'}, via ${friendlyLabel(ctx.formSource, ctx.form)})`, 200);
  const t = await hefflRetry(
    `${HEFFL_V2}/tasks`,
    'POST',
    {
      title,
      description: (duplicate ? `Repeat enquiry: this phone/email already exists in Heffl.\nMobile (typed): ${person.mobile}\nEmail (typed): ${person.email}\n` : '') + contextText(ctx),
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

/**
 * Stores a flagged submission so that no contact details are ever lost. Normally a Heffl lead in the "Unqualified"
 * stage with "ABUSE: <type>" at the start of the title, no task, never "New". A person with `raw: true` (details that
 * failed validation) is stored with the typed phone/email in the title instead of the contact fields.
 * Whenever Heffl cannot take it (no key, hourly cap, stage missing, rejection, error) the full record is logged as
 * lead_crm_failed and posted to LEAD_WEBHOOK_URL. Never throws.
 */
async function recordAbuse(type, person, ctx, record) {
  const meta = { ip: ctx.ip, country: ctx.country, region: ctx.region, city: ctx.city, abuse: type, campaign: attrLog(ctx.attr) };
  const fallback = (code, extra) => recover(record, { status: null, code, ...extra }, meta);
  try {
    const now = Date.now();
    console.warn(JSON.stringify({ event: 'abuse_flagged', ...meta }));
    if (!process.env.HEFFL_API_KEY) return await fallback('no_heffl_key');
    abuseStamps = abuseStamps.filter((t) => now - t < 60 * 60 * 1000);
    if (abuseStamps.length >= ABUSE_MAX_PER_HOUR) {
      console.warn(JSON.stringify({ event: 'abuse_record_skipped', reason: 'hourly cap', abuse: type }));
      return await fallback('abuse_hourly_cap');
    }
    abuseStamps.push(now);
    const deadline = now + ABUSE_BUDGET_MS;
    const refs = await lookupRefs(deadline);
    if (!refs.unqualifiedId) {
      console.warn(JSON.stringify({ event: 'abuse_record_skipped', reason: `stage "${ABUSE_STAGE_NAME}" not found`, abuse: type }));
      return await fallback('unqualified_stage_missing');
    }
    const base = { name: person.name, sourceId: refs.sourceId, stageId: refs.unqualifiedId };
    if (!base.sourceId) delete base.sourceId;
    const typed = `phone=${person.mobile || '-'} email=${person.email || '-'}`;
    let r;
    if (person.raw) {
      r = await hefflRetry(`${HEFFL_V1}/leads`, 'POST', { ...base, title: abuseTitle(type, ctx, typed) }, deadline);
    } else {
      r = await hefflRetry(`${HEFFL_V1}/leads`, 'POST', { ...base, mobile: person.mobile, email: person.email, title: abuseTitle(type, ctx) }, deadline);
      if (isDuplicate(r)) {
        // Heffl does not allow duplicate contacts: keep the record, carry the contact in the title instead.
        r = await hefflRetry(`${HEFFL_V1}/leads`, 'POST', { ...base, title: abuseTitle(type, ctx, `${person.email} ${person.mobile}`) }, deadline);
      }
    }
    if (!r.ok) {
      console.error(JSON.stringify({ event: 'abuse_record_failed', abuse: type, ...failureInfo(r) }));
      await fallback('abuse_record_failed', failureInfo(r));
      return;
    }
    // The lead record has no place for the IP, the form details or the campaign (and when the contact was a duplicate
    // it has no phone/email either), so they go into a low-priority task linked to the abuse lead.
    const leadId = r.data && (r.data.id || (r.data.data && r.data.data.id));
    if (!leadId) return await fallback('abuse_no_lead_id');
    const t = await hefflRetry(
      `${HEFFL_V2}/tasks`,
      'POST',
      {
        title: clean(`ABUSE: ${type} - ${person.name}`, 200),
        description: [
          `Flagged as abuse: ${type}. Review before calling; move to New if this is a genuine person.`,
          `Name: ${person.name}`,
          `Mobile (typed): ${person.mobile || '-'}`,
          `Email (typed): ${person.email || '-'}`,
          contextText(ctx),
        ].join('\n'),
        type: 'todo',
        priority: 'LOW',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        entity: 'leads',
        entityId: leadId,
      },
      deadline
    );
    if (!t.ok) {
      console.error(JSON.stringify({ event: 'abuse_context_task_failed', abuse: type, ...failureInfo(t) }));
      await fallback('abuse_task_failed', failureInfo(t));
    }
  } catch (err) {
    console.error(JSON.stringify({ event: 'abuse_record_failed', abuse: type, error: err && err.name }));
    await fallback('abuse_exception', { error: err && err.name });
  }
}

// ----------------------------------------------------------------- handler
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { success: false, data: { message: 'Method not allowed.' } });

  const geo = requestGeo(req);
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

  const now = Date.now();
  const page = parsePage(String(body.referer || ''));
  const attr = buildAttribution(body, page);
  const record = {
    ...lead,
    phone,
    form: String(body.form_name || '').slice(0, 80),
    page: String(body.referer || '').slice(0, 300),
    campaign: attrLog(attr),
    receivedAt: new Date(now).toISOString(),
    ip: geo.ip,
    country: geo.country,
    region: geo.region,
    city: geo.city,
    abuse: null,
  };
  const ctx = {
    situation: clean(lead.stage, 100),
    formSource: clean(lead.source, 100),
    form: clean(record.form, 80),
    pageUrl: page.pageUrl,
    attr,
    receivedAt: record.receivedAt,
    ...geo,
  };
  const person = valid ? { name: clean(lead.name, 100), email: clean(lead.email, 120), mobile: `+91${phone}` } : null;
  const ok200 = { success: true, data: { message: 'Your submission was successful.' } };
  // Details that failed validation are still kept (typed phone/email go into the title of the abuse record).
  const typedPerson =
    person ||
    (lead.name || lead.phone || lead.email
      ? { name: clean(lead.name, 100) || 'Unknown', email: clean(lead.email, 120), mobile: clean(lead.phone, 40), raw: true }
      : null);
  const flag = (type) => {
    record.abuse = type;
    return typedPerson ? recordAbuse(type, typedPerson, ctx, record) : Promise.resolve();
  };

  const rejected = (reason) =>
    console.warn(JSON.stringify({ event: 'request_rejected', reason, ip: geo.ip, country: geo.country, region: geo.region, city: geo.city, campaign: attrLog(attr) }));
  if (!originOk(req)) {
    rejected('bad_origin');
    await flag('bad_origin');
    return json(res, 400, BAD);
  }
  if (!valid) {
    rejected('invalid_input');
    await flag('invalid_input');
    return json(res, 400, BAD);
  }

  // Obvious automation: acknowledge like a normal submission, keep a record.
  if (BOT_UA.test(String(req.headers['user-agent'] || ''))) {
    await flag('bot_user_agent');
    return json(res, 200, ok200);
  }

  // Same email+phone again within 60 s: acknowledge, record the repeat only.
  prune(recent, REPEAT_WINDOW_MS, now);
  const repeatKey = `${lead.email.toLowerCase()}|${phone}`;
  if (now - (recent.get(repeatKey) || 0) < REPEAT_WINDOW_MS) {
    await flag('repeat_within_60s');
    return json(res, 200, ok200);
  }

  if (rateLimited(geo.ip, now)) {
    await flag('rate_limit');
    return json(res, 429, { success: false, data: { message: 'Too many submissions. Please try again in a few minutes.' } });
  }
  recent.set(repeatKey, now);

  // Same IP, different details again and again: looks like spam. Nobody is turned away: the visitor sees the normal
  // success message and the full details are stored in Heffl in "Unqualified" as ABUSE: same_ip_multiple.
  if (geo.ip) {
    prune(ipIdentities, RATE_WINDOW_MS, now);
    const seen = new Map([...(ipIdentities.get(geo.ip) || [])].filter(([, t]) => now - t < RATE_WINDOW_MS));
    const flagged = !seen.has(repeatKey) && seen.size >= IP_IDENTITY_MAX;
    seen.set(repeatKey, now);
    ipIdentities.set(geo.ip, seen);
    if (flagged) {
      await flag('same_ip_multiple');
      return json(res, 200, ok200);
    }
  }

  if (process.env.HEFFL_API_KEY) {
    const meta = { ip: geo.ip, country: geo.country, region: geo.region, city: geo.city, abuse: null, campaign: attrLog(attr) };
    try {
      const result = await sendToHeffl(person, ctx);
      if (result.taskCreated) {
        console.error(JSON.stringify({ event: 'lead_failure_task_created', ...result.info, ...meta }));
      } else if (!result.ok) {
        await recover(record, result.info, meta);
      }
    } catch (err) {
      await recover(record, { status: null, code: 'exception', error: err && err.name }, meta);
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
