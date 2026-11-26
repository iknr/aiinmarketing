#!/usr/bin/env node
/* Organization + WebSite JSON-LD for every public page EXCEPT the home page (the home page carries its own
 * Organization block with the same @id and is not touched by this script).
 *
 *   node tools/org-schema.js          add or refresh the block in every public .html file (idempotent)
 *   node tools/org-schema.js --check  only report pages that miss it (exit 1 if any)
 *
 * The block has id="aim-org-schema" and uses the same @id as the home page (https://aiinmarketing.in/#org), so
 * Google and AI search tools merge it into one entity. Course and city pages get it from tools/build-seo-pages.js
 * (it requires ORG_SCRIPT); run this script after adding any other page, then commit. The guard
 * (invariant org-schema-on-every-page) fails the build when a page drops it. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://aiinmarketing.in';
const SKIP_DIRS = new Set(['node_modules', '.git', '.vercel', '.next', 'wp-admin']);
const SKIP_FILES = new Set(['index.html', '404.html', 'wp-login.html']);

const ORG_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': ['EducationalOrganization', 'Organization'],
      '@id': SITE + '/#org',
      name: 'AIM - AI in Marketing',
      alternateName: 'AIM',
      url: SITE + '/',
      logo: { '@type': 'ImageObject', url: SITE + '/icon-512.png', width: 512, height: 512 },
      sameAs: [
        'https://www.linkedin.com/company/aim-ai-in-marketing-by-adsmentor',
        'https://x.com/ai_inmarketing_',
        'https://www.crunchbase.com/organization/aim-ai-in-marketing-by-adsmentor',
      ],
      email: 'contact@adsmentor.in',
      contactPoint: { '@type': 'ContactPoint', telephone: '+91-62824-34535', contactType: 'customer support', areaServed: 'IN', availableLanguage: ['English'] },
      areaServed: { '@type': 'Country', name: 'India' },
      parentOrganization: { '@type': 'Organization', name: 'Adsmentor', url: 'https://adsmentor.in', sameAs: ['https://adsmentor.in'] },
    },
    {
      '@type': 'WebSite',
      '@id': SITE + '/#website',
      url: SITE + '/',
      name: 'AIM - AI in Marketing by Adsmentor',
      inLanguage: 'en-IN',
      publisher: { '@id': SITE + '/#org' },
    },
  ],
};
const ORG_SCRIPT = `<script type="application/ld+json" id="aim-org-schema">${JSON.stringify(ORG_LD)}</script>`;
const BLOCK_RE = /<script type="application\/ld\+json" id="aim-org-schema">[\s\S]*?<\/script>/;

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), out); }
    else if (e.name.toLowerCase().endsWith('.html') && !(dir === ROOT && SKIP_FILES.has(e.name))) out.push(path.join(dir, e.name));
  }
  return out;
}

function apply(h) {
  if (BLOCK_RE.test(h)) return h.replace(BLOCK_RE, () => ORG_SCRIPT);
  return h.replace(/<\/head>/i, () => ORG_SCRIPT + '\n</head>');
}

if (require.main === module) {
  const check = process.argv.includes('--check');
  let changed = 0;
  const files = walk(ROOT, []);
  for (const f of files) {
    const h = fs.readFileSync(f, 'utf8'), n = apply(h);
    if (n !== h) { changed++; if (check) console.log('missing or stale: ' + path.relative(ROOT, f)); else fs.writeFileSync(f, n); }
  }
  console.log(`org schema: ${files.length} pages checked, ${changed} ${check ? 'need it' : 'updated'}`);
  process.exit(check && changed ? 1 : 0);
}
module.exports = { ORG_SCRIPT, ORG_LD };
