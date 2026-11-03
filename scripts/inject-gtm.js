#!/usr/bin/env node
/* Google Tag Manager injector. Idempotent; run at deploy time via vercel.json buildCommand, or by hand: node scripts/inject-gtm.js
 * Adds to EVERY .html file in the repo (any folder, including future pages): dataLayer/gtag stub + GTM loader in <head>, the GTM noscript iframe after <body>, and the event helper aim-track.js. Never fails the build. */
const fs = require('fs');
const path = require('path');
const GTM_ID = 'GTM-NPKP66BD';
const ROOT = path.resolve(__dirname, '..');
const SKIP = new Set(['node_modules', '.git', '.vercel', '.next']);
const HEAD = `
<!-- Google Tag Manager -->
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  window.dataLayer.push({'gtm.start': new Date().getTime(), event: 'gtm.js'});
</script>
<script async src="https://www.googletagmanager.com/gtm.js?id=${GTM_ID}"></script>
<!-- End Google Tag Manager -->
`;
const BODY = `
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
`;
const TRACK_VER = '1.1.0';
const TRACK = `<script id="aim-track-js" src="/wp-content/plugins/elementor/assets/js/aim-track.js?ver=${TRACK_VER}" defer></script>\n`;
function walk(dir, out) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (name.isDirectory()) { if (!SKIP.has(name.name)) walk(path.join(dir, name.name), out); }
    else if (name.name.toLowerCase().endsWith('.html')) out.push(path.join(dir, name.name));
  }
  return out;
}
try {
  let changed = 0, files = walk(ROOT, []);
  for (const f of files) {
    let h = fs.readFileSync(f, 'utf8'), o = h;
    if (!h.includes('googletagmanager.com/gtm.js?id=' + GTM_ID)) h = h.replace(/<head[^>]*>/i, (m) => m + HEAD);
    if (!h.includes('googletagmanager.com/ns.html?id=' + GTM_ID)) h = h.replace(/<body[^>]*>/i, (m) => m + BODY);
    h = h.replace(/(aim-track\.js\?ver=)[\w.-]+/g, (m, a) => a + TRACK_VER);
    if (!h.includes('id="aim-track-js"')) h = h.replace(/<\/body>/i, TRACK + '</body>');
    if (h !== o) { fs.writeFileSync(f, h); changed++; }
  }
  console.log(`GTM ${GTM_ID}: ${files.length} html files checked, ${changed} updated`);
} catch (e) {
  console.error('GTM injection skipped:', e.message);
}
process.exit(0);
