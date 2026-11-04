#!/usr/bin/env node
/* Proves scripts/guard.js catches regressions. Copies the repo to a temp dir, checks the unmodified copy passes,
 * then applies each mutation to a FRESH copy and requires the guard to exit non-zero.
 * Usage: node scripts/guard-selftest.js   (exit 0 = every mutation was caught) */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SRC = path.resolve(__dirname, '..');
const SKIP = new Set(['.git', 'node_modules', '.vercel']);

function copy(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) copy(a, b); else fs.copyFileSync(a, b);
  }
}
const guard = (dir) => spawnSync(process.execPath, [path.join(dir, 'scripts', 'guard.js')], { encoding: 'utf8', env: { ...process.env, GUARD_SOFT: '' } });

// each mutation edits a copy in place; it must really change something
const edit = (dir, file, fn) => {
  const p = path.join(dir, file), before = fs.readFileSync(p, 'utf8'), after = fn(before);
  if (after === before) throw new Error(`mutation did not change ${file}`);
  fs.writeFileSync(p, after);
};
const MUTATIONS = [
  ['delete the IP extraction from api/lead.js', (d) => edit(d, 'api/lead.js', (s) => s.replace(/x-real-ip/g, 'x-gone-ip').replace(/x-forwarded-for/g, 'x-gone-for'))],
  ['remove the origin check from api/lead.js', (d) => edit(d, 'api/lead.js', (s) => s.replace('if (ALLOWED_HOSTS.includes(host)) return true;', 'return true;'))],
  ['remove one author block from a blog post', (d) => edit(d, 'blogs/what-is-vibe-marketing.html', (s) => s.replace(/<section class="aimb-authors"[\s\S]*?<\/section>/, ''))],
  ['add a second GTM loader to a page', (d) => edit(d, 'about.html', (s) => s.replace('</head>', '<script async src="https://www.googletagmanager.com/gtm.js?id=GTM-NPKP66BD"></script></head>'))],
  ['remove the privacy sentence about IP address', (d) => edit(d, 'privacy-policy.html', (s) => s.replace(/IP address/gi, 'network id'))],
  ['remove the aim-track.js attribution code', (d) => edit(d, 'wp-content/plugins/elementor/assets/js/aim-track.js', (s) => s.replace(/aim_attr_first/g, 'x_gone'))],
  ['change a page price phrase to 4,999', (d) => edit(d, 'index.html', (s) => s.replace(/(₹|Rs\.?\s?)5,999/, '$14,999'))],
  ['remove the /blog redirect from vercel.json', (d) => edit(d, 'vercel.json', (s) => { const j = JSON.parse(s); j.redirects = j.redirects.filter((r) => r.source !== '/blog'); return JSON.stringify(j, null, 2); })],
  ['add a sitemap entry for /wp-login', (d) => edit(d, 'sitemap.xml', (s) => s.replace('</urlset>', '<url><loc>https://aiinmarketing.in/wp-login</loc></url></urlset>'))],
  ['point an author photo at a missing image', (d) => edit(d, 'blogs/what-is-vibe-marketing.html', (s) => s.replace('authors/kailas-nath-r.webp', 'authors/missing-photo.webp'))],
  ['corrupt the Kailas portrait WebP', (d) => fs.writeFileSync(path.join(d, 'wp-content/uploads/2026/11/authors/kailas-nath-r.webp'), Buffer.from('not a webp file at all, just text padding padding'))],
  ['author page stops using the Kautilya portrait', (d) => edit(d, 'author/kautilyaroshan.html', (s) => s.replace(/kautilya-roshan\.webp/g, 'kautilyaroshan.png'))],
  ['remove the guard from vercel.json buildCommand', (d) => edit(d, 'vercel.json', (s) => s.replace(' && node scripts/guard.js', ''))],
  ['commit a Heffl-style API key literal', (d) => fs.writeFileSync(path.join(d, 'api', 'oops.js'), "const headers = { 'x-api" + "-key': '" + 'hk_live_' + '9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c' + "' };\n")],
  ['remove the byline component from a blog post', (d) => edit(d, 'blogs/what-is-vibe-marketing.html', (s) => s.replace(/<div class="aimb-byline">[\s\S]*?<p class="aimb-bl-sub">[\s\S]*?<\/p><\/div>/, '<p class="aimb-meta">By <a href="/author/kailasnathr" rel="author">Kailas Nath R</a> and <a href="/author/kautilyaroshan" rel="author">Kautilya Roshan</a></p>'))],
  ['strip the read time from a byline', (d) => edit(d, 'blogs/what-is-vibe-marketing.html', (s) => s.replace(/\d+ min read/, 'quick read'))],
  ['drop the aim-byline.js script tag from a post', (d) => edit(d, 'blogs/what-is-vibe-marketing.html', (s) => s.replace(/<script id="aim-byline-js"[^>]*><\/script>/, ''))],
  ['drop a blog post from llms.txt', (d) => edit(d, 'llms.txt', (s) => s.split('https://aiinmarketing.in/blogs/what-is-vibe-marketing').join('https://aiinmarketing.in/blogs/gone'))],
];

let failures = 0;
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-selftest-'));
try {
  const base = path.join(tmpRoot, 'base');
  copy(SRC, base);
  const r0 = guard(base);
  console.log(`${r0.status === 0 ? 'PASS' : 'FAIL'}  unmodified copy passes the guard (exit ${r0.status})`);
  if (r0.status !== 0) { failures++; console.log((r0.stderr || '').slice(0, 1500)); }
  MUTATIONS.forEach(([name, fn], i) => {
    const dir = path.join(tmpRoot, 'm' + i);
    copy(SRC, dir);
    fn(dir);
    const r = guard(dir);
    const caught = r.status === 1;
    const first = ((r.stderr || '').match(/\[VIOLATION\] ([\w-]+)/) || [])[1] || '-';
    console.log(`${caught ? 'PASS' : 'FAIL'}  guard fails after: ${name}  (exit ${r.status}, caught by ${first})`);
    if (!caught) failures++;
    fs.rmSync(dir, { recursive: true, force: true });
  });
} finally {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}
console.log(failures ? `\nSELFTEST FAILED: ${failures} problem(s)` : `\nSELFTEST OK: unmodified copy passes, all ${MUTATIONS.length} mutations are caught`);
process.exit(failures ? 1 : 0);
