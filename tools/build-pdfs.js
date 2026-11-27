#!/usr/bin/env node
/* Rebuilds the downloadable guide PDFs from their HTML sources in tools/pdf-src/ and records hashes in
 * tools/pdf-src/manifest.json (the build guard compares them, so a source edit without a rebuild fails the build).
 * Usage: node tools/build-pdfs.js [brochure|syllabus|checklist|portfoliokit ...]   (no argument = all)
 * Needs Playwright with Chromium (same as tools/test-attribution.js) and the Inter font installed for the intended look.
 * The brochure cover image is rebuilt too: wp-content/uploads/2026/11/guides/aim-program-brochure-cover.webp (needs pdftoppm + Pillow, optional). */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { SRC_DIR, sourceHash, fileHash } = require('./pdf-src/hash.js');
const ROOT = path.resolve(__dirname, '..');
const GUIDES = path.join(ROOT, 'wp-content/uploads/2026/11/guides');
const JOBS = {
  brochure: { pdf: 'aim-program-brochure.pdf' },
  syllabus: { pdf: 'aim-12-week-syllabus.pdf' },
  checklist: { pdf: 'how-to-choose-a-digital-marketing-course.pdf' },
  portfoliokit: { pdf: 'digital-marketing-portfolio-kit.pdf' },
};
(async () => {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(JOBS);
  for (const n of names) if (!JOBS[n]) { console.error('unknown job ' + n + '; use ' + Object.keys(JOBS).join(', ')); process.exit(2); }
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const manifestFile = path.join(SRC_DIR, 'manifest.json');
  const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : {};
  for (const n of Object.keys(JOBS)) {
    if (names.includes(n)) {
      await page.goto('file://' + path.join(SRC_DIR, n + '.htm'));
      await page.waitForTimeout(800);
      await page.pdf({ path: path.join(GUIDES, JOBS[n].pdf), format: 'A4', printBackground: true, preferCSSPageSize: true });
      console.log('built ' + JOBS[n].pdf);
    }
    manifest[n] = { source: 'tools/pdf-src/' + n + '.htm', pdf: 'wp-content/uploads/2026/11/guides/' + JOBS[n].pdf, sourceSha256: sourceHash(n), pdfSha256: fileHash(path.join(GUIDES, JOBS[n].pdf)) };
  }
  await browser.close();
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
  if (names.includes('brochure')) {
    const r = spawnSync('bash', ['-c', `pdftoppm -png -f 1 -l 1 -scale-to-x 540 -scale-to-y 960 "${path.join(GUIDES, JOBS.brochure.pdf)}" /tmp/aim-cover && python3 -c "from PIL import Image; Image.open('/tmp/aim-cover-01.png').convert('RGB').save('${path.join(GUIDES, 'aim-program-brochure-cover.webp')}','WEBP',quality=88)"`], { stdio: 'inherit' });
    console.log(r.status === 0 ? 'cover image rebuilt' : 'cover image NOT rebuilt (pdftoppm or Pillow missing); rebuild it by hand from page 1');
  }
  console.log('manifest updated: tools/pdf-src/manifest.json. Commit the .htm, the PDFs, the cover and the manifest together.');
})().catch((e) => { console.error(e); process.exit(1); });
