'use strict';
// One stylesheet for the generated course and city pages. Those pages used to load seven separate
// render-blocking stylesheets; PageSpeed's mobile simulation lined them up one after another (LCP 4.4 s on the
// pillar page although the real load was about 1 s). The bundle is the same CSS in the same order, so the look
// does not change. Rebuild with `node tools/build-seo-pages.js` after editing ANY of the source files below.
// scripts/guard.js (course-pages) fails the build when the bundle is out of date.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const SOURCES = [
  'wp-content/themes/hello-elementor/style.css',
  'wp-content/uploads/elementor/css/aim-blog.css',
  'wp-content/uploads/elementor/css/aim-header.css',
  'wp-content/uploads/elementor/css/aim-chat.css',
  'wp-content/uploads/elementor/css/aim-programs.css',
  'wp-content/uploads/elementor/css/aim-themes.css',
  'wp-content/uploads/elementor/css/aim-course.css',
];
const BUNDLE = 'wp-content/uploads/elementor/css/aim-course-bundle.css';
function build() {
  const css = SOURCES.map((f) => `/* ${path.basename(f)} */\n` + fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\s+$/, '') + '\n').join('');
  return css;
}
function write() {
  const css = build();
  const f = path.join(ROOT, BUNDLE);
  if (!fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== css) fs.writeFileSync(f, css);
  return crypto.createHash('sha1').update(css).digest('hex').slice(0, 8);
}
// Replace the seven stylesheet links of a page with the single bundle link, at the position of the first one.
function bundlePage(html) {
  const ver = write();
  const re = /<link rel="stylesheet"[^>]*?(?:hello-elementor\/style\.css|aim-blog\.css|aim-header\.css|aim-chat\.css|aim-programs\.css|aim-themes\.css|aim-course\.css)[^>]*>\n?/g;
  let n = 0;
  const out = html.replace(re, () => (n++ === 0 ? `<link rel="stylesheet" id="aim-course-bundle-css" href="/${BUNDLE.replace('wp-content/', 'wp-content/')}?ver=${ver}">\n` : ''));
  if (n !== SOURCES.length) throw new Error(`css-bundle: expected ${SOURCES.length} stylesheet links, found ${n}`);
  return out;
}
module.exports = { SOURCES, BUNDLE, build, write, bundlePage };
if (require.main === module) console.log('bundle ver ' + write());
