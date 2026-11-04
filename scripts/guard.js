#!/usr/bin/env node
/* BUILD GUARD. Runs in the Vercel build right after scripts/inject-gtm.js (vercel.json buildCommand) and in
 * scripts/publish.sh. Exit 1 = a protected security / privacy / tracking / CRM / SEO / content feature is
 * missing, so the deployment FAILS and Vercel keeps serving the last good production deployment.
 *
 *   node scripts/guard.js            check the working tree
 *   GUARD_SOFT=1 node scripts/guard.js   OWNER EMERGENCY ONLY: print the same violations as warnings, exit 0
 *
 * No dependencies, no network. Takes a few seconds (it runs the offline lead tests).
 *
 * HOW TO ADD A PROTECTED FEATURE: append one entry to INVARIANTS below (id, title, why = owner-facing
 * explanation, check = function returning an array of problem strings, each saying file + what is missing +
 * how to fix), add a test for it in the same commit, and raise MIN_LEAD_TESTS if you added lead tests.
 * Never loosen or delete an entry to get a deploy through (see CLAUDE.md).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const GTM_ID = 'GTM-NPKP66BD';
const OLD_GTM_ID = 'GTM-M3H6S33J';
const SITE = 'https://aiinmarketing.in';
const MIN_LEAD_TESTS = 50; // tools/test-lead.js must pass at least this many checks. RAISE when you add tests, never lower.
const SKIP_DIRS = new Set(['node_modules', '.git', '.vercel', '.next']);
// Posts published before the "Sources" rule. Do not add to this list: new posts need a Sources section.
const NO_SOURCES_GRANDFATHERED = new Set([
  'ad-accounts-run-themselves', 'agentic-ai-marketing-work-competitors-hand-to-agents',
  'ai-advertising-problems-nobody-posts-about', 'ai-in-marketing-course-what-to-look-for',
  'best-digital-marketing-courses-india-2026-how-to-choose', 'the-ad-account-nobody-shows-you-book',
  'what-is-vibe-marketing', 'who-owns-your-ad-account-case-study', 'zero-click-ai-search-and-ads',
]);

// ---------- helpers ----------
const abs = (f) => path.join(ROOT, f);
const exists = (f) => fs.existsSync(abs(f));
const read = (f) => fs.readFileSync(abs(f), 'utf8');
const tryRead = (f) => { try { return read(f); } catch (e) { return null; } };
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), out); } else out.push(path.join(dir, e.name));
  }
  return out;
}
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
let _files = null;
const allFiles = () => (_files = _files || walk(ROOT).map(rel));
const htmlFiles = () => allFiles().filter((f) => f.toLowerCase().endsWith('.html'));
const publicHtml = () => htmlFiles().filter((f) => f !== 'wp-login.html');
const blogPosts = () => htmlFiles().filter((f) => /^blogs\/[^/]+\.html$/.test(f) && f !== 'blogs/index.html');
const slugOf = (f) => path.basename(f, '.html');
const count = (s, sub) => (s.split(sub).length - 1);
const decode = (s) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&rsquo;|&lsquo;/g, "'").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n));
const visibleText = (h) => decode(h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
const norm = (s) => s.replace(/\s+/g, ' ').toLowerCase();
function jsonLd(html) {
  const out = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) { try { out.push({ ok: true, data: JSON.parse(m[1]) }); } catch (e) { out.push({ ok: false, err: e.message }); } }
  return out;
}
const flat = (x) => (Array.isArray(x) ? x : [x]);
const typeOf = (o) => flat((o && o['@type']) || []);
const titleOf = (h) => decode(((/<title>([\s\S]*?)<\/title>/i.exec(h) || [])[1] || '').trim());
const descOf = (h) => decode(((/<meta\s+name=["']description["']\s+content=(?:"([^"]*)"|'([^']*)')/i.exec(h) || []).slice(1).find(Boolean) || '').trim());
const canonicals = (h) => [...h.matchAll(/<link\s+[^>]*rel=["']canonical["'][^>]*>/gi)].map((m) => (/href=["']([^"']*)["']/i.exec(m[0]) || [])[1] || '');
function pageUrl(f) { // html file -> public URL
  if (f === 'index.html') return SITE + '/';
  return SITE + '/' + f.replace(/\/index\.html$/, '').replace(/\.html$/, '');
}
function sitemapUrls() {
  const x = tryRead('sitemap.xml');
  return x === null ? null : [...x.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
}

// ---------- invariants ----------
const INVARIANTS = [
  {
    id: 'lead-endpoint-source',
    title: 'api/lead.js keeps its abuse, IP, geo, failure-task and timeout logic',
    why: 'Every form submission is validated, rate limited, IP/location tagged, stored in Heffl (abuse as Unqualified leads) and never lost. Removing any part silently weakens lead capture or lets spam through.',
    check() {
      const p = [], f = 'api/lead.js', s = tryRead(f);
      if (s === null) return [`${f}: file missing. Restore it: git log --diff-filter=D -- ${f}`];
      const need = [
        ['ALLOWED_HOSTS = [\'aiinmarketing.in\', \'www.aiinmarketing.in\']', 'origin allow-list (aiinmarketing.in and www)'],
        ['ALLOWED_HOSTS.includes(', 'origin allow-list check being used'],
        ['bad_origin', 'bad_origin abuse type'], ['RATE_MAX', 'in-memory rate limit'], ['RATE_WINDOW_MS', 'rate limit window'],
        ['rate_limit', 'rate_limit abuse type'], ['REPEAT_WINDOW_MS', 'repeat suppression window'],
        ['repeat_within_60s', 'repeat-within-60s suppression'], ['bot_user_agent', 'bot user-agent flag'],
        ['same_ip_multiple', 'same IP different details flag'], ['IP_IDENTITY_MAX', 'IP identity constant'],
        ['invalid_input', 'invalid_input abuse type'], ['ABUSE_STAGE_NAME = \'Unqualified\'', 'abuse stage "Unqualified"'],
        ['`ABUSE: ${type}`', 'ABUSE: <type> title prefix'], ['unqualified_stage_missing', 'missing-stage fallback'],
        ['abuseTitle', 'abuse title builder (IP + geo + UTM)'], ['buildAttribution', 'UTM attribution builder'],
        ['x-real-ip', 'IP from x-real-ip'], ['x-forwarded-for', 'IP fallback x-forwarded-for'],
        ['x-vercel-ip-country', 'Vercel country header'], ['x-vercel-ip-country-region', 'Vercel region header'], ['x-vercel-ip-city', 'Vercel city header'],
        ['clientIp', 'client IP function'], ['request_rejected', 'request_rejected log'], ['lead_crm_failed', 'lead_crm_failed log'],
        ['lead_failure_task_created', 'failure task log'], ['Lead capture failed:', 'failure task title'],
        ['formatIST', 'IST time formatting'], [' IST`', 'IST suffix'], ['FORM_LABELS', 'friendly form names'], ['SOURCE_LABELS', 'friendly source names'],
        ['new AbortController()', 'request timeout via AbortController'], ['HEFFL_BUDGET_MS', 'Heffl time budget'],
        ['LEAD_WEBHOOK_URL', 'webhook fallback'],
      ];
      for (const [needle, what] of need) if (!s.includes(needle)) p.push(`${f}: missing ${what} (looked for \`${needle}\`). Restore from history: git log -S'${needle.replace(/'/g, '')}' -- ${f}`);
      if (/HEFFL_API_KEY\s*[:=]\s*['"`][^'"`\s]/.test(s.replace(/process\.env\.HEFFL_API_KEY\s*===?\s*['"`]/g, ''))) p.push(`${f}: HEFFL_API_KEY is assigned a literal. The key must only come from process.env.HEFFL_API_KEY.`);
      const hdr = /['"]x-api-key['"]\s*:\s*([^,}\n]+)/.exec(s);
      if (!hdr || hdr[1].trim() !== 'process.env.HEFFL_API_KEY') p.push(`${f}: the x-api-key header must be exactly process.env.HEFFL_API_KEY (found: ${hdr ? hdr[1].trim() : 'none'}).`);
      if (/const\s*\{[^}]*HEFFL_API_KEY[^}]*\}\s*=\s*process\.env/.test(s)) p.push(`${f}: HEFFL_API_KEY is destructured from process.env; read it as process.env.HEFFL_API_KEY at use time.`);
      if (/console\.(log|warn|error)\([^)]*process\.env\.HEFFL_API_KEY/.test(s)) p.push(`${f}: the API key must never be logged.`);
      return p;
    },
  },
  {
    id: 'lead-tests',
    title: `Offline lead tests pass and there are at least ${MIN_LEAD_TESTS}`,
    why: 'tools/test-lead.js proves the lead function behaves as documented (abuse records, IP/geo, failure tasks, no secrets logged). Fewer tests than before means someone deleted proof.',
    check() {
      if (!exists('tools/test-lead.js')) return ['tools/test-lead.js missing. Restore from git history.'];
      const r = spawnSync(process.execPath, [abs('tools/test-lead.js')], { encoding: 'utf8', cwd: ROOT, timeout: 120000 });
      const out = (r.stdout || '') + (r.stderr || '');
      const ok = (out.match(/^ok\s+-/gm) || []).length;
      const sum = /(\d+)\/(\d+) passed/.exec(out);
      const p = [];
      if (r.status !== 0) p.push('tools/test-lead.js failed:\n    ' + out.split('\n').filter((l) => /^\s*FAIL\b|AssertionError|not ok/.test(l)).slice(0, 8).join('\n    ') + '\n    Fix api/lead.js (not the test) unless the behaviour change is intended and documented in CLAUDE.md.');
      const total = sum ? +sum[2] : ok;
      if (total < MIN_LEAD_TESTS) p.push(`tools/test-lead.js has ${total} checks, minimum is ${MIN_LEAD_TESTS} (MIN_LEAD_TESTS in scripts/guard.js). Tests were deleted: restore them.`);
      return p;
    },
  },
  {
    id: 'gtm-and-track-on-every-page',
    title: 'Every HTML page: GTM once (loader + noscript), no old container, one aim-track.js at the current version, valid UTF-8, one canonical',
    why: 'Analytics (GA4, Clarity, Search Console) and the lead/UTM script load through these tags. A missing or duplicated tag loses or double-counts data.',
    check() {
      const p = [];
      const inj = tryRead('scripts/inject-gtm.js') || '';
      const ver = (/TRACK_VER\s*=\s*'([^']+)'/.exec(inj) || [])[1];
      if (!ver) p.push('scripts/inject-gtm.js: TRACK_VER missing. Restore it.');
      if (!inj.includes(GTM_ID)) p.push(`scripts/inject-gtm.js: container ${GTM_ID} missing.`);
      for (const f of htmlFiles()) {
        const buf = fs.readFileSync(abs(f));
        let h;
        try { h = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { p.push(`${f}: not valid UTF-8. Re-save as UTF-8.`); continue; }
        const loader = count(h, `googletagmanager.com/gtm.js?id=${GTM_ID}`), ns = count(h, `googletagmanager.com/ns.html?id=${GTM_ID}`);
        if (loader !== 1) p.push(`${f}: GTM loader appears ${loader} times (must be 1). Run node scripts/inject-gtm.js and remove duplicates by hand.`);
        if (ns !== 1) p.push(`${f}: GTM noscript iframe appears ${ns} times (must be 1). Run node scripts/inject-gtm.js.`);
        if (h.includes(OLD_GTM_ID)) p.push(`${f}: old container ${OLD_GTM_ID} present. Remove it.`);
        const tags = [...h.matchAll(/<script[^>]*src=["'][^"']*aim-track\.js[^"']*["'][^>]*>/gi)].map((m) => m[0]);
        if (tags.length !== 1) p.push(`${f}: ${tags.length} aim-track.js script tags (must be 1). Run node scripts/inject-gtm.js.`);
        else if (ver && !tags[0].includes(`aim-track.js?ver=${ver}`)) p.push(`${f}: aim-track.js is not at ?ver=${ver}. Run node scripts/inject-gtm.js.`);
        if (f !== 'wp-login.html') {
          const c = canonicals(h);
          if (c.length !== 1) p.push(`${f}: ${c.length} canonical links (must be exactly 1).`);
          else if (!c[0].startsWith(SITE)) p.push(`${f}: canonical ${c[0]} is not on ${SITE}.`);
        }
      }
      return p;
    },
  },
  {
    id: 'attribution-script',
    title: 'aim-track.js keeps UTM/click-id/referrer attribution and the dataLayer events',
    why: 'First/last-touch campaign data is attached to every lead through hidden form_fields[...] inputs added by this script. Without it, leads arrive with no campaign information.',
    check() {
      const f = 'wp-content/plugins/elementor/assets/js/aim-track.js', s = tryRead(f);
      if (s === null) return [`${f}: file missing. Restore from git history.`];
      const p = [];
      const need = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'msclkid', 'click_id', 'referrer_host', 'landing_path',
        'aim_attr_first', 'aim_attr_last', 'localStorage', 'sessionStorage', 'form_fields[', 'attribution',
        'apply_click', 'buy_click', 'lead_submit', 'guide_download', 'track_click', 'attribution_set', 'dataLayer'];
      for (const n of need) if (!s.includes(n)) p.push(`${f}: missing \`${n}\`. Restore from history: git log -S'${n}' -- ${f}`);
      if (!/addEventListener\(\s*'submit'[\s\S]*?\},\s*true\s*\)/.test(s)) p.push(`${f}: the capture-phase submit listener (addEventListener('submit', ..., true)) is missing; hidden UTM inputs would no longer be added.`);
      if ((s.match(/\btry\s*\{/g) || []).length < 3) p.push(`${f}: storage access must stay inside try/catch (fewer than 3 try blocks found).`);
      for (const js of ['wp-content/plugins/elementor/assets/js/aim-magnet.js', 'wp-content/plugins/elementor/assets/js/frontend.js']) {
        const t = tryRead(js);
        if (t === null) p.push(`${js}: file missing.`);
        else if (!/fetch\(\s*form\.action/.test(t)) p.push(`${js}: forms must still be submitted with fetch(form.action, ...) (action is /wp-admin/admin-ajax.php).`);
      }
      const idx = tryRead('index.html') || '';
      if (!/<form[^>]*action=["']\/wp-admin\/admin-ajax\.php["']/.test(idx)) p.push('index.html: no <form action="/wp-admin/admin-ajax.php"> found; the lead forms are gone or point elsewhere.');
      return p;
    },
  },
  {
    id: 'privacy-policy',
    title: 'privacy-policy.html discloses IP/location capture, tracking tools, Heffl and campaign memory',
    why: 'The site collects IP address, approximate location, campaign data and sends form details to Heffl. The policy must say so (legal requirement). Update the policy whenever collection changes.',
    check() {
      const f = 'privacy-policy.html', h = tryRead(f);
      if (h === null) return [`${f}: file missing.`];
      const t = norm(visibleText(h));
      const need = ['ip address', 'approximate location', 'country', 'region', 'city', 'microsoft clarity', 'google analytics', 'google tag manager', 'heffl',
        'which campaign or link brought you', 'we do not sell your personal information', 'effective date'];
      return need.filter((n) => !t.includes(n)).map((n) => `${f}: the text "${n}" is missing. Restore the original wording: git log -S'${n}' -- ${f}`);
    },
  },
  {
    id: 'vercel-config',
    title: 'vercel.json keeps redirects, decoy-login and form rewrites, headers and the guarded build',
    why: 'Redirects keep SEO value, the rewrites hide the real admin and route forms to the lead function, headers harden the site, and the buildCommand runs GTM injection and this guard.',
    check() {
      const f = 'vercel.json', s = tryRead(f);
      if (s === null) return [`${f}: file missing.`];
      let v; try { v = JSON.parse(s); } catch (e) { return [`${f}: invalid JSON (${e.message}).`]; }
      const p = [];
      const bc = v.buildCommand || '';
      const i1 = bc.indexOf('scripts/inject-gtm.js'), i2 = bc.indexOf('scripts/guard.js');
      if (i1 < 0) p.push(`${f}: buildCommand must run node scripts/inject-gtm.js (found "${bc}").`);
      if (i2 < 0) p.push(`${f}: buildCommand must run node scripts/guard.js after inject-gtm: "node scripts/inject-gtm.js && node scripts/guard.js" (found "${bc}"). Without it, a bad commit can deploy.`);
      else if (i1 >= 0 && i2 < i1) p.push(`${f}: guard must run AFTER inject-gtm in buildCommand.`);
      if (i2 >= 0 && !/&&/.test(bc)) p.push(`${f}: buildCommand must chain with && so a guard failure fails the build.`);
      if (v.outputDirectory !== '.') p.push(`${f}: outputDirectory must be "." (otherwise STATIC_BUILD_NO_OUT_DIR).`);
      if (v.cleanUrls !== true) p.push(`${f}: cleanUrls must be true.`);
      const red = v.redirects || [];
      const hasRed = (a, b) => red.some((r) => r.source === a && r.destination === b && (r.permanent === true || r.statusCode === 301 || r.statusCode === 308));
      if (!hasRed('/blog', '/blogs')) p.push(`${f}: permanent redirect /blog -> /blogs missing.`);
      if (!hasRed('/blog/:slug', '/blogs/:slug')) p.push(`${f}: permanent redirect /blog/:slug -> /blogs/:slug missing.`);
      const rw = v.rewrites || [];
      for (const src of ['/wp-login.php', '/wp-admin', '/wp-admin/', '/wp-admin/index.php']) if (!rw.some((r) => r.source === src && r.destination === '/wp-login')) p.push(`${f}: rewrite ${src} -> /wp-login (decoy login) missing.`);
      if (!rw.some((r) => r.source === '/wp-admin/admin-ajax.php' && r.destination === '/api/lead')) p.push(`${f}: rewrite /wp-admin/admin-ajax.php -> /api/lead missing; forms would stop working.`);
      const hv = (srcPart, key, valPart) => (v.headers || []).some((h) => String(h.source).includes(srcPart) && (h.headers || []).some((x) => x.key.toLowerCase() === key.toLowerCase() && String(x.value).toLowerCase().includes(valPart)));
      if (!hv('/(.*)', 'X-Content-Type-Options', 'nosniff')) p.push(`${f}: header X-Content-Type-Options: nosniff missing.`);
      if (!hv('/(.*)', 'Referrer-Policy', 'strict-origin-when-cross-origin')) p.push(`${f}: header Referrer-Policy missing.`);
      if (!hv('wp-login', 'X-Robots-Tag', 'noindex')) p.push(`${f}: X-Robots-Tag noindex on the decoy login missing.`);
      if (!hv('wp-login', 'X-Frame-Options', 'sameorigin')) p.push(`${f}: X-Frame-Options on the decoy login missing.`);
      if (!hv('wp-login', 'Cache-Control', 'no-store')) p.push(`${f}: no-store Cache-Control on the decoy login missing.`);
      return p;
    },
  },
  {
    id: 'robots-sitemap-login',
    title: 'robots.txt rules, sitemap.xml coverage and the noindex, unlinked decoy login',
    why: 'Search and AI crawlers must reach every public page but never the login or API; the sitemap must list exactly the public pages; the decoy login must stay hidden.',
    check() {
      const p = [];
      const r = tryRead('robots.txt');
      if (r === null) p.push('robots.txt: file missing.');
      else {
        const groups = []; let cur = null;
        for (const line of r.split(/\r?\n/)) {
          const l = line.replace(/#.*/, '').trim(); if (!l) { continue; }
          const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(l); if (!m) continue;
          const k = m[1].toLowerCase();
          if (k === 'user-agent') { if (!cur || cur.rules.length) { cur = { agents: [], rules: [] }; groups.push(cur); } cur.agents.push(m[2].trim().toLowerCase()); }
          else if (cur && (k === 'allow' || k === 'disallow')) cur.rules.push([k, m[2].trim()]);
        }
        const groupFor = (a) => groups.find((g) => g.agents.includes(a.toLowerCase()));
        for (const a of ['*', 'Googlebot', 'Bingbot', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Google-Extended', 'CCBot', 'Applebot-Extended', 'Meta-ExternalAgent']) {
          const g = groupFor(a);
          if (!g) { p.push(`robots.txt: no group for User-agent: ${a}.`); continue; }
          const has = (k, v) => g.rules.some(([kk, vv]) => kk === k && vv === v);
          for (const d of ['/wp-admin/', '/wp-login.php', '/api/']) if (!has('disallow', d)) p.push(`robots.txt: group "${a}" lacks Disallow: ${d}`);
          if (!has('allow', '/wp-admin/admin-ajax.php')) p.push(`robots.txt: group "${a}" lacks Allow: /wp-admin/admin-ajax.php`);
          if (!has('allow', '/')) p.push(`robots.txt: group "${a}" lacks Allow: /`);
        }
        if (!/^Sitemap:\s*https:\/\/aiinmarketing\.in\/sitemap\.xml\s*$/mi.test(r)) p.push(`robots.txt: "Sitemap: ${SITE}/sitemap.xml" line missing.`);
      }
      const urls = sitemapUrls();
      if (urls === null) p.push('sitemap.xml: file missing.');
      else {
        const x = read('sitemap.xml');
        if (!/<urlset[\s>]/.test(x) || !/<\/urlset>\s*$/.test(x.trim())) p.push('sitemap.xml: not a well-formed <urlset>.');
        if (/wp-login|wp-admin/i.test(x)) p.push('sitemap.xml: contains a wp-login / wp-admin URL. Remove it.');
        const want = new Set(publicHtml().map(pageUrl));
        for (const u of urls) { if (!u.startsWith(SITE + '/') ) p.push(`sitemap.xml: ${u} is not on the apex host ${SITE}.`); else if (!want.has(u)) p.push(`sitemap.xml: ${u} has no matching page (or is not public).`); }
        const have = new Set(urls);
        for (const u of want) if (!have.has(u)) p.push(`sitemap.xml: public page ${u} is not listed. Add a <url><loc> entry.`);
        if (urls.length !== have.size) p.push('sitemap.xml: duplicate <loc> entries.');
      }
      const wl = tryRead('wp-login.html');
      if (wl === null) p.push('wp-login.html: decoy login page missing.');
      else if (!/<meta[^>]*name=["']robots["'][^>]*noindex/i.test(wl)) p.push('wp-login.html: noindex robots meta missing.');
      for (const f of htmlFiles()) if (f !== 'wp-login.html' && /wp-login|wp-admin(?!\/admin-ajax)/.test(tryRead(f).replace(/\/wp-admin\/(css|js|images)\//g, '').replace(/\/wp-admin\/admin-ajax\.php/g, ''))) p.push(`${f}: links to or mentions wp-login / wp-admin; the decoy login must not be linked.`);
      return p;
    },
  },
  {
    id: 'blog-posts',
    title: 'Every blog post: both authors, authors block, Article + FAQPage schema, SEO basics, Sources, magnet form fields, listed everywhere',
    why: 'Posts are credited to both authors (E-E-A-T), carry valid schema, and must be discoverable (sitemap, blog index, llms.txt, author pages). The lead-magnet form needs its hidden fields or the lead has no form/source.',
    check() {
      const p = [];
      const sm = new Set(sitemapUrls() || []), idx = tryRead('blogs/index.html') || '', llms = tryRead('llms.txt') || '';
      const authorPages = { kailasnathr: tryRead('author/kailasnathr.html') || '', kautilyaroshan: tryRead('author/kautilyaroshan.html') || '' };
      for (const f of blogPosts()) {
        const slug = slugOf(f), h = read(f), url = `${SITE}/blogs/${slug}`;
        const bls = h.match(/<div[^>]*class=["'][^"']*\baimb-byline\b[^"']*["']/g) || [];
        if (bls.length !== 1) p.push(`${f}: ${bls.length} .aimb-byline components (must be exactly 1). Copy it from the newest post and run node scripts/readtime.js.`);
        else {
          const bl = (/<div[^>]*\baimb-byline\b[\s\S]*?<p class="aimb-bl-sub">[\s\S]*?<\/p>/.exec(h) || [''])[0];
          for (const [a, n] of [['kailasnathr', 'Kailas Nath R'], ['kautilyaroshan', 'Kautilya Roshan']]) {
            if (!new RegExp(`<a[^>]*href=["']/author/${a}["'][^>]*rel=["']author["']|<a[^>]*rel=["']author["'][^>]*href=["']/author/${a}["']`).test(bl.replace(/<div class="aimb-bl-card"[\s\S]*?<\/div><\/div>/g, ''))) p.push(`${f}: byline must link ${n} to /author/${a} with rel="author".`);
            if (!new RegExp(`class="aimb-bl-bio"[^>]*href=["']/author/${a}["']|href=["']/author/${a}["'][^>]*class="aimb-bl-bio"`).test(bl)) p.push(`${f}: byline card for ${n} needs a "Bio" link to /author/${a}.`);
          }
          if (count(bl, 'linkedin.com') < 2) p.push(`${f}: byline cards need a LinkedIn link per author.`);
          if (!/<time[^>]*datetime=["']\d{4}-\d{2}-\d{2}["']/.test(bl)) p.push(`${f}: byline needs a <time datetime="YYYY-MM-DD"> element.`);
          const rm = /(\d+) min read/.exec(bl);
          if (!rm || +rm[1] < 1) p.push(`${f}: byline needs "<n> min read" with n >= 1 (run node scripts/readtime.js ${f}).`);
        }
        if (!/<script[^>]*aim-byline\.js[^>]*>/.test(h)) p.push(`${f}: aim-byline.js script tag missing (copy it from the newest post).`);
        for (const mp of h.match(/<p[^>]*class=["'][^"']*\baimb-meta\b[^"']*["'][^>]*>[\s\S]*?<\/p>/g) || []) if (/\/author\/|\bBy\s/.test(mp)) p.push(`${f}: old-style .aimb-meta byline paragraph still credits the authors. Use the .aimb-byline component only.`);
        const blocks = h.match(/<section[^>]*class=["'][^"']*aimb-authors[^"']*["']/g) || [];
        if (blocks.length !== 1) p.push(`${f}: ${blocks.length} .aimb-authors blocks (must be exactly 1). Copy it from the newest post.`);
        else {
          const b = (/<section[^>]*aimb-authors[\s\S]*?<\/section>/.exec(h) || [''])[0];
          if (count(b, 'class="aimb-acard"') < 2 && count(b, 'aimb-acard') < 2) p.push(`${f}: authors block must contain two author cards.`);
          for (const a of ['/author/kailasnathr', '/author/kautilyaroshan']) if (!b.includes(`href="${a}"`)) p.push(`${f}: authors block lacks a link to ${a}.`);
          if (count(b, 'linkedin.com') < 2) p.push(`${f}: authors block needs a LinkedIn pill per author.`);
          if (!/amazon\./.test(b)) p.push(`${f}: authors block lacks the Book on Amazon pill.`);
          if (count(b, 'Full profile') < 2) p.push(`${f}: authors block needs a "Full profile" pill per author.`);
        }
        const ld = jsonLd(h);
        ld.forEach((x, i) => { if (!x.ok) p.push(`${f}: JSON-LD block ${i + 1} is invalid JSON (${x.err}).`); });
        const nodes = ld.filter((x) => x.ok).flatMap((x) => flat(x.data['@graph'] || x.data));
        const art = nodes.find((n) => typeOf(n).includes('Article') || typeOf(n).includes('BlogPosting'));
        if (!art) p.push(`${f}: Article JSON-LD missing.`);
        else {
          const au = flat(art.author || []);
          if (!Array.isArray(art.author) || au.length !== 2 || !au.every((a) => typeOf(a).includes('Person') && a.name && a.url && a.sameAs)) p.push(`${f}: Article JSON-LD "author" must be an array of two Persons with name, url and sameAs.`);
          else if (!au.some((a) => a.url === `${SITE}/author/kailasnathr`) || !au.some((a) => a.url === `${SITE}/author/kautilyaroshan`)) p.push(`${f}: Article JSON-LD authors must be the two author pages.`);
        }
        const faq = nodes.find((n) => typeOf(n).includes('FAQPage'));
        if (!faq) p.push(`${f}: FAQPage JSON-LD missing.`);
        else if (!Array.isArray(faq.mainEntity) || !faq.mainEntity.length || !faq.mainEntity.every((q) => typeOf(q).includes('Question') && q.name && q.acceptedAnswer && q.acceptedAnswer.text)) p.push(`${f}: FAQPage JSON-LD is invalid (every Question needs name + acceptedAnswer.text).`);
        const c = canonicals(h);
        if (c[0] !== url) p.push(`${f}: canonical must be ${url} (found ${c[0]}).`);
        const t = titleOf(h); if (!t || t.length > 60) p.push(`${f}: <title> is ${t.length} chars (max 60).`);
        const d = descOf(h); if (d.length < 120 || d.length > 160) p.push(`${f}: meta description is ${d.length} chars (must be 120 to 160).`);
        if (!NO_SOURCES_GRANDFATHERED.has(slug) && !/<h2[^>]*>[^<]*(sources|references)/i.test(h)) p.push(`${f}: needs a "Sources" section (<h2 id="sources">Sources and how we checked them</h2>).`);
        for (const form of h.match(/<form[^>]*aim-magnet-form[\s\S]*?<\/form>/g) || []) {
          if (!/<input[^>]*type=["']hidden["'][^>]*name=["']form_name["']/.test(form) && !/<input[^>]*name=["']form_name["'][^>]*type=["']hidden["']/.test(form)) p.push(`${f}: lead-magnet form lacks hidden input form_name.`);
          if (!/name=["']form_fields\[source\]["']/.test(form)) p.push(`${f}: lead-magnet form lacks hidden input form_fields[source].`);
          if (!/action=["']\/wp-admin\/admin-ajax\.php["']/.test(form)) p.push(`${f}: lead-magnet form action must be /wp-admin/admin-ajax.php.`);
        }
        if (!sm.has(url)) p.push(`${f}: not listed in sitemap.xml.`);
        if (!idx.includes(`/blogs/${slug}"`)) p.push(`${f}: not listed on blogs/index.html.`);
        if (!llms.includes(url)) p.push(`${f}: not listed in llms.txt.`);
        for (const [a, ah] of Object.entries(authorPages)) if (!ah.includes(`/blogs/${slug}"`)) p.push(`${f}: not in the "Articles by" grid of author/${a}.html.`);
      }
      for (const a of ['kailasnathr', 'kautilyaroshan']) {
        const f = `author/${a}.html`, h = tryRead(f);
        if (h === null) { p.push(`${f}: author page missing.`); continue; }
        if (canonicals(h)[0] !== `${SITE}/author/${a}`) p.push(`${f}: canonical must be ${SITE}/author/${a}.`);
        const nodes = jsonLd(h).filter((x) => x.ok).flatMap((x) => flat(x.data['@graph'] || x.data));
        if (!nodes.some((n) => typeOf(n).includes('ProfilePage'))) p.push(`${f}: ProfilePage JSON-LD missing.`);
      }
      return p;
    },
  },
  {
    id: 'content-consistency',
    title: 'One program price (Rs 5,999), 7-day guarantee wording, "Adsmentor" spelling, no placeholders',
    why: 'The price and guarantee are legal/commercial promises shown on many pages and in llms files; a stale price or placeholder text published by mistake is costly.',
    check() {
      const p = [];
      const texts = [...htmlFiles(), 'llms.txt', 'llms-full.txt'].filter(exists).map((f) => [f, f.endsWith('.html') ? visibleText(read(f)) : read(f)]);
      const bad = /(?<![\d,])(?:₹|Rs\.?|INR)\s?(2,?999|3,?999|4,?999)(?!\d)/g;
      for (const [f, t] of texts) {
        for (const m of t.matchAll(bad)) p.push(`${f}: "${m[0]}" looks like a program price. The only AIM price is Rs 5,999.`);
        if (/Ads Mentor/.test(t)) p.push(`${f}: "Ads Mentor" must be spelled "Adsmentor".`);
        if (/lorem ipsum|\bTODO\b|\bXXX+\b|\bFIXME\b|\[placeholder\]/i.test(t.replace(/\bxxx@/gi, ''))) p.push(`${f}: placeholder text (lorem ipsum / TODO / XXX / FIXME) found.`);
      }
      const T = Object.fromEntries(texts);
      for (const f of ['index.html', 'terms.html', 'llms.txt', 'llms-full.txt']) {
        if (T[f] === undefined) { p.push(`${f}: file missing.`); continue; }
        if (!/(₹|Rs\.?)\s?5,999/.test(T[f])) p.push(`${f}: the program fee "Rs 5,999" is not stated.`);
        if (!/7[- ]day money[- ]back/i.test(T[f])) p.push(`${f}: the "7-day money-back guarantee" wording is missing.`);
      }
      return p;
    },
  },
  {
    id: 'secret-hygiene',
    title: 'No API keys / tokens in the repo and no tracked .env file',
    why: 'The Heffl key lives only in Vercel environment variables. A key committed to GitHub must be treated as leaked.',
    check() {
      const p = [];
      const BIN = /\.(png|jpe?g|gif|webp|ico|pdf|woff2?|ttf|otf|eot|zip|mp4|mp3|svgz)$/i;
      const pats = [
        [/x-api-key['"]?\s*[:=]\s*['"][A-Za-z0-9_\-.]{16,}['"]/i, 'literal x-api-key value'],
        [/\b(api[_-]?key|token|secret|authorization|passwd|password)['"]?\s*[:=]\s*['"](?=[A-Za-z0-9_\-+/=.]*\d)(?=[A-Za-z0-9_\-+/=.]*[A-Za-z])[A-Za-z0-9_\-+/=.]{24,}['"]/i, 'long random value assigned to a key/token/secret name'],
        [/\bBearer\s+[A-Za-z0-9._\-]{24,}/, 'Bearer token'],
        [/\bsk-[A-Za-z0-9_\-]{20,}/, 'sk- API key'], [/\bgh[pousr]_[A-Za-z0-9]{30,}/, 'GitHub token'], [/\bgithub_pat_[A-Za-z0-9_]{30,}/, 'GitHub token'],
        [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key'], [/\bxox[abprs]-[A-Za-z0-9-]{10,}/, 'Slack token'], [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
      ];
      for (const f of allFiles()) {
        const base = path.basename(f);
        if (/^\.env(\..+)?$/.test(base) && !/example|sample|template/.test(base)) p.push(`${f}: an .env file is in the repo. Delete it, rotate every value in it, add it to .gitignore.`);
        if (BIN.test(f) || fs.statSync(abs(f)).size > 3e6) continue;
        const s = fs.readFileSync(abs(f), 'utf8');
        for (const [re, what] of pats) { const m = re.exec(s); if (m) p.push(`${f}: looks like a secret (${what}): "${m[0].slice(0, 12)}...". Remove it and rotate the key.`); }
      }
      return p;
    },
  },
];

// ---------- runner ----------
function run() {
  const t0 = Date.now(), results = [];
  for (const inv of INVARIANTS) {
    let problems;
    try { problems = inv.check(); } catch (e) { problems = [`guard crashed on this check: ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`]; }
    results.push({ inv, problems });
  }
  const failed = results.filter((r) => r.problems.length);
  const soft = process.env.GUARD_SOFT === '1';
  if (!failed.length) {
    console.log(`guard: all ${INVARIANTS.length} protected invariants OK (${htmlFiles().length} html files, ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    for (const r of results) console.log(`  ok   ${r.inv.id}`);
    return 0;
  }
  const tag = soft ? 'WARNING' : 'VIOLATION';
  console.error(`\nguard: ${failed.length} of ${INVARIANTS.length} protected invariants ${soft ? 'WARN (GUARD_SOFT=1, build continues)' : 'FAILED (build stops, production keeps the last good deployment)'}\n`);
  for (const { inv, problems } of failed) {
    console.error(`[${tag}] ${inv.id}: ${inv.title}`);
    console.error(`  why it matters: ${inv.why}`);
    for (const x of problems) console.error(`  - ${x}`);
    console.error('');
  }
  console.error('Fix the cause (restore the dropped feature with git log -S, keep your own change on top). Never loosen or delete a check. See "Concurrency and protected features" in CLAUDE.md.');
  return soft ? 0 : 1;
}

if (require.main === module) process.exit(run());
module.exports = { INVARIANTS, run };
