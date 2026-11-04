#!/usr/bin/env node
/* Computes the reading time of blog posts and writes "<n> min read" into the .aimb-byline of each file.
 * Counts the visible article text (words / 220 per minute, rounded up, minimum 1) and EXCLUDES the contents list,
 * "Keep reading", the authors block, "More from the blog", the Sources section and script/style content.
 * Usage: node scripts/readtime.js [file ...]   (no arguments = every blogs/*.html except blogs/index.html)
 *        node scripts/readtime.js --check      (exit 1 if a post shows a different number; changes nothing) */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const WPM = 220;
const decode = (s) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&[a-z]+;/gi, ' ');

function articleText(html) {
  let h = (/<article[\s\S]*<\/article>/i.exec(html) || [html])[0];
  h = h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  h = h.replace(/<header[\s\S]*?<\/header>/i, ' ');                       // hero band: title, byline
  h = h.replace(/<nav[^>]*aimb-toc[\s\S]*?<\/nav>/i, ' ');               // contents list
  h = h.replace(/<section[^>]*aimb-authors[\s\S]*?<\/section>/i, ' ');   // authors block
  h = h.replace(/<section[^>]*aimb-more-posts[\s\S]*?<\/section>/i, ' '); // More from the blog
  // sections that start at an <h2> and run to the next <h2>/<section>/<aside>/end: Keep reading, Sources
  h = h.replace(/<h2[^>]*>\s*(?:Keep reading|Sources|References)[^<]*<\/h2>[\s\S]*?(?=<h2|<section|<aside|<\/article>|$)/gi, ' ');
  return decode(h.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}
const minutes = (html) => Math.max(1, Math.ceil((articleText(html).match(/[^\s]+/g) || []).length / WPM));

function main() {
  const args = process.argv.slice(2), check = args.includes('--check');
  let files = args.filter((a) => !a.startsWith('--'));
  if (!files.length) files = fs.readdirSync(path.join(ROOT, 'blogs')).filter((f) => f.endsWith('.html') && f !== 'index.html').map((f) => path.join(ROOT, 'blogs', f));
  let bad = 0;
  for (const f of files) {
    const html = fs.readFileSync(f, 'utf8');
    const m = /(<div class="aimb-byline"[\s\S]*?)(\d+)( min read)/.exec(html);
    if (!m) { console.error(`${path.relative(ROOT, f)}: no "<n> min read" inside .aimb-byline`); bad++; continue; }
    const n = minutes(html);
    console.log(`${path.basename(f)}: ${n} min read (was ${m[2]})`);
    if (check) { if (+m[2] !== n) bad++; continue; }
    if (+m[2] !== n) fs.writeFileSync(f, html.replace(/(<div class="aimb-byline"[\s\S]*?)(\d+)( min read)/, `$1${n}$3`));
  }
  process.exit(bad ? 1 : 0);
}
if (require.main === module) main(); else module.exports = { articleText, minutes };
