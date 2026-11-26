#!/usr/bin/env node
/* Generates the course pages and the city pages from tools/seo-pages-data.js.
 *   node tools/build-seo-pages.js        writes the HTML files; then run scripts/inject-gtm.js
 * Output files (committed): digital-marketing-course/index.html, digital-marketing-course/<city>.html,
 * ai-digital-marketing-course.html, vibe-marketing-course.html, digital-marketing-course-online.html.
 * Edit the data or this template, never the generated HTML by hand (the next run would overwrite it). */
'use strict';
const fs = require('fs');
const path = require('path');
const { CITIES } = require('./seo-pages-data.js');
const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://aiinmarketing.in';
const DATE = '2026-11-18';
const OG = SITE + '/wp-content/uploads/2026/11/best-digital-marketing-courses-india-2026-how-to-choose-banner.png';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rs = (s) => s.replace(/₹/g, '&#8377;').replace(/’/g, '&rsquo;');
const GTM = fs.readFileSync(path.join(ROOT, 'about.html'), 'utf8').split('<meta charset')[0].replace(/^<!DOCTYPE html>\s*<html[^>]*>\s*<head>\s*/i, '');

const FEE_TABLE = `<div class="aimb-tablewrap"><table class="aimb-table"><thead><tr><th>Type of program</th><th>Length</th><th>Listed fee</th></tr></thead><tbody>
<tr><td>Placement-led bootcamps</td><td>4 to 7 months</td><td>&#8377;1.05 lakh to &#8377;1.64 lakh</td></tr>
<tr><td>Institute certification courses</td><td>3 to 6 months</td><td>&#8377;48,000 to &#8377;75,000</td></tr>
<tr><td>Short bootcamps</td><td>3 months</td><td>&#8377;25,000</td></tr>
<tr class="aimb-hot"><td><strong>AIM by Adsmentor</strong></td><td>3 months, agency internship included</td><td><strong>&#8377;5,999</strong>, or <strong>&#8377;9,999</strong> with full tool access</td></tr>
</tbody></table></div>
<p class="aimb-small">Ranges come from public fee listings for 10 programs, checked October 2026. Fees change, so check each provider before you decide. The two AIM plans differ only in tool access and live ad experience (Claude, Semrush, Gemini Pro, Google AI Pro, Ahrefs, SpyFu, Ubersuggest and Canva).</p>`;


const DIFF = (N) => `<h2 id="what-sets-aim-apart">What AIM does that most digital marketing courses${N ? ' in ' + N : ''} do not</h2>
<ul>
<li><strong>AI in every module, not one chapter.</strong> From week 1 you work with Claude, WordPress MCP, MCPs for ad accounts, CRO automations and chatbots.</li>
<li><strong>You work inside the real platforms.</strong> You log in and do the work yourself instead of watching a trainer&rsquo;s screen.</li>
<li><strong>A real agency month.</strong> Weeks 9 to 12 are client tasks at a partner agency with a weekly mentor check-in, and the certificate comes from the agency.</li>
<li><strong>Four specialisations, all included.</strong> AI Generalist, Marktech, Branding and Content, and Performance and Growth, with no add-on fee.</li>
<li><strong>Two openly listed fees, one training.</strong> &#8377;5,999 with limited tool access or &#8377;9,999 with full tool access. Only tool access and live ad experience differ.</li>
<li><strong>Trainers you can check.</strong> Both trainers are practitioners with public profiles on the <a href="/about">about page</a>, so you can verify them before you pay.</li>
</ul>`;

const PLAN = `<ul>
<li><strong>Weeks 1 to 4, core skills with AI in every module:</strong> websites with WordPress and WordPress MCP, SEO and AI search, social media and automations, ads on five platforms, media planning.</li>
<li><strong>Weeks 5 to 8, four specialisations, all included:</strong> AI Generalist, Marktech, Branding and Content, Performance and Growth.</li>
<li><strong>Weeks 9 to 12, a 1-month agency internship</strong> on real client tasks, with a certificate issued by the agency.</li>
<li><strong>Also included:</strong> a live portfolio site on your own domain and hosting, a CV rewrite and 3 mock interviews.</li>
</ul>`;

const NAV = '<nav class="aimb-links" aria-label="Main"><a href="/">Home</a><details class="aimb-dd" name="aimnav"><summary>Courses</summary><div class="aimb-ddp aimb-ddp2"><div><strong>Courses</strong><a href="/digital-marketing-course">Digital marketing course</a><a href="/ai-digital-marketing-course">AI digital marketing course</a><a href="/vibe-marketing-course">Vibe marketing course</a><a href="/digital-marketing-course-online">Online digital marketing course</a></div><div><strong>By city</strong><a href="/digital-marketing-course/delhi">Delhi NCR</a><a href="/digital-marketing-course/mumbai">Mumbai</a><a href="/digital-marketing-course/bangalore">Bangalore</a><a href="/digital-marketing-course/hyderabad">Hyderabad</a><a href="/digital-marketing-course/pune">Pune</a><a href="/digital-marketing-course/chennai">Chennai</a><a href="/digital-marketing-course/kerala">Kerala</a><a href="/all-pages">All city pages</a></div></div></details><details class="aimb-dd" name="aimnav"><summary>Guides</summary><div class="aimb-ddp"><a href="/blogs/digital-marketing-course-for-beginners-india">Course for beginners</a><a href="/blogs/digital-marketing-certificate-india-which-one-counts">Which certificate counts</a><a href="/blogs/digital-marketing-internship-india-how-to-get-one">How to get an internship</a><a href="/blogs/digital-marketing-course-with-placement-india">Course with placement: what to check</a><a href="/blogs/best-digital-marketing-courses-india-2026-how-to-choose">Best courses and how to choose</a><a href="/blogs/digital-marketing-course-fees-india-2026">Course fees in India</a><a href="/blogs/online-vs-classroom-digital-marketing-course">Online vs classroom</a><a href="/blogs/vibe-marketing-course-india-what-you-learn">Vibe marketing: what you learn</a><a href="/blogs/digital-marketing-course-kerala-what-to-look-for">Course in Kerala: what to look for</a><a href="/blogs">All blog posts</a></div></details><a href="/about">About</a><a class="aimb-apply" href="/#bonus">See the fee</a></nav>';

const THEMES = ['sunrise', 'forest', 'plum', 'ember', 'ocean', 'rose', 'slate'];
const LAYOUTS = ['left', 'center', 'card'];
const PLACED_PEOPLE = [
  ['Ankita Kumari', 'Subject Matter Expert at Lokal', '&#8377;15 LPA', 'https://www.linkedin.com/in/ankita-kumari-b17128168/', ''],
  ['Vasavi R V', 'Asst. Manager, Marketing at KloudMate', '&#8377;12 LPA', 'https://www.linkedin.com/in/vasavi-rv-0b2582231/', ''],
  ['Praneet K', 'Digital Production Specialist at Loblaw Digital', '&#8377;15 LPA', 'https://www.linkedin.com/in/praneet-k-b6043b126/', ''],
  ['Vivek Jain', 'Creative Head', '34% salary hike', 'https://www.linkedin.com/in/vivek-jain-7472842b7/', ''],
  ['Tamanna Jain', 'Social Media Manager at Amulya Kala', '30% salary hike', 'https://www.linkedin.com/in/tamanna-jain-dm/', ''],
];
// Sourced pay figures (owner approved 16 Nov 2026). Source: AmbitionBox, "Digital Marketing Executive" salaries, self-reported, read 16 Nov 2026
// (page "Updated: 14 Nov 2026", 49.1k salaries in India, typical range Rs 3.3 to 3.7 lakh a year for 0 to 5 years). Chennai shows an average only (no range).
// Refresh every quarter and change the date below when you do.
const PAY_URL = 'https://www.ambitionbox.com/profile/digital-marketing-executive-salary';
const PAY_READ = '16 November 2026';
const PAY = {
  delhi: { loc: 'New Delhi', lo: '3.3', hi: '3.7', n: '6.9k' },
  mumbai: { loc: 'Mumbai', lo: '3.6', hi: '4', n: '3.6k' },
  bangalore: { loc: 'Bengaluru', lo: '3.7', hi: '4', n: '5.4k' },
  hyderabad: { loc: 'Hyderabad', lo: '3.3', hi: '3.6', n: '4.6k' },
  pune: { loc: 'Pune', lo: '3.2', hi: '3.6', n: '4.5k' },
  chennai: { loc: 'Chennai', avg: '3.6' },
};
function payHtml(c) {
  const d = PAY[c.slug];
  if (!d) return '';
  const city = d.avg
    ? `AmbitionBox lists an average of about &#8377;${d.avg} lakh a year for people in ${d.loc} with the job title Digital Marketing Executive.`
    : `On AmbitionBox, people in ${d.loc} with the job title Digital Marketing Executive report a typical salary of &#8377;${d.lo} to &#8377;${d.hi} lakh a year, based on ${d.n} self-reported salaries.`;
  return `<h3 id="pay-in-${c.slug}">What an entry-level digital marketing job pays in ${esc(c.name)}</h3>
<p>${city} Across India the same title shows &#8377;3.3 to &#8377;3.7 lakh a year for 0 to 5 years of experience, based on 49.1k salaries (read on ${PAY_READ}).</p>
<p class="aimb-small">These are self-reported figures for one job title across all employers, from <a href="${PAY_URL}" rel="noopener nofollow">AmbitionBox</a>. They are a market benchmark and they change, so check the live page before you decide.</p>`;
}

const PLACED = `<h2 id="placements">Where our students landed: placed at &#8377;5 to &#8377;15 LPA</h2>
<p>Recent placements and salary growth of students from the Adsmentor program behind AIM. Every profile is public, so you can verify each one yourself. No course can promise you a job, and we do not.</p>
<div class="aimb-placed">${PLACED_PEOPLE.map(([n, r, pk, u, img]) => `<a class="aimb-pcard" href="${u}" target="_blank" rel="noopener"><span class="aimb-pav">${img ? `<img src="${img}" width="200" height="200" alt="${n}" loading="lazy" decoding="async">` : n.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span><b>${n}</b><span>${r}</span><strong>${pk}</strong><em>View profile on LinkedIn</em></a>`).join('')}</div>`;
const PLACED_CSS = `<style>.aimb-placed{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;margin:14px 0 22px}.aimb-pcard{display:flex;flex-direction:column;gap:4px;padding:16px;border:1px solid #dbe3f5;border-radius:14px;background:#fff;text-decoration:none;color:inherit}.aimb-pcard b{font-size:16px}.aimb-pcard span{font-size:14px;color:#44506b}.aimb-pcard strong{margin-top:6px;font-size:18px;color:#0256ec}.aimb-pcard em{font-style:normal;font-size:13px;color:#0256ec}.aimb-pav{width:48px;height:48px;border-radius:50%;background:#e8efff;color:#0256ec;display:flex;align-items:center;justify-content:center;font-weight:800;overflow:hidden;margin-bottom:6px}.aimb-pav img{width:100%;height:100%;object-fit:cover}</style>`;

const { upgrade } = require('./course-shell.js');
const { syncHeader } = require('./sync-header.js');
const { bundlePage } = require('./css-bundle.js');

const answerHtml = (t) => `<div class="aimb-takeaways"><strong>Short answer</strong><p>${rs(esc(t))}</p></div>
<p class="aimb-small">Free download: <a href="#free-guide-box">The 12-week syllabus</a>, sent to your phone and email.</p>`;
const bridgeHtml = (k) => `<section class="aimb-bridge"><div class="aimb-bridge-copy"><span class="aimb-bridge-eye">Free download</span><h2 id="free-guide">See the whole 12-week path before you decide</h2><p>The syllabus shows every module, what you build in each and how the agency internship fits in, so you can compare it with any other option.</p><p class="aimb-bridge-link">The full path is &#8377;5,999, or &#8377;9,999 with full tool access, paid only after your onboarding call. <a href="/#bonus">See what is included</a>.</p></div><div id="free-guide-box" class="aimp-mag"><h3>The 12-week syllabus</h3><p>Every module, what you build in each, and how the agency internship fits in. See the whole path before you spend a rupee.</p><form class="aim-magnet-form" method="post" action="/wp-admin/admin-ajax.php" data-file="/wp-content/uploads/2026/11/guides/aim-12-week-syllabus.pdf" novalidate><input type="hidden" name="form_name" value="magnet_syllabus"><input type="hidden" name="form_fields[source]" value="magnet-syllabus"><label for="${k}-syllabus-n">Name</label><input id="${k}-syllabus-n" name="form_fields[name]" type="text" autocomplete="name" placeholder="Your name" required><label for="${k}-syllabus-p">WhatsApp number</label><input id="${k}-syllabus-p" name="form_fields[phone]" type="tel" inputmode="tel" autocomplete="tel" placeholder="10-digit mobile number" required><label for="${k}-syllabus-e">Email</label><input id="${k}-syllabus-e" name="form_fields[email]" type="email" autocomplete="email" placeholder="you@email.com" required><button type="submit">Send me the syllabus</button><p class="aimp-msg" role="status" hidden></p></form></div></section>`;

function page(o) {
  const url = SITE + o.path;
  const ld = [o.course, o.breadcrumb, o.faq && faqLd(o.faq)].filter(Boolean).map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n');
  return bundlePage(syncHeader(upgrade(`<!DOCTYPE html>
<html lang="en-IN">
<head>
${GTM}<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.desc)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${url}">
<meta property="og:locale" content="en_IN">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.desc)}">
<meta property="og:site_name" content="AIM - AI in Marketing by Adsmentor">
<meta property="og:image" content="${OG}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(o.title)}">
<meta name="twitter:description" content="${esc(o.desc)}">
<meta name="twitter:image" content="${OG}">
<meta name="theme-color" content="#0256ec">
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&amp;display=swap" media="print" onload="this.media='all'"><noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&amp;display=swap"></noscript>
<link rel="stylesheet" id="hello-elementor-css" href="/wp-content/themes/hello-elementor/style.css?ver=3.1.1">
<link rel="stylesheet" id="aim-blog-css" href="/wp-content/uploads/elementor/css/aim-blog.css?ver=2.8.0"><link rel="stylesheet" id="aim-programs-css" href="/wp-content/uploads/elementor/css/aim-programs.css?ver=1.1.0" media="all">
<link rel="stylesheet" id="aim-themes-css" href="/wp-content/uploads/elementor/css/aim-themes.css?ver=1.0.0"><link rel="stylesheet" id="aim-course-css" href="/wp-content/uploads/elementor/css/aim-course.css?ver=1.0.2">
${ld}
${PLACED_CSS}
</head>
<body class="page page-template-default elementor-default" data-aimtheme="${o.theme || 'sunrise'}" data-aimlayout="${o.layout || 'left'}">
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-NPKP66BD" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>

<header class="aimb-header"><div class="aimb-nav">
<a class="aimb-brand" href="/" aria-label="AIM, AI in Marketing"><span class="aimb-mark">AIM</span></a>
<span class="aimb-brandtext"><small>AI in Marketing</small><a href="https://adsmentor.in" target="_blank" rel="noopener">by Adsmentor</a></span>
${NAV}
</div></header>
<main class="aimb-main"><article class="aimb-article aimb-fw">
<header class="aimb-band"><div class="aimb-bandin aimb-bandin-1"><div class="aimb-bandcopy"><p class="aimb-kicker">${esc(o.kicker)}</p>
<h1>${esc(o.h1)}</h1></div></div></header>
<nav class="aimb-small" aria-label="Breadcrumb">${o.crumbs.map(([n, u]) => (u ? `<a href="${u}">${esc(n)}</a>` : esc(n))).join(' &rsaquo; ')}</nav>
<p class="aimb-lead">${rs(o.lead)}</p>
${o.answer ? answerHtml(o.answer) : ''}
${rs(o.body)}
${PLACED}
${o.answer ? bridgeHtml(o.path.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 30)) : ''}
<aside class="aimb-cta"><h2>See the fee and apply</h2><p>AI in every module, hands-on inside the platforms, and a 1-month agency internship. &#8377;5,999 with limited tool access, or &#8377;9,999 with full tool access. Same training and agency internship in both. 7-day money-back guarantee.</p><a class="aimb-btn" href="/#bonus">See the fee</a></aside>
</article></main>
<footer class="aimb-footer"><div class="aimb-foot aimb-foot5"><div class="aimb-fcol aimb-fbrand"><span class="aimb-mark">AIM</span><p>AI in Marketing by <a href="https://adsmentor.in" target="_blank" rel="noopener">Adsmentor</a>. A live online, AI-first digital marketing course. &copy; 2026</p><a href="mailto:contact@adsmentor.in">contact@adsmentor.in</a></div><div class="aimb-fcol"><strong>Courses</strong><a href="/digital-marketing-course">Digital marketing course</a><a href="/ai-digital-marketing-course">AI digital marketing course</a><a href="/vibe-marketing-course">Vibe marketing course</a><a href="/digital-marketing-course-online">Online digital marketing course</a><a href="/digital-marketing-course-with-internship">Course with internship</a><a href="/digital-marketing-course/kerala">Kerala course</a></div><div class="aimb-fcol"><strong>Top cities</strong><a href="/digital-marketing-course/delhi">Delhi NCR</a><a href="/digital-marketing-course/mumbai">Mumbai</a><a href="/digital-marketing-course/bangalore">Bangalore</a><a href="/digital-marketing-course/hyderabad">Hyderabad</a><a href="/digital-marketing-course/pune">Pune</a><a href="/digital-marketing-course/chennai">Chennai</a><a href="/digital-marketing-course/kerala">Kerala</a><a href="/all-pages">All city pages</a></div><div class="aimb-fcol"><strong>Guides</strong><a href="/blogs/digital-marketing-course-for-beginners-india">Course for beginners</a><a href="/blogs/digital-marketing-certificate-india-which-one-counts">Which certificate counts</a><a href="/blogs/digital-marketing-internship-india-how-to-get-one">How to get an internship</a><a href="/blogs/digital-marketing-course-with-placement-india">Course with placement: what to check</a><a href="/blogs/best-digital-marketing-courses-india-2026-how-to-choose">Best courses and how to choose</a><a href="/blogs/digital-marketing-course-fees-india-2026">Course fees in India</a><a href="/blogs">All blog posts</a></div><div class="aimb-fcol"><strong>Company</strong><a href="/about">About</a><a href="/author/kailasnathr">Kailas Nath R</a><a href="/author/kautilyaroshan">Kautilya Roshan</a><a href="/terms">Terms</a><a href="/privacy-policy">Privacy policy</a><a href="/all-pages">All pages</a></div></div></footer>
<script id="aim-magnet-js" src="/wp-content/plugins/elementor/assets/js/aim-magnet.js?ver=1.0.0" defer></script><script id="aim-track-js" src="/wp-content/plugins/elementor/assets/js/aim-track.js?ver=1.1.0" defer></script>
</body>
</html>
`)));
}

function faqLd(faq) {
  return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a.replace(/₹/g, 'Rs ') } })) };
}
function faqHtml(faq) {
  return '<h2 id="faq">Frequently asked questions</h2>\n' + faq.map(([q, a]) => `<h3>${esc(q)}</h3>\n<p>${rs(esc(a))}</p>`).join('\n');
}
function crumbLd(items) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map(([n, u], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: SITE + (u || '') })) };
}
function courseLd(o) {
  const c = {
    '@context': 'https://schema.org', '@type': 'Course', name: o.name, description: o.desc, url: SITE + o.path, inLanguage: 'en-IN',
    educationalLevel: 'Beginner', courseMode: 'online',
    provider: { '@type': 'Organization', name: 'Adsmentor', sameAs: 'https://adsmentor.in' },
    offers: [
      { '@type': 'Offer', name: 'AIM program, with limited tool access', price: '5999', priceCurrency: 'INR', category: 'Paid', url: SITE + '/#bonus' },
      { '@type': 'Offer', name: 'AIM program, with full tool access', price: '9999', priceCurrency: 'INR', category: 'Paid', url: SITE + '/#bonus' },
    ],
    hasCourseInstance: { '@type': 'CourseInstance', courseMode: 'online', courseWorkload: 'PT2H per weekday' },
  };
  if (o.city) c.areaServed = { '@type': 'City', name: o.city };
  else c.areaServed = { '@type': 'Country', name: 'India' };
  return c;
}
const COMMON_FAQ = [
  ['How much does the course cost?', 'It costs ₹5,999 with limited tool access, or ₹9,999 with full tool access. The training, all four specialisations and the 1-month agency internship are the same in both. The ₹9,999 plan adds access to Claude, Semrush, Gemini Pro, Google AI Pro, Ahrefs, SpyFu, Ubersuggest and Canva. Only this plan includes live ad experience on an agency or brand account with a real ad budget. The ₹5,999 plan has no ad budget, and there is no other add-on.'],
  ['Do I need marketing experience to join?', 'No. The program starts from building a website and goes step by step to AI-run workflows, so beginners can join.'],
  ['Is there a refund if it is not right for me?', 'Yes. There is a 7-day money-back guarantee. Tell us within 7 days of your first live class, with at least 70% attendance in those days, and the program fee is refunded. You pay only after an onboarding call, once your questions are answered.'],
  ['Do you offer placement support?', 'Yes. Placement support is included: interview prep sessions, job application support and guidance, along with real work, an agency internship and a CV rewrite. Recent students have been placed at ₹5 to 15 LPA, with public profiles you can check.'],
];

const out = [];
function write(rel, html) { out.push(rel); const f = path.join(ROOT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); }

// ---------- city pages ----------
const bySlug = Object.fromEntries(CITIES.map((c) => [c.slug, c]));
for (const c of CITIES) {
  const p = `/digital-marketing-course/${c.slug}`;
  let title = `Digital Marketing Course in ${c.name} (Live Online, AI) | AIM`;
  if (title.length > 60) title = `Digital Marketing Course in ${c.name} | AIM`;
  let desc = `Live online AI digital marketing course for learners in ${c.name}. 12 weeks, agency internship, Rs 5,999 or Rs 9,999 with full tool access. Evening batches.`;
  if (desc.length > 160) desc = `Live online AI digital marketing course for ${c.name}. 12 weeks, agency internship, Rs 5,999 or Rs 9,999 with tools. Evening classes.`;
  const faq = [
    [`Is there a physical centre in ${c.name}?`, `No. AIM is a live online program, so there is no classroom in ${c.name} to travel to. You join the live classes from home and get the same training and internship as every other learner.`],
    c.faq,
    [`How much does a digital marketing course in ${c.name} cost?`, `AIM costs ₹5,999 with limited tool access, or ₹9,999 with full tool access. Because the course is live online, the fee is the same for ${c.name} as for every other city. You pay only after an onboarding call, and there is a 7-day money-back guarantee.`],
    [`How long is the digital marketing course for learners in ${c.name}?`, `The program runs 12 weeks. Weeks 1 to 4 cover the core skills, weeks 5 to 8 are four specialisations, and weeks 9 to 12 are a 1-month agency internship. Live classes are Monday to Friday, 9 to 11 pm IST.`],
    ...COMMON_FAQ.slice(0, 3),
    COMMON_FAQ[3],
  ];
  const near = c.nearby.map((s) => bySlug[s]).filter(Boolean);
  const idx = CITIES.indexOf(c);
  const v = idx % 3;           // layout variant: section order and heading wording
  const theme = THEMES[idx % THEMES.length];
  const layout = LAYOUTS[Math.floor(idx / THEMES.length + idx) % LAYOUTS.length];
  const N = esc(c.name);
  const kerala = c.region === 'kerala' || c.hub;
  const learnH = [`Learn digital marketing from ${N}, without a centre`, `How the live online course works for learners in ${N}`, `Study from ${N} in the evening, keep your day free`][v];
  const workH = [`What marketing work looks like in ${N}`, `Why ${N} businesses need people who can use AI at work`, `The marketing jobs and clients around ${N}`][v];
  const projH = [`Briefs you can practise with a ${N} angle`, `Portfolio projects shaped around ${N}`, `Three real-style projects for ${N}`][v];
  const planH = [`What you do in the 12 weeks`, `Your 12 weeks, week by week`, `The 12-week path in short`][v];
  const feeH = [`What it costs compared with other programs in India`, `Fees compared: what other live programs list`, `The fee, and how it compares`][v];
  const sec = {
    learn: `<h2 id="learn-from-${c.slug}">${learnH}</h2>
<p>${[
      `AIM runs live online, Monday to Friday, 9 to 11 pm IST, with weekends kept for one-on-one doubt clearing, project reviews and interview prep. You can join from ${N} while you study or work, with no commute and no relocation. The program is <a href="/digital-marketing-course">the same for every city</a>, which means the ${N} learner gets the full nine modules, four specialisations and the agency internship.`,
      `There is no classroom in ${N} to travel to. You log in for two hours each weekday evening (9 to 11 pm IST), and weekends are for doubt clearing, project reviews and interview prep. Everything in the <a href="/digital-marketing-course">12-week program</a> is the same wherever you sit: nine modules, four specialisations and a 1-month agency internship.`,
      `If your days are taken by college, a job or a family business in ${N}, the timing is the point: live classes from 9 to 11 pm IST, Monday to Friday. You get the same <a href="/digital-marketing-course">nine modules, four specialisations and agency internship</a> as every other learner, and your weekends stay open for reviews and doubts.`][v]}</p>
<p>${[
      `AI now does most routine marketing tasks. People who do not learn how companies use AI at work give employers less reason to hire them. That is why AI sits inside every module here, and why you work inside the real platforms from week 1.`,
      `Routine marketing work is moving to AI tools. What stays with people is directing those tools and checking the output. So AI is part of every module, and you work inside the real platforms from the first week.`,
      `Employers now expect AI to handle the routine parts of marketing, so the person they hire needs to know how to direct it and check it. That is why AI is in every module, with hands-on practice in the real tools from week 1.`][v]}</p>`,
    work: `<h2 id="work-in-${c.slug}">${workH}</h2>
<p>${esc(c.industries)}</p>
<p class="aimb-small">This is general context about ${kerala ? 'the place' : 'the city'}&rsquo;s economy, not a hiring statistic.${PAY[c.slug] ? '' : ' For salary expectations, check current listings for the roles you want.'}</p>${payHtml(c) ? '\n' + payHtml(c) : ''}`,
    projects: `<h2 id="projects">${projH}</h2>
<p>Each module ends with a project that goes into your live portfolio. ${['In', 'You could shape yours around businesses in', 'Examples from'][v]} ${N}${['you could shape yours around local businesses, for example:', ', for example:', ':'][v]}</p>
<ul>
${c.projects.map((x) => `<li>${esc(x)}</li>`).join('\n')}
</ul>
<p>For the SEO module, one useful exercise is ${esc(c.seo)}. The same method works for any city, and you keep the result as portfolio proof.</p>`,
    plan: `<h2 id="plan">${planH}</h2>
${PLAN}
<p>Pick a path that suits you: <strong>freelancer</strong> (land your first clients), <strong>agency</strong> (join an agency team or run your own) or <strong>job</strong> (interview-ready for in-house roles). All three use the same nine modules and the same two fees.</p>`,
    diff: DIFF(N),
    fee: `<h2 id="fee">${feeH}</h2>
<p>Course fees vary widely, and a place name on a listing does not change what you learn. Here is what live programs in India list, so you can compare before you pay anyone.</p>
${FEE_TABLE}`,
    faq: faqHtml(faq),
    more: `<h2 id="more">More digital marketing course pages</h2>
<ul>
<li><a href="/digital-marketing-course">Digital marketing course in India: the full program</a></li>
<li><a href="/ai-digital-marketing-course">AI digital marketing course</a> and <a href="/vibe-marketing-course">vibe marketing course</a></li>
<li><a href="/digital-marketing-course-with-internship">Digital marketing course with internship</a> and <a href="/digital-marketing-course-online">online digital marketing course</a></li>
<li><a href="/about">About AIM and its trainers</a></li>
${near.map((n) => `<li><a href="/digital-marketing-course/${n.slug}">${n.hub ? 'Digital marketing course in Kerala: all cities' : 'Digital marketing course in ' + esc(n.name)}</a></li>`).join('\n')}
<li><a href="/blogs/best-digital-marketing-courses-india-2026-how-to-choose">How to choose the best digital marketing course in India</a></li>
<li><a href="/blogs/digital-marketing-course-fees-india-2026">Digital marketing course fees in India</a></li>
<li><a href="/blogs/vibe-marketing-course-india-what-you-learn">Vibe marketing course in India: what you learn</a></li>${kerala ? '\n<li><a href="/blogs/digital-marketing-course-kerala-what-to-look-for">Digital marketing course in Kerala: what to look for</a></li>' : ''}
</ul>`,
  };
  const orders = [['learn', 'work', 'projects', 'plan', 'diff', 'fee', 'faq', 'more'], ['work', 'learn', 'plan', 'diff', 'projects', 'faq', 'fee', 'more'], ['projects', 'work', 'learn', 'diff', 'fee', 'plan', 'faq', 'more']];
  const keralaBlock = c.hub ? `<h2 id="kerala-cities">Digital marketing course by city in Kerala</h2>
<p>One live online program serves every Kerala city. Pick the page closest to where you live to see projects and context for your area.</p>
<ul>
${CITIES.filter((x) => x.region === 'kerala').map((x) => `<li><a href="/digital-marketing-course/${x.slug}">Digital marketing course in ${esc(x.name)}</a></li>`).join('\n')}
</ul>` : (c.region === 'kerala' ? `<p class="aimb-small">Also in Kerala: <a href="/digital-marketing-course/kerala">digital marketing course in Kerala, all cities</a>.</p>` : '');
  const body = '\n' + orders[v].map((k) => sec[k] + (k === 'work' ? '\n' + keralaBlock : '')).join('\n\n');
  write(`digital-marketing-course/${c.slug}.html`, page({
    path: p, title, desc, kicker: 'Live online, for learners in ' + c.name,
    h1: `Digital marketing course in ${c.name}: live online, AI built into every module`,
    answer: `Yes, you can take a good digital marketing course from ${c.name} without moving anywhere. AIM by Adsmentor is a live online AI digital marketing course: 12 weeks, nine modules, a 1-month agency internship, and live classes 9 to 11 pm IST on weekdays. It costs ₹5,999, or ₹9,999 with full tool access, with a 7-day money-back guarantee.`,
    lead: `A live online AI digital marketing course for learners in ${c.name}. Twelve weeks, nine modules, a 1-month agency internship, from ₹5,999.`,
    crumbs: [['Home', '/'], ['Digital marketing course', '/digital-marketing-course'], [c.name, null]],
    body, faq, theme, layout,
    course: courseLd({ name: `AI Digital Marketing Course for learners in ${c.name}`, desc, path: p, city: c.name.replace(' NCR', '') }),
    breadcrumb: crumbLd([['Home', '/'], ['Digital marketing course', '/digital-marketing-course'], [c.name, p]]),
  }));
}

// ---------- pillar ----------
{
  const p = '/digital-marketing-course';
  const title = 'Digital Marketing Course in India (Live Online, AI) | AIM';
  const desc = 'Live online digital marketing course in India: AI in every module, 4 specialisations, 1-month agency internship. Rs 5,999, or Rs 9,999 with full tool access.';
  const faq = COMMON_FAQ.concat([['Can I join from any city?', 'Yes. Classes are live online from 9 to 11 pm IST on weekdays, so learners in any city in India can join. See the city pages below for local context.'],
    ['What should a good digital marketing course in India include in 2026?', 'Look for five things: AI used inside every module, hands-on work in the real platforms, a portfolio you can show, real client work through an internship, and a fee listed openly. AIM covers all five in 12 weeks.'],
    ['How long does it take to learn digital marketing?', 'The AIM program takes 12 weeks: four weeks of core skills, four weeks of specialisation and a 1-month agency internship. Skill grows with practice after that, so the portfolio and internship matter as much as the classes.'],
    ['Is a digital marketing course worth it in India?', 'It is worth it when the course gives you work you can show and teaches how companies use AI today. A certificate alone rarely decides a hire. Compare fees, check what you build, and use the 7-day refund window if it is not right.']]);
  const body = `
<h2 id="what-you-learn">What the course covers</h2>
<p>AIM is a 12-week program with nine modules, taught to every learner: five core modules and four specialisations. AI is built into each one, so you learn the way companies now work, not from a single AI chapter at the end.</p>
<ul>
<li><strong>Module 1, web development:</strong> WordPress, WordPress MCP and vibe coding. You build a live portfolio site.</li>
<li><strong>Module 2, SEO and AI search:</strong> keyword research, technical audits, local SEO and showing up in AI answers.</li>
<li><strong>Module 3, social media, content and automations:</strong> content calendars, AI content workflows, DM and WhatsApp automations.</li>
<li><strong>Module 4, ads:</strong> Facebook, Instagram, LinkedIn, Snapchat and X, with creative testing and budgets.</li>
<li><strong>Module 5, media planning:</strong> budget splits, channel mix and forecasting.</li>
<li><strong>Specialisations 6 to 9:</strong> AI Generalist, Marktech, Branding and Content, Performance and Growth. All four are included.</li>
</ul>
<h2 id="plan">How the 12 weeks run</h2>
${PLAN}
<h2 id="why-ai">Why the course is built around AI</h2>
<p>AI now does most routine marketing tasks. If you do not learn how companies use AI at work, employers have less reason to hire you. So you practise with Claude, WordPress MCP, ads MCPs, CRO automations and chatbots inside the platforms, on briefs shaped like real company work. Read more on the <a href="/ai-digital-marketing-course">AI digital marketing course</a> and <a href="/vibe-marketing-course">vibe marketing course</a> pages, or see how <a href="/digital-marketing-course-online">the online format</a> works.</p>
${DIFF('')}
<h2 id="fee">Fee and how it compares</h2>
<p>There are two plans. &#8377;5,999 with limited tool access, or &#8377;9,999 with full tool access. The training, the four specialisations and the agency internship are the same in both.</p>
${FEE_TABLE}
<h2 id="cities">Digital marketing course by city</h2>
<p>The classes are live online, so one program serves every city. Each city page covers what marketing work looks like there and which local briefs you can practise on.</p>
<ul>
${CITIES.map((c) => `<li><a href="/digital-marketing-course/${c.slug}">Digital marketing course in ${esc(c.name)}</a></li>`).join('\n')}
</ul>
${faqHtml(faq)}
<h2 id="read">Read before you decide</h2>
<ul>
<li><a href="/blogs/best-digital-marketing-courses-india-2026-how-to-choose">How to choose the best digital marketing course in India</a></li>
<li><a href="/blogs/ai-in-marketing-course-what-to-look-for">Seven questions to ask before paying for an AI marketing course</a></li>
<li><a href="/blogs/what-is-vibe-marketing">What vibe marketing is and how to start</a></li>
<li><a href="/blogs/digital-marketing-course-fees-india-2026">Digital marketing course fees in India, and what to ask</a></li>
<li><a href="/blogs/vibe-marketing-course-india-what-you-learn">What a vibe marketing course should teach</a></li>
</ul>`;
  write('digital-marketing-course/index.html', page({ theme: 'sunrise', layout: 'center',
    path: p, title, desc, kicker: 'Digital marketing course in India', h1: 'Digital marketing course in India: live online, AI in every module',
    answer: 'A good digital marketing course in India in 2026 teaches AI inside every module, gives you real work to show, and lists its fee openly. AIM by Adsmentor is built that way: live online, 12 weeks, nine modules, a 1-month agency internship, from ₹5,999, or ₹9,999 with full tool access, with a 7-day money-back guarantee.',
    lead: 'Learn digital marketing the way companies now do it, with AI in all nine modules, then spend a month inside an agency. From ₹5,999.',
    crumbs: [['Home', '/'], ['Digital marketing course', null]], body, faq,
    course: courseLd({ name: 'AI Digital Marketing Course in India (AIM)', desc, path: p }),
    breadcrumb: crumbLd([['Home', '/'], ['Digital marketing course', p]]),
  }));
}

// ---------- AI digital marketing course ----------
{
  const p = '/ai-digital-marketing-course';
  const title = 'AI Digital Marketing Course (Live Online, Rs 5,999) | AIM';
  const desc = 'An AI digital marketing course where AI runs through all 9 modules: Claude, WordPress MCP, ads MCPs, chatbots. 1-month agency internship. Rs 5,999 or Rs 9,999.';
  const faq = [
    ['What makes this an AI digital marketing course and not a normal one?', 'AI is part of all nine modules and all four specialisations, not one chapter. You work with Claude, Claude Code and the command line, WordPress MCP, MCPs for ads, CRO automations and chatbots, on real-style briefs.'],
    ['Which AI tools do I get access to?', 'The ₹9,999 plan includes tool access: Claude, Semrush, Gemini Pro, Google AI Pro, Ahrefs, SpyFu, Ubersuggest and Canva. The ₹5,999 plan has limited tool access, and the training is the same. Many tools in the course also have free plans or trials.'],
    ['What is a digital marketing with AI course?', 'It teaches the usual digital marketing skills, which are SEO, ads, social media, content and analytics, with AI tools used inside each one. At AIM the tools include Claude, WordPress MCP and MCPs for ad accounts, used on real-style briefs.'],
    ['Is an AI digital marketing course worth it in 2026?', 'It is worth it if AI is in every module, you do real work with it and you leave with proof. Check three things before paying: AI inside every module, an internship or real client work, and a fee listed openly. AIM lists both fees and has a 7-day money-back guarantee.'],
    ['How long is the AI digital marketing course?', 'Twelve weeks. Weeks 1 to 4 are core skills, weeks 5 to 8 are four specialisations, and weeks 9 to 12 are a 1-month agency internship. Live classes run Monday to Friday, 9 to 11 pm IST.'],
    ['Will AI replace marketers?', 'AI now does most routine marketing tasks, so the routine part of the job is shrinking. People who know how to direct AI, check its output and own the result are the ones companies keep. That is what the course trains.'],
  ].concat(COMMON_FAQ.slice(1, 3));
  const body = `
<h2 id="ai-in-every-module">Digital marketing with AI: AI in every module, not one chapter</h2>
<p>Many courses add one AI chapter near the end. Here AI runs through all nine modules, so you never learn a habit you will have to unlearn. In week 1 you are already working inside the tools.</p>
<ul>
<li><strong>WordPress MCP:</strong> connect Claude to a live WordPress site and direct it to build pages and fix issues. You stay the editor.</li>
<li><strong>Claude and Claude Code:</strong> audits, reports and content batches in the command line that used to take whole days.</li>
<li><strong>MCPs for ads:</strong> ask your ad accounts what is wasting spend, and review the fixes before anything goes live.</li>
<li><strong>CRO automations:</strong> find where visitors drop off and keep tests running.</li>
<li><strong>Chatbots:</strong> website and WhatsApp bots that answer, qualify and book leads.</li>
<li><strong>Agents:</strong> research competitors and draft reports for your review.</li>
</ul>
${DIFF('')}
<h2 id="what-you-build">What you build</h2>
<p>Each module ends with a project in your portfolio: a live website, an SEO audit and roadmap, a 30-day content calendar with one working automation, campaign setups on five platforms, a media plan, your own AI marketing assistant, a lead-to-CRM workflow with a chatbot, a brand kit, and an ad-account audit with a CRO test plan.</p>
<h2 id="plan">The 12-week path</h2>
${PLAN}
<h2 id="fee">Fee</h2>
<p>&#8377;5,999 with limited tool access, or &#8377;9,999 with full tool access. The tiers differ only in tool access and live ad experience.</p>
${FEE_TABLE}
${faqHtml(faq)}
<h2 id="more">More</h2>
<ul>
<li><a href="/digital-marketing-course">Digital marketing course in India: the full program</a></li>
<li><a href="/vibe-marketing-course">Vibe marketing course</a></li>
<li><a href="/digital-marketing-course-online">Online digital marketing course</a></li>
<li><a href="/digital-marketing-course-with-internship">Digital marketing course with internship</a></li>
<li><a href="/digital-marketing-course-syllabus">Digital marketing course syllabus</a></li><li><a href="/digital-marketing-course-after-12th">Digital marketing course after 12th</a></li><li><a href="/digital-marketing-projects">Digital marketing projects</a></li>
<li><a href="/blogs/agentic-ai-marketing-work-competitors-hand-to-agents">The marketing work competitors are handing to AI agents</a></li>
<li><a href="/blogs/ai-in-marketing-course-what-to-look-for">Seven questions to ask before paying for an AI marketing course</a></li>
</ul>`;
  write('ai-digital-marketing-course.html', page({ theme: 'ocean', layout: 'left',
    path: p, title, desc, kicker: 'AI digital marketing course', h1: 'AI digital marketing course: AI inside every module',
    answer: 'An AI digital marketing course should teach you to do marketing work with AI tools, not only to read about them. AIM is a live online digital marketing with AI course: AI runs through all nine modules, with Claude, WordPress MCP and MCPs for ad accounts, 12 weeks, a 1-month agency internship, ₹5,999, or ₹9,999 with full tool access.',
    lead: 'AI now does most routine marketing tasks. This course teaches you to direct it, check it and own the result, inside the real platforms.',
    crumbs: [['Home', '/'], ['Digital marketing course', '/digital-marketing-course'], ['AI digital marketing course', null]], body, faq,
    course: courseLd({ name: 'AI Digital Marketing Course (AIM)', desc, path: p }),
    breadcrumb: crumbLd([['Home', '/'], ['Digital marketing course', '/digital-marketing-course'], ['AI digital marketing course', p]]),
  }));
}

// ---------- vibe marketing course ----------
{
  const p = '/vibe-marketing-course';
  const title = 'Vibe Marketing Course (Live Online, From Rs 5,999) | AIM';
  const desc = 'A hands-on vibe marketing course: build sites, content, ads and automations by directing AI. 12 weeks, agency internship, Rs 5,999 or Rs 9,999 with tools.';
  const faq = [
    ['What is vibe marketing?', 'Vibe marketing means describing the marketing outcome you want in plain language and directing AI tools to build and run it, then checking and improving the result yourself. Our guide on what vibe marketing is explains it in full.'],
    ['Do I need to code for a vibe marketing course?', 'No. Module 1 teaches vibe coding, where you describe a landing page to AI coding tools instead of writing it by hand, and you start from zero.'],
  ].concat(COMMON_FAQ.slice(0, 3));
  const body = `
<h2 id="what-it-is">What a vibe marketing course should teach</h2>
<p>Vibe marketing is the habit of telling AI what you want and steering the output, instead of doing each step by hand. It is only useful if you also know what good looks like, so a course has to teach both the tools and the marketing. Read the full explanation in <a href="/blogs/what-is-vibe-marketing">what vibe marketing is and how to start</a>.</p>
<h2 id="how-we-teach">How AIM teaches it</h2>
<ul>
<li><strong>Build:</strong> a WordPress site and a landing page created by describing them, with WordPress MCP and AI coding tools.</li>
<li><strong>Research and plan:</strong> Claude and Claude Code for audits, keyword clusters and content plans.</li>
<li><strong>Run:</strong> ads on five platforms, DM and WhatsApp automations, chatbots and CRO tests.</li>
<li><strong>Check:</strong> you review every output, because AI can be confidently wrong and the account is yours.</li>
</ul>
<h2 id="two-meanings">Two meanings of vibe marketing: which one this course is</h2>
<p>You will see the term used two ways. Some brands use it for building a feeling around the brand, through style, culture and tone, instead of listing product features. In AI circles it means directing AI tools to build and run marketing work from plain-language instructions. This course teaches the second meaning, the hands-on one, and the brand side comes in through the Branding and Content specialisation.</p>
<h2 id="what-you-build">What you build with it</h2>
<ul>
<li>A live website on your own domain, built by describing it and directing WordPress MCP and AI coding tools.</li>
<li>An SEO audit and roadmap, and a 30-day content calendar with one working automation.</li>
<li>Campaign setups on five platforms, and a media plan.</li>
<li>Your own AI marketing assistant, and a lead-to-CRM workflow with a chatbot.</li>
<li>A brand kit, and an ad-account audit with a CRO test plan.</li>
</ul>
<h2 id="who-for">Who it suits</h2>
<p>Freelancers who want to deliver more client work alone, people who want to work in or start an agency, and job seekers who need proof of real work. You do not need to code, and you start from zero. Learners join live from any city, including <a href="/digital-marketing-course/delhi">Delhi NCR</a>, <a href="/digital-marketing-course/mumbai">Mumbai</a>, <a href="/digital-marketing-course/bangalore">Bangalore</a>, <a href="/digital-marketing-course/hyderabad">Hyderabad</a>, <a href="/digital-marketing-course/pune">Pune</a>, <a href="/digital-marketing-course/chennai">Chennai</a>, <a href="/digital-marketing-course/jaipur">Jaipur</a> and <a href="/digital-marketing-course/kochi">Kochi</a>.</p>
${DIFF('')}
<h2 id="plan">The 12-week path</h2>
${PLAN}
<h2 id="fee">Fee</h2>
<p>&#8377;5,999 with limited tool access, or &#8377;9,999 with full tool access (Claude, Semrush, Gemini Pro, Google AI Pro, Ahrefs, SpyFu, Ubersuggest and Canva). The training is the same in both.</p>
${faqHtml(faq)}
<h2 id="more">More</h2>
<ul>
<li><a href="/digital-marketing-course">Digital marketing course in India: the full program</a></li>
<li><a href="/ai-digital-marketing-course">AI digital marketing course</a></li>
<li><a href="/digital-marketing-course-with-internship">Digital marketing course with internship</a></li>
<li><a href="/digital-marketing-course-syllabus">Digital marketing course syllabus</a></li><li><a href="/digital-marketing-course-after-12th">Digital marketing course after 12th</a></li>
<li><a href="/blogs/what-is-vibe-marketing">What vibe marketing is</a></li>
<li><a href="/blogs/vibe-marketing-course-india-what-you-learn">What a vibe marketing course should teach</a></li>
</ul>`;
  write('vibe-marketing-course.html', page({ theme: 'plum', layout: 'card',
    path: p, title, desc, kicker: 'Vibe marketing course', h1: 'Vibe marketing course: direct AI to do the work, then own the result',
    answer: 'Vibe marketing means directing AI to build websites, content, ads and automations while you check the result and own it. AIM teaches it hands-on in 12 weeks, with an agency internship, for ₹5,999, or ₹9,999 with full tool access, and a 7-day money-back guarantee.',
    lead: 'Learn vibe marketing inside the real tools, on briefs shaped like company work, then prove it in a 1-month agency internship.',
    crumbs: [['Home', '/'], ['Digital marketing course', '/digital-marketing-course'], ['Vibe marketing course', null]], body, faq,
    course: courseLd({ name: 'Vibe Marketing Course (AIM)', desc, path: p }),
    breadcrumb: crumbLd([['Home', '/'], ['Digital marketing course', '/digital-marketing-course'], ['Vibe marketing course', p]]),
  }));
}

// ---------- online course ----------
{
  const p = '/digital-marketing-course-online';
  const title = 'Online Digital Marketing Course With Live Classes | AIM';
  const desc = 'A live online digital marketing course: weekday evening classes 9 to 11 pm IST, weekend doubt clearing, 1-month agency internship. Rs 5,999 or Rs 9,999.';
  const faq = [
    ['Are the classes live or pre-recorded?', 'They are live, Monday to Friday, 9 to 11 pm IST. Weekends are used for one-on-one doubt clearing, project reviews and interview prep.'],
    ['Is an online digital marketing course as good as a classroom one?', 'It can be, if the classes are live and you do real work. AIM is live, with weekly assignments for your portfolio, one-on-one doubt clearing on weekends and a 1-month online agency internship.'],
    ['Can I do it while working or studying?', 'Yes. The evening schedule was set so learners can join alongside a job or college.'],
    ['What do I need to take part?', 'A laptop and a stable internet connection. The portfolio website, domain and hosting are included, and the ₹9,999 plan adds tool access.'],
  ].concat(COMMON_FAQ.slice(2, 4));
  const body = `
<h2 id="how-it-works">How the online course works</h2>
<p>Classes run live, Monday to Friday, 9 to 11 pm IST. You work inside the platforms yourself, not on a trainer&rsquo;s screen. Each week has one assignment that goes into your portfolio, and weekends are for one-on-one doubt clearing, project reviews and interview prep.</p>
${DIFF('')}
<h2 id="internship">The internship is online too</h2>
<p>Weeks 9 to 12 are a 1-month internship at a partner agency on real client tasks, with a mentor check-in every week. The certificate comes from the agency, so it shows real work and not only that you finished classes.</p>
<h2 id="plan">The 12-week path</h2>
${PLAN}
<h2 id="fee">Fee compared with other online and offline programs</h2>
${FEE_TABLE}
${faqHtml(faq)}
<h2 id="cities">Join from your city</h2>
<p>${CITIES.map((c) => `<a href="/digital-marketing-course/${c.slug}">${esc(c.name)}</a>`).join(', ')}.</p>
<p>See also the <a href="/digital-marketing-course">full program page</a> and the <a href="/blogs/best-digital-marketing-courses-india-2026-how-to-choose">guide to choosing a course</a>.</p>`;
  write('digital-marketing-course-online.html', page({ theme: 'forest', layout: 'center',
    path: p, title, desc, kicker: 'Online digital marketing course', h1: 'Online digital marketing course with live evening classes',
    answer: 'A good online digital marketing course has live classes, real assignments and a way to prove your work. AIM runs live classes Monday to Friday, 9 to 11 pm IST, with weekend doubt clearing and a 1-month online agency internship, for ₹5,999, or ₹9,999 with full tool access.',
    lead: 'Learn from home, live, in the evening, and finish with an agency internship. From ₹5,999.',
    crumbs: [['Home', '/'], ['Digital marketing course', '/digital-marketing-course'], ['Online course', null]], body, faq,
    course: courseLd({ name: 'Online Digital Marketing Course (AIM)', desc, path: p }),
    breadcrumb: crumbLd([['Home', '/'], ['Digital marketing course', '/digital-marketing-course'], ['Online course', p]]),
  }));
}

// ---------- digital marketing course with internship ----------
{
  const p = '/digital-marketing-course-with-internship';
  const title = 'Digital Marketing Course With Internship (Live Online) | AIM';
  const desc = 'Digital marketing course with a 1-month agency internship on real client tasks, weekly mentor check-in and agency certificate. Live online, Rs 5,999 or Rs 9,999.';
  const faq = [
    ['Is the internship really included in the fee?', 'Yes. The 1-month agency internship is weeks 9 to 12 of the program and is in both plans, ₹5,999 and ₹9,999. There is no separate internship fee.'],
    ['Is the internship paid?', 'No. It is a training internship. You get real client tasks, a weekly mentor check-in and an agency certificate, not a stipend.'],
    ['Where is the internship done?', 'Online, like the rest of the program. You do not need to move to a city or travel to an office.'],
    ['What work do I do in the internship?', 'Real client tasks at a partner agency, in the areas you trained in, such as SEO, content, ads and automation. A mentor checks in every week and the work goes into your portfolio.'],
    ['Do you help with jobs after the internship?', 'Yes. Placement support covers interview prep sessions, job application support and guidance, along with a CV rewrite, 3 mock interviews, a portfolio site and real work to show from the internship.'],
  ].concat(COMMON_FAQ.slice(0, 3));
  const body = `
<h2 id="what-internship-is">What the internship is</h2>
<p>The internship is weeks 9 to 12 of the 12-week program. You spend a month at a partner agency on real client tasks, with a mentor check-in every week. At the end you get a certificate issued by the agency, so it shows real work and not only that you finished classes.</p>
<h2 id="before-internship">What you do before it starts</h2>
<p>Weeks 1 to 8 are live classes, Monday to Friday, 9 to 11 pm IST. Weeks 1 to 4 cover the core skills with AI in every module. Weeks 5 to 8 are four specialisations: AI Generalist, Marktech, Branding and Content, and Performance and Growth. By the time the internship starts you have a live portfolio site and a project from each module.</p>
<h2 id="what-you-get">What you take away</h2>
<ul>
<li>A month of real client work to show in interviews or to freelance clients.</li>
<li>An agency certificate, not only a course certificate.</li>
<li>A live portfolio site on your own domain and hosting.</li>
<li>A CV rewrite and 3 mock interviews.</li>
</ul>
<p>Placement support is part of the program: interview prep sessions, job application support and guidance.</p>
${DIFF('')}
<h2 id="internship-vs-no-internship">Course with internship or course without: what to check</h2>
<p>Many courses say internship and mean a project inside the class. Ask four things before you pay: Is it at a real agency? Is it on client work? Does someone review it each week? Does the certificate come from the agency? If any answer is no, it is a class project.</p>
<h2 id="fee">Fee compared with other programs</h2>
<p>The internship is in both plans. The plans differ only in tool access and live ad experience.</p>
${FEE_TABLE}
${faqHtml(faq)}
<h2 id="more">More</h2>
<ul>
<li><a href="/digital-marketing-course">Digital marketing course in India: the full program</a></li>
<li><a href="/digital-marketing-course-online">Online digital marketing course</a></li>
<li><a href="/ai-digital-marketing-course">AI digital marketing course</a></li>
<li><a href="/blogs/best-digital-marketing-courses-india-2026-how-to-choose">How to choose the best digital marketing course in India</a></li>
</ul>`;
  write('digital-marketing-course-with-internship.html', page({ theme: 'plum', layout: 'card',
    path: p, title, desc, kicker: 'Digital marketing course with internship', h1: 'Digital marketing course with a 1-month agency internship',
    answer: 'A digital marketing course with internship should give you a month of real client work, reviewed by a mentor, with a certificate from the agency. AIM includes a 1-month agency internship in both plans, in weeks 9 to 12 of a 12-week live online course, from ₹5,999, or ₹9,999 with full tool access. Placement support is included.',
    lead: 'Learn live, then spend a month on real client tasks at an agency. Online, from ₹5,999.',
    crumbs: [['Home', '/'], ['Digital marketing course', '/digital-marketing-course'], ['Course with internship', null]], body, faq,
    course: courseLd({ name: 'Digital Marketing Course With Internship (AIM)', desc, path: p }),
    breadcrumb: crumbLd([['Home', '/'], ['Digital marketing course', '/digital-marketing-course'], ['Course with internship', p]]),
  }));
}

// ---------- Syllabus pillar page ----------
{
  const p = '/digital-marketing-course-syllabus';
  const title = 'Digital Marketing Course Syllabus: AI Integrated, Online | AIM';
  const desc = '12-week digital marketing course syllabus: 9 modules, AI integrated in every one, live online, 4 specialisations and an agency internship. From Rs 5,999.';
  const faq = [
    ['What is in the AIM digital marketing course syllabus?', 'Nine modules over 12 weeks. Weeks 1 to 4 are five core modules: web development with WordPress, WordPress MCP and vibe coding; SEO and AI search; social media, content and automations; ads on Facebook, Instagram, LinkedIn, Snapchat and X; and media planning. Weeks 5 to 8 are four specialisations: AI Generalist, Marktech, Branding and Content, and Performance and Growth. Weeks 9 to 12 are a 1-month agency internship.'],
    ['What does an AI integrated digital marketing course mean?', 'AI is used inside every module, not taught as one separate chapter. You use Claude, WordPress MCP, MCPs for ad accounts, CRO automations and chatbots on the same tasks a marketer does at work, such as building a site, auditing SEO, running ads and planning media.'],
    ['Is the course fully online, and can I join from anywhere in India?', 'Yes. Classes are live online, Monday to Friday, 9 to 11 pm IST, so you can join from any city in India without moving. Class recordings are available in the LMS.'],
    ['How many hours a day are the classes?', 'Two hours a day, Monday to Friday, 9 to 11 pm IST, which suits students and working people.'],
    ['Do I get to choose a specialisation?', 'All four specialisations are included in the fee: AI Generalist, Marktech, Branding and Content, and Performance and Growth. There is no add-on fee for any of them.'],
    ['Is the syllabus the same in both plans?', 'The training is the same in both plans. The ₹5,999 plan has limited tool access (Spectra Pro, Elementor Pro, Canva and Semrush, plus domain and hosting). The ₹9,999 plan adds full tool access and live ad experience on an agency or brand account with a real ad budget.'],
    ['Can I get the syllabus as a PDF?', 'Yes. The 12-week syllabus is a free download on this page. Enter your name, WhatsApp number and email and it is sent to you.'],
  ].concat(COMMON_FAQ.slice(1, 3));
  const mods = [
    ['Weeks 1 to 4', 'Module 1. Web development: WordPress, WordPress MCP and vibe coding', 'Your live portfolio website and one landing page'],
    ['Weeks 1 to 4', 'Module 2. SEO and AI search', 'An SEO audit and a 3-month roadmap for a real brand'],
    ['Weeks 1 to 4', 'Module 3. Social media, content and automations', 'A 30-day content calendar and one working DM or WhatsApp automation'],
    ['Weeks 1 to 4', 'Module 4. Ads on Facebook, Instagram, LinkedIn, Snapchat and X', 'Campaign setups on all 5 platforms with a test plan'],
    ['Weeks 1 to 4', 'Module 5. Media planning', 'A full media plan for a brand launch'],
    ['Weeks 5 to 8', 'Four specialisations: AI Generalist, Marktech, Branding and Content, Performance and Growth', 'Deeper project work in each track, all included'],
    ['Weeks 9 to 12', 'Agency internship', 'Real client tasks, a weekly mentor check-in and an agency certificate'],
  ];
  const body = `
<h2 id="week-by-week">The 12-week digital marketing course syllabus</h2>
<p>This is the whole path, module by module, with what you build in each one. Classes are live online, Monday to Friday, 9 to 11 pm IST, and recordings stay in the LMS.</p>
<div class="aimb-tablewrap"><table class="aimb-table"><thead><tr><th>When</th><th>Module</th><th>What you build</th></tr></thead><tbody>
${mods.map(([w, m, b]) => `<tr><td>${w}</td><td>${esc(m)}</td><td>${esc(b)}</td></tr>`).join('\n')}
</tbody></table></div>
<h2 id="ai-integrated">Why an AI integrated digital marketing course matters</h2>
<p>AI now does much of the routine work in marketing: first drafts, audits, reports, setup and reporting. A syllabus that treats AI as one extra chapter leaves you able to talk about it but not to work with it. In an AI integrated digital marketing course, AI sits inside every module. You use Claude, WordPress MCP, MCPs for ad accounts, CRO automations and chatbots on the tasks you are learning, so you finish with the habit of working with AI, not a list of tools you have seen.</p>
<p>That is the difference employers and clients notice. Someone who can show a site, an SEO audit, a content calendar with a working automation and campaign setups, all built with AI inside real platforms, is easier to hire than someone with a certificate and a list of topics.</p>
<h2 id="how-ai-fits">Where AI shows up in each module</h2>
<ul>
<li><strong>Web development:</strong> you build your portfolio site with WordPress, WordPress MCP and vibe coding, instead of dragging blocks for weeks.</li>
<li><strong>SEO and AI search:</strong> you audit a real brand for Google and for AI search answers, and write a 3-month roadmap.</li>
<li><strong>Social media, content and automations:</strong> a content calendar plus one DM or WhatsApp automation that actually runs.</li>
<li><strong>Ads:</strong> campaigns on five platforms, with a test plan, working with MCPs for ad accounts.</li>
<li><strong>Specialisations:</strong> Marktech goes deep on Claude, MCP, automations, tracking and chatbots. AI Generalist ties every skill together so one person can do the work of a small team.</li>
</ul>
<h2 id="online">A digital marketing course online, live, from any city in India</h2>
<p>You do not need to live near a training centre. The course is a live digital marketing course online, for students and working people anywhere in India, with classes in the evening. See the <a href="/digital-marketing-course-online">online digital marketing course</a> page for how the format works, or browse the <a href="/digital-marketing-course">digital marketing course in India</a> page and the <a href="/all-pages">city pages</a>.</p>
${DIFF('India')}
<h2 id="plans">What is included in the fee</h2>
${PLAN}
<p>The training is the same in both plans. The ₹5,999 plan has limited tool access (Spectra Pro, Elementor Pro, Canva and Semrush, plus domain and hosting). The ₹9,999 plan adds full tool access and live ad experience on an agency or brand account with a real ad budget.</p>
${FEE_TABLE}
${faqHtml(faq)}
<h2 id="more">More</h2>
<ul>
<li><a href="/digital-marketing-course">Digital marketing course in India: the full program</a></li>
<li><a href="/ai-digital-marketing-course">AI digital marketing course</a></li>
<li><a href="/digital-marketing-course-online">Online digital marketing course</a></li>
<li><a href="/digital-marketing-course-with-internship">Digital marketing course with internship</a></li>
<li><a href="/digital-marketing-course-syllabus">Digital marketing course syllabus</a></li><li><a href="/digital-marketing-course-after-12th">Digital marketing course after 12th</a></li>
<li><a href="/blogs/best-digital-marketing-courses-india-2026-how-to-choose">How to choose the best digital marketing course in India</a></li>
</ul>`;
  write('digital-marketing-course-syllabus.html', page({ theme: 'ocean', layout: 'card',
    path: p, title, desc, kicker: 'Digital marketing course syllabus', h1: 'Digital marketing course syllabus: 12 weeks, AI in every module, live online',
    answer: 'The AIM digital marketing course syllabus is 12 weeks and nine modules, taught live online. Weeks 1 to 4 cover five core modules, weeks 5 to 8 are four specialisations, and weeks 9 to 12 are a 1-month agency internship. AI is built into every module, so you learn to work with it, not just hear about it. From ₹5,999, or ₹9,999 with full tool access.',
    lead: 'Every module, what you build in each, and why AI sits inside all of them. Online, from ₹5,999.',
    crumbs: [['Home', '/'], ['Digital marketing course', '/digital-marketing-course'], ['Syllabus', null]], body, faq,
    course: courseLd({ name: 'Digital Marketing Course Syllabus: AI Integrated, Live Online (AIM)', desc, path: p }),
    breadcrumb: crumbLd([['Home', '/'], ['Digital marketing course', '/digital-marketing-course'], ['Syllabus', p]]),
  }));
}

// ---------- After 12th pillar page ----------
{
  const p = '/digital-marketing-course-after-12th';
  const title = 'Digital Marketing Course After 12th: Eligibility, Fees | AIM';
  const desc = 'Digital marketing course after 12th: who can join from any stream, what you learn, fees and careers. Live online, AI in every module, internship included.';
  const faq = [
    ['Can I do a digital marketing course after 12th?', 'Yes. You can start right after 12th, from any stream. AIM starts from building a website and goes step by step, so you do not need marketing experience.'],
    ['Which stream is best for digital marketing after 12th: commerce, science or arts?', 'None is required. Commerce students find the business side familiar, science students often like the analytics, and arts students often like content and branding. The course teaches all of it from the start, so your stream does not decide whether you can join.'],
    ['Do I need maths or coding for digital marketing?', 'No coding is needed. You use everyday numbers for budgets and reports, and you build your site with WordPress and AI tools instead of writing code from scratch.'],
    ['Can I do the course along with college?', 'Yes. Classes are live online, Monday to Friday, 9 to 11 pm IST, so they fit around college hours. Recordings stay in the LMS if you miss a class.'],
    ['Is a digital marketing degree better than a course?', 'A degree such as a BBA or B.Sc takes three years and costs much more, and it gives you a degree certificate. A short course teaches the working skills in weeks and gives you projects and an internship to show. Many students do both: a degree for the certificate and a course for the skills employers ask about in interviews.'],
    ['What jobs can I get with digital marketing after 12th?', 'Common entry roles are SEO executive, social media executive, performance marketing or ads executive, content executive and e-commerce marketer. You can also freelance. Placement support is included: interview prep sessions, job application support and guidance.'],
    ['How long does a digital marketing course after 12th take?', 'Courses run from about three months to three years depending on the type. AIM is 12 weeks: eight weeks of live classes and a 1-month agency internship.'],
    ['Are online digital marketing courses valid?', 'Employers care about what you can show: a live website, campaign setups, an SEO audit and real client work. AIM gives you those, plus an internship certificate issued by the agency.'],
    ['How much does it cost?', 'The AIM program costs ₹5,999 with limited tool access, or ₹9,999 with full tool access. A three-year degree costs several lakh rupees. See the fee comparison on this page.'],
  ];
  const body = `
<h2 id="can-you">Can you do digital marketing after 12th?</h2>
<p>Yes, and 12th pass is enough to start. Digital marketing is a skill you can learn in months and use to get an entry-level job, an internship or your first freelance client, while you are still in college. You do not need a particular stream. You do not need to know coding. You do need to practise on real tools, because that is what employers test.</p>
<h2 id="streams">Digital marketing after 12th: commerce, science or arts</h2>
<ul>
<li><strong>Commerce:</strong> Budgets, pricing and customer behaviour will feel familiar. Ads and media planning are a natural fit.</li>
<li><strong>Science:</strong> You are used to data and logic, so analytics, tracking, SEO and automations tend to click quickly.</li>
<li><strong>Arts and humanities:</strong> Writing, design and storytelling matter a lot in content, social media and branding.</li>
</ul>
<p>The course starts from zero for everyone, so the stream you studied does not decide whether you can join. It only decides which module feels easiest at first.</p>
<h2 id="routes">Your options after 12th: degree, diploma, short course or a mix</h2>
<div class="aimb-tablewrap"><table class="aimb-table"><thead><tr><th>Route</th><th>Usual length</th><th>What you get</th><th>What to check</th></tr></thead><tbody>
<tr><td>Degree (BBA or B.Sc in digital marketing)</td><td>3 years</td><td>A degree certificate and broad business subjects</td><td>How much of it is hands-on, and whether the syllabus is current</td></tr>
<tr><td>Diploma</td><td>6 to 12 months</td><td>Structured training in the main channels</td><td>Live classes or recorded, and real projects</td></tr>
<tr><td>Short certificate</td><td>3 to 6 months</td><td>A skill set and a certificate</td><td>Who the certificate is from and whether you work on real tools</td></tr>
<tr><td>AIM program</td><td>12 weeks, live online</td><td>9 modules with AI in every one, 4 specialisations, a 1-month agency internship</td><td>You choose between limited and full tool access</td></tr>
</tbody></table></div>
<p>A common plan for students is to take a degree for the certificate and a live course alongside it for the skills. Evening classes make that possible without missing college.</p>
<h2 id="learn">What you learn in a digital marketing course after 12th</h2>
${PLAN}
<p>The full week-by-week path, with what you build in each module, is on the <a href="/digital-marketing-course-syllabus">digital marketing course syllabus</a> page.</p>
<h2 id="ai">Why AI inside every module matters when you are just starting</h2>
<p>When you start your career, you compete with people who already use AI to do routine work faster. If you learn AI as one chapter at the end, you can describe it but not use it. If it is part of every module, you build a site, run an SEO audit, plan content and set up ads with AI from day one, and you finish with the habit employers now look for. That is why AIM builds it into every module instead of selling it as an add-on.</p>
<h2 id="ninety">A simple 90-day plan after 12th</h2>
<ol>
<li><strong>Days 1 to 30:</strong> Learn the core skills and build your portfolio website. Weeks 1 to 4 of the program cover this.</li>
<li><strong>Days 31 to 60:</strong> Pick a specialisation and build deeper projects. All four are included.</li>
<li><strong>Days 61 to 90:</strong> Work on real client tasks in the 1-month agency internship and collect proof of work for your portfolio and CV.</li>
</ol>
<p>You can keep studying your degree the whole time. Read <a href="/blogs/digital-marketing-portfolio-for-freshers-india">what a fresher portfolio needs</a> and <a href="/blogs/digital-marketing-internship-india-how-to-get-one">how to get an internship</a> as you go.</p>
<h2 id="careers">Careers and first jobs</h2>
<p>Typical first roles are SEO executive, social media executive, ads or performance marketing executive, content executive and e-commerce marketer. Many students also start with freelance clients, then move into a role. Read the honest view in <a href="/blogs/will-ai-replace-digital-marketers-india">will AI replace digital marketers</a> and <a href="/blogs/is-digital-marketing-a-good-career-india-2026">is digital marketing a good career in India</a>. AIM includes placement support: interview prep sessions, job application support and guidance, a CV rewrite and 3 mock interviews.</p>
<h2 id="parents">For parents: what to ask before you pay for any course</h2>
<ul>
<li>Is the fee listed openly, with everything that is and is not included?</li>
<li>Is there a refund window, and what are its conditions? AIM has a 7-day money-back guarantee, and you pay only after an onboarding call.</li>
<li>Is the internship at a real agency, on client work, with a certificate from the agency?</li>
<li>Can you check the trainers? AIM trainers have public profiles on the <a href="/about">about page</a>.</li>
<li>Do they promise a job? Be careful if they do. AIM offers placement support, not a guarantee.</li>
</ul>
${DIFF('India')}
<h2 id="fee">Fee compared with other options</h2>
<p>The ₹5,999 plan has limited tool access (Spectra Pro, Elementor Pro, Canva and Semrush, plus domain and hosting). The ₹9,999 plan adds full tool access and live ad experience on an agency or brand account with a real ad budget. The training and the internship are the same.</p>
${FEE_TABLE}
<p>See the <a href="/blogs/digital-marketing-course-fees-india-2026">digital marketing course fees in India</a> guide for the full breakdown, and the <a href="/digital-marketing-course-online">online digital marketing course</a> page for how live online classes work.</p>
<h2 id="cities">Learn from any city</h2>
<p>The course is live online, so you can join from any city in India. See the pages for <a href="/digital-marketing-course/delhi">Delhi NCR</a>, <a href="/digital-marketing-course/mumbai">Mumbai</a>, <a href="/digital-marketing-course/bangalore">Bangalore</a>, <a href="/digital-marketing-course/hyderabad">Hyderabad</a>, <a href="/digital-marketing-course/pune">Pune</a>, <a href="/digital-marketing-course/chennai">Chennai</a> and <a href="/digital-marketing-course/kerala">Kerala</a>, or <a href="/all-pages">all city pages</a>.</p>
${faqHtml(faq)}
<h2 id="more">More</h2>
<ul>
<li><a href="/digital-marketing-course">Digital marketing course in India: the full program</a></li>
<li><a href="/digital-marketing-course-syllabus">Digital marketing course syllabus</a></li><li><a href="/digital-marketing-course-after-12th">Digital marketing course after 12th</a></li>
<li><a href="/ai-digital-marketing-course">AI digital marketing course</a></li>
<li><a href="/digital-marketing-course-with-internship">Digital marketing course with internship</a></li>
<li><a href="/blogs/digital-marketing-course-for-beginners-india">Digital marketing course for beginners</a></li>
</ul>`;
  write('digital-marketing-course-after-12th.html', page({ theme: 'sunrise', layout: 'left',
    path: p, title, desc, kicker: 'Digital marketing course after 12th', h1: 'Digital marketing course after 12th: who can join, what you learn and what it costs',
    answer: 'You can do a digital marketing course right after 12th, from any stream, with no coding and no marketing background. AIM is a 12-week live online program with AI in every module, four specialisations and a 1-month agency internship, with evening classes that fit around college. From ₹5,999, or ₹9,999 with full tool access.',
    lead: 'Eligibility, what to learn, how it compares with a degree, and what to ask before you pay. Live online, from ₹5,999.',
    crumbs: [['Home', '/'], ['Digital marketing course', '/digital-marketing-course'], ['After 12th', null]], body, faq,
    course: courseLd({ name: 'Digital Marketing Course After 12th (AIM)', desc, path: p }),
    breadcrumb: crumbLd([['Home', '/'], ['Digital marketing course', '/digital-marketing-course'], ['After 12th', p]]),
  }));
}

// ---------- Projects pillar page ----------
{
  const p = '/digital-marketing-projects';
  const title = 'Digital Marketing Projects for Students and Freshers | AIM';
  const desc = 'Digital marketing project ideas for students and freshers: 12 projects with what to build, tools and what to show. Includes the 5 built in the AIM course.';
  const faq = [
    ['What are good digital marketing projects for students?', 'Pick projects that end in something a person can open or check: a live website, an SEO audit with a roadmap, a 30-day content calendar, a campaign setup with a test plan and a media plan for a launch. Reports with only screenshots are weak proof.'],
    ['Can I do digital marketing projects with no clients?', 'Yes. Use a real local business, a brand you already know or your own site. Say it is a practice brief. Employers care more about how you think and what you built than about whether money changed hands.'],
    ['How many projects do I need in my portfolio?', 'Three to five solid ones beat fifteen thin ones. Cover a site, search, content and ads at least once each.'],
    ['Is there a digital marketing projects PDF I can download?', 'Yes. The free Digital Marketing Portfolio Kit is a 7-page PDF that shows how to present your projects. Get it from the portfolio guide linked on this page.'],
    ['What projects do you build in the AIM course?', 'A live portfolio website and landing page, an SEO audit with a 3-month roadmap, a 30-day content calendar with one working DM or WhatsApp automation, campaign setups on five ad platforms with a test plan, and a full media plan for a brand launch. Specialisations and the agency internship add more.'],
    ['Do I need to spend money on ads for a project?', 'No. A campaign setup with targeting, creative, budget logic and a test plan shows the skill without spend. On the ₹9,999 plan you also get live ad experience on an agency or brand account with a real ad budget.'],
    ['Can I use AI tools in my projects?', 'Yes, and you should. Say clearly what AI did and what you decided. Employers want to see that you can direct the tools, check the output and fix it.'],
    ['Where do I show my projects?', 'On your own portfolio website, with one page per project, plus your LinkedIn featured section and your CV.'],
  ];
  const ideas = [
    ['Portfolio website', 'WordPress, AI site builder', 'A live site with an about page, project pages and a contact form'],
    ['Landing page for a local business', 'WordPress, Canva', 'One page with a clear offer, form and tracking'],
    ['SEO audit and 3-month roadmap', 'Semrush or free tools, Search Console', 'Findings, priorities and a month-by-month plan'],
    ['Keyword and content plan', 'Semrush or free tools', '20 keywords grouped by intent with page ideas'],
    ['30-day content calendar', 'Canva, an AI writing tool', 'A calendar with posts, formats and goals'],
    ['DM or WhatsApp automation', 'An automation tool', 'A working flow that replies and captures a lead'],
    ['Meta or Instagram campaign setup', 'Ads Manager', 'Audience, creative, budget logic and a test plan'],
    ['Google search campaign setup', 'Google Ads', 'Keyword themes, ad copy and negatives'],
    ['LinkedIn ads setup', 'Campaign Manager', 'Targeting for a B2B offer with a test plan'],
    ['Email welcome sequence', 'Any email tool', 'Four emails with timing and goal'],
    ['Media plan for a brand launch', 'A spreadsheet', 'Channels, budget split, timeline and measures'],
    ['Analytics dashboard', 'GA4, a spreadsheet', 'A one-page view of what to track and why'],
  ];
  const body = `
<h2 id="what">What a good digital marketing project looks like</h2>
<p>A good project ends in something a person can open or check. A live page. A plan with reasons. A campaign setup with a test plan. A report with screenshots and no thinking behind it does not convince anyone. If you are a student or a fresher, three to five strong projects usually matter more than a long list.</p>
<h2 id="ideas">12 digital marketing project ideas for students and freshers</h2>
<div class="aimb-tablewrap"><table class="aimb-table"><thead><tr><th>Project</th><th>Tools</th><th>What you show</th></tr></thead><tbody>
${ideas.map(([a, b, c]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td><td>${esc(c)}</td></tr>`).join('\n')}
</tbody></table></div>
<p>Use a real local business, a brand you know or your own site, and say it is a practice brief. Do not invent results. Show your reasoning instead.</p>
<h2 id="how">How to run each project</h2>
<ol>
<li><strong>Write a one-paragraph brief:</strong> who the business is, what it sells, the goal.</li>
<li><strong>Research before you build:</strong> competitors, audience, search terms.</li>
<li><strong>Build the thing:</strong> the page, plan or setup, with AI tools where they save time.</li>
<li><strong>Explain your choices:</strong> why this audience, this budget split, this headline.</li>
<li><strong>Publish it:</strong> one page per project on your site, linked from LinkedIn.</li>
</ol>
<h2 id="aim">The projects you build in the AIM course</h2>
<p>Every module ends with something you make, and AI is part of each one.</p>
<ul>
<li><strong>Module 1:</strong> your live portfolio website and one landing page.</li>
<li><strong>Module 2:</strong> an SEO audit and a 3-month roadmap for a real brand.</li>
<li><strong>Module 3:</strong> a 30-day content calendar and one working DM or WhatsApp automation.</li>
<li><strong>Module 4:</strong> campaign setups on Facebook, Instagram, LinkedIn, Snapchat and X with a test plan.</li>
<li><strong>Module 5:</strong> a full media plan for a brand launch.</li>
<li><strong>Specialisations and internship:</strong> deeper work in your track, then real client tasks in the 1-month agency internship.</li>
</ul>
<p>See the full path on the <a href="/digital-marketing-course-syllabus">syllabus page</a>, and read <a href="/blogs/digital-marketing-portfolio-for-freshers-india">how to build a fresher portfolio</a>, which includes the free 7-page Portfolio Kit PDF.</p>
<h2 id="present">How to present projects so they get noticed</h2>
<ul>
<li>One page per project: brief, process, result or plan, what you learned.</li>
<li>Lead with the outcome, not the tool list.</li>
<li>Be honest about what was practice and what was real client work.</li>
<li>Add your best two projects to your CV and your LinkedIn featured section.</li>
</ul>
<p>Looking for real work next? Read <a href="/blogs/digital-marketing-internship-india-how-to-get-one">how to get a digital marketing internship</a>.</p>
${DIFF('India')}
<h2 id="fee">Fee compared with other options</h2>
<p>The ₹5,999 plan has limited tool access (Spectra Pro, Elementor Pro, Canva and Semrush, plus domain and hosting). The ₹9,999 plan adds full tool access and live ad experience on an agency or brand account with a real ad budget. The training and the internship are the same.</p>
${FEE_TABLE}
${faqHtml(faq)}
<h2 id="more">More</h2>
<ul>
<li><a href="/digital-marketing-course">Digital marketing course in India: the full program</a></li>
<li><a href="/digital-marketing-course-after-12th">Digital marketing course after 12th</a></li>
<li><a href="/digital-marketing-course-syllabus">Digital marketing course syllabus</a></li>
<li><a href="/digital-marketing-course-with-internship">Digital marketing course with internship</a></li>
</ul>`;
  write('digital-marketing-projects.html', page({ theme: 'ocean', layout: 'card',
    path: p, title, desc, kicker: 'Digital marketing projects', h1: 'Digital marketing projects for students and freshers: 12 ideas and how to present them',
    answer: 'The best digital marketing projects for students end in something people can open: a live site, an SEO audit with a roadmap, a content calendar with an automation, a campaign setup with a test plan and a media plan. Build three to five, explain your choices and publish one page for each. The AIM course has you build five of these, with AI in every module.',
    lead: 'Twelve project ideas, how to run each one, and how to show them. Plus the projects built in the AIM course.',
    crumbs: [['Home', '/'], ['Digital marketing course', '/digital-marketing-course'], ['Projects', null]], body, faq,
    course: courseLd({ name: 'Digital Marketing Projects (AIM)', desc, path: p }),
    breadcrumb: crumbLd([['Home', '/'], ['Digital marketing course', '/digital-marketing-course'], ['Projects', p]]),
  }));
}

// ---------- HTML sitemap (not in seo-pages.json: it has no Course schema) ----------
{
  const blogDir = path.join(ROOT, 'blogs');
  const posts = fs.readdirSync(blogDir).filter((f) => f.endsWith('.html') && f !== 'index.html').map((f) => {
    const h = fs.readFileSync(path.join(blogDir, f), 'utf8');
    const t = (/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(h) || [])[1] || f;
    return [f.replace(/\.html$/, ''), t.replace(/<[^>]+>/g, '').trim()];
  });
  const body = `
<h2 id="main-pages">Main pages</h2>
<ul><li><a href="/">Home: the AIM program, fee and how to apply</a></li><li><a href="/about">About AIM</a></li><li><a href="/blogs">Blog</a></li><li><a href="/terms">Terms and refund policy</a></li><li><a href="/all-pages">All pages</a></li><li><a href="/privacy-policy">Privacy policy</a></li></ul>
<h2 id="courses">Courses</h2>
<ul><li><a href="/digital-marketing-course">Digital marketing course in India</a></li><li><a href="/ai-digital-marketing-course">AI digital marketing course</a></li><li><a href="/vibe-marketing-course">Vibe marketing course</a></li><li><a href="/digital-marketing-course-online">Online digital marketing course</a></li><li><a href="/digital-marketing-course-with-internship">Digital marketing course with internship</a></li><li><a href="/digital-marketing-course-syllabus">Digital marketing course syllabus</a></li><li><a href="/digital-marketing-course-after-12th">Digital marketing course after 12th</a></li></ul>
<h2 id="cities">Digital marketing course by city</h2>
<ul>${CITIES.map((c) => `<li><a href="/digital-marketing-course/${c.slug}">Digital marketing course in ${esc(c.name)}</a></li>`).join('')}</ul>
<h2 id="blog-posts">Blog posts</h2>
<ul>${posts.map(([s, t]) => `<li><a href="/blogs/${s}">${t}</a></li>`).join('')}</ul>
<h2 id="authors">Authors</h2>
<ul><li><a href="/author/kailasnathr">Kailas Nath R</a></li><li><a href="/author/kautilyaroshan">Kautilya Roshan</a></li></ul>`;
  write('all-pages.html', page({
    path: '/all-pages', title: 'All Pages: AIM Site Map | AI in Marketing', desc: 'Every page on aiinmarketing.in in one list: course pages, city pages, blog posts, authors and policies.',
    kicker: 'Site map', h1: 'All pages on AIM', lead: 'Every public page on aiinmarketing.in, grouped by type.',
    crumbs: [['Home', '/'], ['All pages', null]], body,
    breadcrumb: crumbLd([['Home', '/'], ['All pages', '/all-pages']]),
  }));
  out.pop();
}
console.log('wrote', out.length, 'pages');
fs.writeFileSync(path.join(ROOT, 'tools', 'seo-pages.json'), JSON.stringify(out, null, 1) + '\n');
