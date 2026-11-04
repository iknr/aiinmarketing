#!/usr/bin/env node
/* Post-deploy check of the LIVE site against the key protected invariants. Creates NO leads: the only POST to the
 * form endpoint is intercepted in the browser and answered by a mock; the one direct POST to /api/lead is an EMPTY
 * body (the function rejects it with 400 and stores nothing: "a submission with nothing typed creates nothing").
 *
 *   node scripts/live-check.js [baseUrl]      default https://aiinmarketing.in
 *
 * Prints PASS/FAIL per check, exits 1 if any check fails. Run it after EVERY production deployment is READY.
 * Needs the preinstalled Chromium + Playwright (require('playwright')). */
'use strict';
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const BASE = (process.argv[2] || 'https://aiinmarketing.in').replace(/\/$/, '');
const ROOT = path.resolve(__dirname, '..');
const GTM = 'GTM-NPKP66BD';
const inj = fs.readFileSync(path.join(ROOT, 'scripts', 'inject-gtm.js'), 'utf8');
const VER = (/TRACK_VER\s*=\s*'([^']+)'/.exec(inj) || [])[1];
const PAGES = ['/', '/about', '/blogs', '/privacy-policy', '/terms', '/author/kailasnathr', '/author/kautilyaroshan'];
const POSTS = fs.readdirSync(path.join(ROOT, 'blogs')).filter((f) => f.endsWith('.html') && f !== 'index.html').map((f) => '/blogs/' + f.replace(/\.html$/, ''));
const count = (s, sub) => s.split(sub).length - 1;

let failed = 0;
const report = (ok, name, detail) => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail && !ok ? '  -> ' + detail : ''}`); };
async function check(name, fn) { try { const r = await fn(); report(r === true || r === undefined, name, typeof r === 'string' ? r : ''); } catch (e) { report(false, name, e.message); } }

(async () => {
  console.log(`live-check ${BASE} (aim-track.js ?ver=${VER})\n`);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const api = ctx.request;
  const get = async (p, o = {}) => api.get(BASE + p, { maxRedirects: 0, ...o });
  const texts = {};
  const text = async (p) => (texts[p] = texts[p] || (await (await get(p, { maxRedirects: 5 })).text()));

  for (const p of [...PAGES, ...POSTS]) {
    await check(`page ${p}: 200, GTM once (loader+noscript), no old container, one aim-track.js @${VER}`, async () => {
      const r = await get(p, { maxRedirects: 5 });
      if (r.status() !== 200) return `status ${r.status()}`;
      const h = await r.text(); texts[p] = h;
      const loader = count(h, `gtm.js?id=${GTM}`), ns = count(h, `ns.html?id=${GTM}`);
      if (loader !== 1 || ns !== 1) return `GTM loader ${loader}, noscript ${ns}`;
      if (h.includes('GTM-M3H6S33J')) return 'old GTM container present';
      const tags = h.match(/<script[^>]*aim-track\.js[^>]*>/gi) || [];
      if (tags.length !== 1 || !tags[0].includes(`aim-track.js?ver=${VER}`)) return `aim-track tags: ${tags.join(' ')}`;
      return true;
    });
  }
  await check(`aim-track.js?ver=${VER} loads and contains the attribution code`, async () => {
    const r = await get(`/wp-content/plugins/elementor/assets/js/aim-track.js?ver=${VER}`);
    if (r.status() !== 200) return `status ${r.status()}`;
    const s = await r.text();
    const miss = ['aim_attr_first', 'aim_attr_last', 'attribution_set', 'form_fields[', 'utm_source', 'click_id'].filter((n) => !s.includes(n));
    return miss.length ? 'missing ' + miss.join(', ') : true;
  });
  await check('privacy policy has IP, location, Clarity, GA, GTM, Heffl, campaign sentence, no-sale sentence, effective date', async () => {
    const t = (await text('/privacy-policy')).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&rsquo;/g, "'").replace(/\s+/g, ' ').toLowerCase();
    const need = ['ip address', 'approximate location', 'microsoft clarity', 'google analytics', 'google tag manager', 'heffl', 'which campaign or link brought you', 'we do not sell your personal information', 'effective date'];
    const miss = need.filter((n) => !t.includes(n));
    return miss.length ? 'missing: ' + miss.join('; ') : true;
  });
  await check('GET /api/lead -> 405 JSON', async () => {
    const r = await get('/api/lead');
    if (r.status() !== 405) return `status ${r.status()}`;
    const j = await r.json();
    return j && j.success === false ? true : 'body not the expected JSON';
  });
  await check('POST /api/lead with an empty body -> 400 JSON (nothing is stored)', async () => {
    const r = await api.post(BASE + '/api/lead', { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: BASE }, data: '' });
    if (r.status() !== 400) return `status ${r.status()}`;
    if (!/json/.test(r.headers()['content-type'] || '')) return 'not JSON';
    const j = await r.json();
    return j && j.success === false ? true : 'unexpected body';
  });
  await check('/wp-admin/admin-ajax.php is routed to the lead function (GET -> 405 JSON)', async () => {
    const r = await get('/wp-admin/admin-ajax.php');
    return r.status() === 405 && /json/.test(r.headers()['content-type'] || '') ? true : `status ${r.status()}`;
  });
  await check('/blog redirects permanently to /blogs and /blog/x to /blogs/x', async () => {
    const a = await get('/blog'), b = await get('/blog/some-slug');
    const la = a.headers().location || '', lb = b.headers().location || '';
    if (![301, 308].includes(a.status()) || !/\/blogs$/.test(la)) return `/blog -> ${a.status()} ${la}`;
    if (![301, 308].includes(b.status()) || !/\/blogs\/some-slug$/.test(lb)) return `/blog/x -> ${b.status()} ${lb}`;
    return true;
  });
  await check('/wp-login.php answers 200 with noindex (header and meta) and is not in the sitemap', async () => {
    const r = await get('/wp-login.php', { maxRedirects: 5 });
    if (r.status() !== 200) return `status ${r.status()}`;
    if (!/noindex/i.test(r.headers()['x-robots-tag'] || '')) return 'X-Robots-Tag noindex missing';
    if (!/<meta[^>]*robots[^>]*noindex/i.test(await r.text())) return 'noindex meta missing';
    return /wp-login|wp-admin/i.test(await text('/sitemap.xml')) ? 'sitemap lists the login' : true;
  });
  await check('robots.txt: Disallow /wp-admin/ /wp-login.php /api/, Allow admin-ajax, Sitemap line', async () => {
    const r = await get('/robots.txt'); const t = await r.text();
    if (r.status() !== 200) return `status ${r.status()}`;
    const miss = ['Disallow: /wp-admin/', 'Disallow: /wp-login.php', 'Disallow: /api/', 'Allow: /wp-admin/admin-ajax.php', 'Sitemap: https://aiinmarketing.in/sitemap.xml', 'GPTBot', 'ClaudeBot'].filter((n) => !t.includes(n));
    return miss.length ? 'missing ' + miss.join(', ') : true;
  });
  await check('sitemap.xml is served and lists every blog post', async () => {
    const r = await get('/sitemap.xml'); const t = await r.text();
    if (r.status() !== 200 || !t.includes('<urlset')) return `status ${r.status()}`;
    const miss = POSTS.filter((p) => !t.includes(`https://aiinmarketing.in${p}<`));
    return miss.length ? 'missing ' + miss.join(', ') : true;
  });
  await check('llms.txt is served', async () => ((await get('/llms.txt')).status() === 200 ? true : 'not 200'));
  await check('security headers (nosniff, referrer-policy) are present', async () => {
    const h = (await get('/')).headers();
    return h['x-content-type-options'] === 'nosniff' && /strict-origin-when-cross-origin/.test(h['referrer-policy'] || '') ? true : JSON.stringify({ n: h['x-content-type-options'], r: h['referrer-policy'] });
  });
  for (const p of POSTS) {
    await check(`post ${p}: both authors in byline, one authors block, two-Person Article schema`, async () => {
      const h = await text(p);
      if (!h.includes('href="/author/kailasnathr" rel="author"') || !h.includes('href="/author/kautilyaroshan" rel="author"')) return 'byline authors missing';
      if (count(h, 'class="aimb-authors"') !== 1) return `${count(h, 'class="aimb-authors"')} authors blocks`;
      const m = /<script[^>]*ld\+json[^>]*>(\{[^]*?"@type": ?"Article"[^]*?)<\/script>/.exec(h);
      if (!m) return 'Article JSON-LD not found';
      const j = JSON.parse(m[1]);
      return Array.isArray(j.author) && j.author.length === 2 ? true : 'author is not an array of two';
    });
  }
  // mocked form submission on the live site: the UTM hidden fields must be in the POST body; nothing reaches the server
  await check('form submit on the live site carries the utm_* / click_id / attribution fields (POST is mocked)', async () => {
    const page = await ctx.newPage();
    let body = null;
    await page.route('**/wp-admin/admin-ajax.php', async (route) => {
      if (route.request().method() === 'POST') {
        body = route.request().postData() || '';
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { message: 'mock' } }) });
      }
      return route.continue();
    });
    await page.route(/googletagmanager|clarity|google-analytics/, (r) => r.abort());
    await page.route('**/*.pdf', (r) => r.abort());
    const post = POSTS.find((p) => /rtcros/.test(p)) || POSTS[0];
    await page.goto(`${BASE}${post}?utm_source=livecheck&utm_medium=cpc&utm_campaign=guard&gclid=LIVECHECK123`, { waitUntil: 'domcontentloaded' });
    await page.fill('form.aim-magnet-form [name="form_fields[name]"]', 'Live Check');
    await page.fill('form.aim-magnet-form [name="form_fields[phone]"]', '9876543210');
    await page.fill('form.aim-magnet-form [name="form_fields[email]"]', 'live-check@example.invalid');
    await page.click('form.aim-magnet-form button[type="submit"]');
    await page.waitForTimeout(1500);
    await page.close();
    if (body === null) return 'no POST was made by the form';
    const q = new URLSearchParams(body);
    const miss = ['utm_source', 'utm_medium', 'utm_campaign', 'click_id', 'attribution'].filter((k) => !q.get(`form_fields[${k}]`));
    if (miss.length) return 'hidden fields missing: ' + miss.join(', ');
    return q.get('form_fields[utm_source]') === 'livecheck' && /^gclid:/.test(q.get('form_fields[click_id]')) ? true : 'wrong values: ' + body.slice(0, 200);
  });

  await browser.close();
  console.log(failed ? `\nLIVE CHECK FAILED: ${failed} check(s)` : '\nLIVE CHECK OK');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('live-check crashed:', e); process.exit(2); });
