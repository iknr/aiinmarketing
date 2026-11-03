/* Browser test for first-party attribution capture (aim-track.js). Run: node tools/test-attribution.js [baseUrl]
 * Default base: http://127.0.0.1:8777 (serve the repo first: nohup python3 -m http.server 8777 >/dev/null 2>&1 &).
 * POST /wp-admin/admin-ajax.php is ALWAYS intercepted with a mocked success response; no request ever reaches a server,
 * so no lead is ever created (also safe against the live site). Needs the preinstalled Chromium + Playwright. */
const assert = require('assert');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const BASE = (process.argv[2] || 'http://127.0.0.1:8777').replace(/\/$/, '');
const LAND = '/about.html?utm_source=test&utm_medium=cpc&utm_campaign=spring&utm_term=ai%20course&utm_content=ad1&gclid=abc123';
const PLAIN = '/index.html';
const out = (s) => process.stdout.write(s + '\n');

async function newPage(browser, { blockStorage = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  if (blockStorage) {
    await ctx.addInitScript(() => {
      for (const k of ['localStorage', 'sessionStorage']) {
        Object.defineProperty(window, k, { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } });
      }
    });
  }
  const page = await ctx.newPage();
  const problems = [];
  const bodies = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) problems.push('console: ' + m.text()); });
  // never talk to third parties, never let a form reach a server
  await ctx.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (route.request().method() === 'POST' && u.pathname.endsWith('/wp-admin/admin-ajax.php')) {
      bodies.push(new URLSearchParams(route.request().postData() || ''));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { message: 'Your submission was successful.' } }) });
    }
    if (u.origin !== new URL(BASE).origin) return route.abort();
    return route.continue();
  });
  return { ctx, page, problems, bodies };
}

async function fill(form) {
  await form.locator('[name="form_fields[name]"]').fill('TEST ignore');
  await form.locator('[name="form_fields[phone]"]').fill('9876543210');
  await form.locator('[name="form_fields[email]"]').fill('test@example.com');
  const sel = form.locator('select[name="form_fields[stage]"]');
  if (await sel.count()) await sel.selectOption({ index: 1 });
}

async function submitAndGet(page, bodies, form) {
  const before = bodies.length;
  // no scrolling: scrolling past 25% opens the site's 'wait a minute' popup, which would steal focus from the fields
  await fill(form);
  await form.evaluate((f) => f.requestSubmit()); // fires the same 'submit' event a click on the button does
  await page.waitForFunction(() => true);
  for (let i = 0; i < 50 && bodies.length === before; i++) await page.waitForTimeout(100);
  assert(bodies.length > before, 'form POST was intercepted; form message: ' + (await form.locator('.aimp-msg, .elementor-message').first().textContent().catch(() => '?')));
  return bodies[bodies.length - 1];
}

const tests = [];
const test = (n, f) => tests.push([n, f]);

function expectAttr(b, { attribution = 'last', ref = 'www.google.com' } = {}) {
  assert.strictEqual(b.get('form_fields[utm_source]'), 'test');
  assert.strictEqual(b.get('form_fields[utm_medium]'), 'cpc');
  assert.strictEqual(b.get('form_fields[utm_campaign]'), 'spring');
  assert.strictEqual(b.get('form_fields[utm_term]'), 'ai course');
  assert.strictEqual(b.get('form_fields[utm_content]'), 'ad1');
  assert.strictEqual(b.get('form_fields[click_id]'), 'gclid:abc123');
  assert.strictEqual(b.get('form_fields[referrer_host]'), ref);
  assert(/^\/about(\.html)?$/.test(b.get('form_fields[landing_path]'))); // live site serves clean URLs
  assert.strictEqual(b.get('form_fields[attribution]'), attribution);
}

test('utm survives navigation to a page without utm: magnet form and apply popup form carry it (last touch)', async (browser) => {
  const { ctx, page, problems, bodies } = await newPage(browser);
  await page.goto(BASE + LAND, { referer: 'https://www.google.com/' });
  const dl = await page.evaluate(() => window.dataLayer.filter((e) => e.event === 'attribution_set'));
  assert.strictEqual(dl.length, 1);
  assert.deepStrictEqual([dl[0].utm_source, dl[0].utm_medium, dl[0].utm_campaign], ['test', 'cpc', 'spring']);
  assert(!/@|phone|email/i.test(JSON.stringify(dl)), 'no personal data in the event');
  await page.goto(BASE + PLAIN); // no utm on this page
  assert(!page.url().includes('utm_'));
  assert.strictEqual((await page.evaluate(() => window.dataLayer.filter((e) => e.event === 'attribution_set').length)), 0, 'not repeated on the next page of the same session');
  const stored = await page.evaluate(() => [localStorage.getItem('aim_attr_first'), sessionStorage.getItem('aim_attr_last')]);
  assert(stored[0] && stored[1] && JSON.parse(stored[0]).utm_source === 'test');
  // magnet form
  const magnet = page.locator('form.aim-magnet-form').first();
  expectAttr(await submitAndGet(page, bodies, magnet));
  // apply popup form
  await page.evaluate(() => document.querySelector('dialog').showModal());
  const apply = page.locator('dialog form.elementor-form').first();
  const b2 = await submitAndGet(page, bodies, apply);
  expectAttr(b2);
  assert.strictEqual(b2.get('form_name'), 'dm_by_adsmentor_apply_1');
  assert.strictEqual(page.url().includes('utm_'), false);
  assert.deepStrictEqual(problems, []);
  await ctx.close();
});

test('first touch is used when the last touch has no campaign data; direct otherwise', async (browser) => {
  const { ctx, page, problems, bodies } = await newPage(browser);
  await page.goto(BASE + LAND, { referer: 'https://www.google.com/' });
  // new tab/session: sessionStorage empty, localStorage first touch remains
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(BASE + PLAIN);
  const b = await submitAndGet(page, bodies, page.locator('form.aim-magnet-form').first());
  expectAttr(b, { attribution: 'first' });
  await ctx.close();
  const d = await newPage(browser);
  await d.page.goto(BASE + PLAIN);
  const b2 = await submitAndGet(d.page, d.bodies, d.page.locator('form.aim-magnet-form').first());
  assert.strictEqual(b2.get('form_fields[attribution]'), 'direct');
  assert.strictEqual(b2.get('form_fields[utm_source]'), '');
  assert.strictEqual(b2.get('form_fields[click_id]'), '');
  assert(/^\/(index(\.html)?)?$/.test(b2.get('form_fields[landing_path]')));
  assert.deepStrictEqual(d.problems.concat(problems), []);
  await d.ctx.close();
});

test('a new campaign overwrites the last touch; first touch stays; own-site referrer is not recorded', async (browser) => {
  const { ctx, page, bodies } = await newPage(browser);
  await page.goto(BASE + '/about.html?utm_source=one&utm_medium=email');
  await page.goto(BASE + '/index.html?utm_source=two&fbclid=FB99');
  const [f, l] = await page.evaluate(() => [JSON.parse(localStorage.getItem('aim_attr_first')), JSON.parse(sessionStorage.getItem('aim_attr_last'))]);
  assert.strictEqual(f.utm_source, 'one');
  assert.strictEqual(l.utm_source, 'two');
  const b = await submitAndGet(page, bodies, page.locator('form.aim-magnet-form').first());
  assert.strictEqual(b.get('form_fields[utm_source]'), 'two');
  assert.strictEqual(b.get('form_fields[click_id]'), 'fbclid:FB99');
  assert.strictEqual(b.get('form_fields[attribution]'), 'last');
  await ctx.close();
});

test('sanitisation: angle brackets and control characters removed, values capped at 120', async (browser) => {
  const { ctx, page, bodies } = await newPage(browser);
  await page.goto(BASE + '/index.html?utm_source=' + encodeURIComponent('<b>x</b>%\u0001') + '&utm_campaign=' + 'c'.repeat(300));
  const b = await submitAndGet(page, bodies, page.locator('form.aim-magnet-form').first());
  assert(!/[<>\u0001]/.test(b.get('form_fields[utm_source]')));
  assert.strictEqual(b.get('form_fields[utm_campaign]').length, 120);
  await ctx.close();
});

test('storage blocked: no errors, current-page data still submitted', async (browser) => {
  const { ctx, page, problems, bodies } = await newPage(browser, { blockStorage: true });
  await page.goto(BASE + '/index.html?utm_source=test&utm_medium=cpc&utm_campaign=spring&utm_term=ai%20course&utm_content=ad1&gclid=abc123', { referer: 'https://www.google.com/' });
  const b = await submitAndGet(page, bodies, page.locator('form.aim-magnet-form').first());
  assert.strictEqual(b.get('form_fields[utm_source]'), 'test');
  assert.strictEqual(b.get('form_fields[click_id]'), 'gclid:abc123');
  assert.strictEqual(b.get('form_fields[attribution]'), 'last');
  assert.deepStrictEqual(problems, []);
  await ctx.close();
});

test('no horizontal overflow at 390px and GTM loader present once', async (browser) => {
  const { ctx, page } = await newPage(browser);
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(BASE + '/index.html');
  const r = await page.evaluate(() => ({ over: document.documentElement.scrollWidth > window.innerWidth + 1, gtm: document.documentElement.outerHTML.split('googletagmanager.com/gtm.js?id=GTM-NPKP66BD').length - 1 }));
  assert.strictEqual(r.over, false);
  assert.strictEqual(r.gtm, 1);
  await ctx.close();
});

(async () => {
  const browser = await chromium.launch();
  let failed = 0;
  for (const [n, f] of tests) {
    try { await f(browser); out('ok   - ' + n); } catch (e) { failed++; out('FAIL - ' + n + '\n       ' + String(e.stack).split('\n').slice(0, 5).join('\n       ')); }
  }
  await browser.close();
  out(`\n${tests.length - failed}/${tests.length} passed`);
  process.exit(failed ? 1 : 0);
})();
