/* Builds the inline critical CSS block of the home page (first screen only, mobile + desktop).
 * Run after changing any stylesheet the home page loads:  node tools/critical-css.js
 * (serves the repo itself on :8778, needs the preinstalled Chromium + Playwright; no network).
 * It rewrites the block between <style id="aim-critical"> and </style> in index.html. The full
 * stylesheets still load (print-swap), so nothing below the first screen changes.
 * Keeps every rule whose selector matches an element that starts inside the first viewport
 * (or any element, for :root/html/body/*), at 390x844 and at 1280x800. */
const fs = require('fs');
const path = require('path');
const http = require('http');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const ROOT = path.join(__dirname, '..');
const PAGE = 'index.html';
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };

function serve() {
  return new Promise((res) => {
    const s = http.createServer((q, r) => {
      let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.statusCode = 404; return r.end(); }
      r.setHeader('content-type', MIME[path.extname(f)] || 'application/octet-stream'); r.end(fs.readFileSync(f));
    }).listen(8778, '127.0.0.1', () => res(s));
  });
}

const collect = () => {
  const vh = window.innerHeight;
  const all = [...document.querySelectorAll('*')];
  const idx = new Map(all.map((e, i) => [e, i]));
  let last = -1;
  const fixed = (el) => { for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const p = getComputedStyle(n).position; if (p === 'fixed' || p === 'sticky') return true; } return false; };
  const shown = (el) => { const r = el.getBoundingClientRect(); return r.top < vh && r.bottom > 0 && (r.width || r.height); };
  all.forEach((el, i) => { if (shown(el) && !fixed(el)) last = i; });
  const lastEl = all[last];
  // keep rules whose element is on the first screen, earlier in the document (hidden menus, header) or inside the last first-screen element
  const early = (el) => idx.get(el) <= last || (lastEl && lastEl.contains(el)) || shown(el);
  const keepSel = (sel) => {
    const parts = sel.split(',').map((x) => x.trim()).filter(Boolean);
    return parts.some((p) => {
      if (/^(:root|html|body|\*)/.test(p) && !/\s/.test(p)) return true;
      const base = p.replace(/::?[a-zA-Z-]+(\([^)]*\))?/g, '').replace(/\s*([>+~])\s*$/, '').trim() || '*';
      let els; try { els = document.querySelectorAll(base); } catch (e) { return true; }
      for (const el of els) if (early(el)) return true;
      return false;
    });
  };
const walk = (rules) => {
    let out = '';
    for (const r of rules) {
      if (r.type === 1) { if (keepSel(r.selectorText)) out += r.cssText; }
      else if (r.type === 4 || r.type === 12) { const inner = walk(r.cssRules); if (inner) out += '@' + (r.type === 4 ? 'media ' + r.conditionText : 'supports ' + r.conditionText) + '{' + inner + '}'; }
      else if (r.type === 5) out += r.cssText; // @font-face
      else if (r.type === 7) { /* keyframes: only when something above the fold names it */ out += '\u0000KF' + r.name + '\u0000' + r.cssText + '\u0000/KF\u0000'; }
    }
    return out;
  };
  const css = [];
  for (const sh of document.styleSheets) {
    if (!sh.href || !/\/wp-content\/(themes|plugins|uploads\/elementor\/css)\//.test(sh.href)) continue;
    if (/aim-chat|aim-engage/.test(sh.href)) continue; // widget css loads late by design
    try { for (const r of sh.cssRules) { const o = walk([r]); if (o) css.push(o); } } catch (e) {}
  }
  return css;
};

(async () => {
  const server = await serve();
  const browser = await chromium.launch();
  const sets = [];
  for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const ctx = await browser.newContext({ viewport: vp });
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:8778/' + PAGE, { waitUntil: 'load' });
    await page.waitForTimeout(500);
    sets.push(await page.evaluate(collect));
    await ctx.close();
  }
  await browser.close(); server.close();
  const seen = new Set(); let css = '';
  for (const set of sets) for (const c of set) { if (!seen.has(c)) { seen.add(c); css += c; } }
  css = css.replace(/\u0000KF([^\u0000]*)\u0000([\s\S]*?)\u0000\/KF\u0000/g, (m, n, body) => (new RegExp('[: ,]' + n.replace(/-/g, '\\-') + '[ ;,}]').test(css) ? body : ''));
  css = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/ ?([{};,>]) ?/g, '$1').replace(/;}/g, '}');
  const f = path.join(ROOT, PAGE);
  let html = fs.readFileSync(f, 'utf8');
  const block = '<style id="aim-critical">' + css + '</style>';
  if (/<style id="aim-critical">[\s\S]*?<\/style>/.test(html)) html = html.replace(/<style id="aim-critical">[\s\S]*?<\/style>/, () => block);
  else html = html.replace('<!-- Theme + Elementor stylesheets (load order matters) -->', () => block + '\n<!-- Theme + Elementor stylesheets (load order matters) -->');
  fs.writeFileSync(f, html);
  console.log('critical css: ' + css.length + ' bytes inlined in ' + PAGE);
})();
