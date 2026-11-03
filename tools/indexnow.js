#!/usr/bin/env node
/* IndexNow submitter (no dependencies). Run ONLY after the Vercel deployment is READY and the key file is live.
 * Usage: node tools/indexnow.js https://aiinmarketing.in/blogs/<slug> [more URLs...]
 * /blogs and /sitemap.xml are always included. */
const HOST = 'aiinmarketing.in';
const KEY = '38580b432db483cab74f311666af9e84';
const urls = [...new Set([...process.argv.slice(2), 'https://' + HOST + '/blogs', 'https://' + HOST + '/sitemap.xml'])];
(async () => {
  const keyRes = await fetch('https://' + HOST + '/' + KEY + '.txt');
  if (!keyRes.ok || (await keyRes.text()).trim() !== KEY) { console.error('Key file is not live yet; aborting.'); process.exit(1); }
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: 'https://' + HOST + '/' + KEY + '.txt', urlList: urls }),
  });
  console.log('IndexNow responded', res.status, 'for', urls.length, 'URLs');
  process.exit(res.status === 200 || res.status === 202 ? 0 : 1);
})();
