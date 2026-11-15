// Shared site header for every page except the home page (index.html keeps its own am-* header).
// Usage: node tools/sync-header.js        rewrites the header block and CSS link in every html file (idempotent).
// Also exported: syncHeader(html) is called by tools/build-seo-pages.js so generated pages get the same header.
const fs = require('fs'), path = require('path');
const ITEMS = ['AI built into <b>every module</b>, not one chapter', 'Learn <b>inside real platforms</b>, not on a trainer&rsquo;s screen', '<b>WordPress MCP</b>, Claude, CLI, ads MCPs, CRO automations, chatbots', '<b>&#8377;5,999</b> or <b>&#8377;9,999</b> with tool access: same training and internship', '<b>1-month agency internship</b>, certificate from the agency', '<b>4 specialisations</b> included for every student', 'Recent placements at <b>&#8377;5&ndash;15 LPA</b>', 'Next batch <b>enrolling now</b>'];
const ticker = ITEMS.concat(ITEMS).map(t => `<span class="aimh-item">${t}</span>`).join('');
const COURSES = '<div><strong>Courses</strong><a href="/digital-marketing-course">Digital marketing course</a><a href="/ai-digital-marketing-course">AI digital marketing course</a><a href="/vibe-marketing-course">Vibe marketing course</a><a href="/digital-marketing-course-online">Online digital marketing course</a></div><div><strong>By city</strong><a href="/digital-marketing-course/delhi">Delhi NCR</a><a href="/digital-marketing-course/mumbai">Mumbai</a><a href="/digital-marketing-course/bangalore">Bangalore</a><a href="/digital-marketing-course/hyderabad">Hyderabad</a><a href="/digital-marketing-course/pune">Pune</a><a href="/digital-marketing-course/chennai">Chennai</a><a href="/digital-marketing-course/kerala">Kerala</a><a href="/all-pages">All city pages</a></div>';
const GUIDES = [['digital-marketing-course-for-beginners-india', 'Course for beginners'], ['digital-marketing-certificate-india-which-one-counts', 'Which certificate counts'], ['digital-marketing-internship-india-how-to-get-one', 'How to get an internship'], ['digital-marketing-course-with-placement-india', 'Course with placement: what to check'], ['best-digital-marketing-courses-india-2026-how-to-choose', 'Best courses and how to choose'], ['digital-marketing-course-fees-india-2026', 'Course fees in India'], ['online-vs-classroom-digital-marketing-course', 'Online vs classroom'], ['vibe-marketing-course-india-what-you-learn', 'Vibe marketing: what you learn'], ['digital-marketing-course-kerala-what-to-look-for', 'Course in Kerala: what to look for']].map(([s, t]) => `<a href="/blogs/${s}">${t}</a>`).join('') + '<a href="/blogs">All blog posts</a>';
const HEADER = `<div class="aimh-top"><div class="aimh-ann" aria-label="Announcements"><div class="aimh-track">${ticker}</div></div><header class="aimh-header"><div class="aimh-nav">
<div class="aimh-brand"><a class="aimh-mark" href="/" aria-label="AIM, AI in Marketing">AIM</a><span class="aimh-text"><small>AI in Marketing</small><a href="https://adsmentor.in" target="_blank" rel="noopener">by Adsmentor</a></span></div>
<input type="checkbox" id="aimh-cb" class="aimh-cb" aria-label="Open menu"><label for="aimh-cb" class="aimh-toggle" aria-hidden="true"><span></span><span></span><span></span></label>
<nav class="aimh-links" aria-label="Main"><a href="/#ai-lab">The AI Lab</a><a href="/#tracks">Modules</a><a href="/#curriculum">Tools</a><a href="/#bonus">Fees</a><a href="/#trainers">Trainers</a><a href="/#faq">FAQs</a><details class="aimh-dd" name="aimhnav"><summary>Courses</summary><div class="aimh-ddp aimh-ddp2">${COURSES}</div></details><details class="aimh-dd" name="aimhnav"><summary>Guides</summary><div class="aimh-ddp">${GUIDES}</div></details><a href="/about">About</a><a class="aimh-apply" href="/#bonus">Apply Now</a></nav>
</div></header></div>`;
const CSS = '<link rel="stylesheet" id="aim-header-css" href="/wp-content/uploads/elementor/css/aim-header.css?ver=1.0.0" media="all">';
function syncHeader(html) {
  const old = /<div class="aimh-top">[\s\S]*?<\/header><\/div>|<header class="aimb-header">[\s\S]*?<\/header>/;
  if (!old.test(html)) return html;                       // pages without the shared header (home, wp-login) are left alone
  html = html.replace(old, () => HEADER);
  html = html.replace(/<link rel="stylesheet" id="aim-header-css"[^>]*>\n?/, '');
  return html.replace(/(<link[^>]*aim-blog\.css[^>]*>)/, (m) => m + '\n' + CSS);
}
module.exports = { syncHeader, HEADER };
if (require.main === module) {
  const root = path.join(__dirname, '..'); let n = 0;
  (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    if (['node_modules', '.git', 'tools', 'scripts'].includes(f.name)) continue;
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p); else if (f.name.endsWith('.html')) { const s = fs.readFileSync(p, 'utf8'), t = syncHeader(s); if (t !== s) { fs.writeFileSync(p, t); n++; } }
  } })(root);
  console.log('header synced in ' + n + ' files');
}
