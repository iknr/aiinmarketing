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
const DATE = '2026-11-14';
const OG = SITE + '/wp-content/uploads/2026/11/best-digital-marketing-courses-india-2026-how-to-choose-banner.png';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rs = (s) => s.replace(/₹/g, '&#8377;').replace(/’/g, '&rsquo;');
const GTM = fs.readFileSync(path.join(ROOT, 'about.html'), 'utf8').split('<meta charset')[0].replace(/^<!DOCTYPE html>\s*<html[^>]*>\s*<head>\s*/i, '');

const FEE_TABLE = `<div class="aimb-tablewrap"><table class="aimb-table"><thead><tr><th>Type of program</th><th>Length</th><th>Listed fee</th></tr></thead><tbody>
<tr><td>Placement-led bootcamps</td><td>4 to 7 months</td><td>&#8377;1.05 lakh to &#8377;1.64 lakh</td></tr>
<tr><td>Institute certification courses</td><td>3 to 6 months</td><td>&#8377;48,000 to &#8377;75,000</td></tr>
<tr><td>Short bootcamps</td><td>3 months</td><td>&#8377;25,000</td></tr>
<tr class="aimb-hot"><td><strong>AIM by Adsmentor</strong></td><td>3 months, agency internship included</td><td><strong>&#8377;5,999</strong>, or <strong>&#8377;9,999</strong> with tool access</td></tr>
</tbody></table></div>
<p class="aimb-small">Ranges come from public fee listings for 10 programs, checked October 2026. Fees change, so check each provider before you decide. The two AIM plans differ only in tool access (Claude, Semrush, Gemini Pro, Google AI Pro, Ahrefs, SpyFu, Ubersuggest and Canva).</p>`;

const PLAN = `<ul>
<li><strong>Weeks 1 to 4, core skills with AI in every module:</strong> websites with WordPress and WordPress MCP, SEO and AI search, social media and automations, ads on five platforms, media planning.</li>
<li><strong>Weeks 5 to 8, four specialisations, all included:</strong> AI Generalist, Marktech, Branding and Content, Performance and Growth.</li>
<li><strong>Weeks 9 to 12, a 1-month agency internship</strong> on real client tasks, with a certificate issued by the agency.</li>
<li><strong>Also included:</strong> a live portfolio site on your own domain and hosting, a CV rewrite and 3 mock interviews.</li>
</ul>`;

const NAV = '<nav class="aimb-links"><a href="/">Home</a><a href="/digital-marketing-course">Courses</a><a href="/about">About</a><a href="/blogs">Blogs</a><a class="aimb-apply" href="/#bonus">See the fee</a></nav>';

const THEMES = ['sunrise', 'forest', 'plum', 'ember', 'ocean', 'rose', 'slate'];
const LAYOUTS = ['left', 'center', 'card'];
const PLACED_PEOPLE = [
  ['Ankita Kumari', 'Subject Matter Expert at Lokal', '&#8377;15 LPA', 'https://www.linkedin.com/in/ankita-kumari-b17128168/', '/wp-content/uploads/2026/11/adsmentor/face_ankita.webp'],
  ['Vasavi R V', 'Asst. Manager, Marketing at KloudMate', '&#8377;12 LPA', 'https://www.linkedin.com/in/vasavi-rv-0b2582231/', ''],
  ['Praneet K', 'Digital Production Specialist at Loblaw Digital', '&#8377;15 LPA', 'https://www.linkedin.com/in/praneet-k-b6043b126/', '/wp-content/uploads/2026/11/adsmentor/face_praneet.webp'],
  ['Vivek Jain', 'Creative Head', '34% salary hike', 'https://www.linkedin.com/in/vivek-jain-7472842b7/', ''],
  ['Tamanna Jain', 'Social Media Manager at Amulya Kala', '30% salary hike', 'https://www.linkedin.com/in/tamanna-jain-dm/', ''],
];
const PLACED = `<h2 id="placements">Where our students landed: placed at &#8377;5 to &#8377;15 LPA</h2>
<p>Recent placements and salary growth of students from the Adsmentor program behind AIM. Every profile is public, so you can verify each one yourself. No course can promise you a job, and we do not.</p>
<div class="aimb-placed">${PLACED_PEOPLE.map(([n, r, pk, u, img]) => `<a class="aimb-pcard" href="${u}" target="_blank" rel="noopener"><span class="aimb-pav">${img ? `<img src="${img}" width="200" height="200" alt="${n}" loading="lazy" decoding="async">` : n.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span><b>${n}</b><span>${r}</span><strong>${pk}</strong><em>View profile on LinkedIn</em></a>`).join('')}</div>`;
const PLACED_CSS = `<style>.aimb-placed{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;margin:14px 0 22px}.aimb-pcard{display:flex;flex-direction:column;gap:4px;padding:16px;border:1px solid #dbe3f5;border-radius:14px;background:#fff;text-decoration:none;color:inherit}.aimb-pcard b{font-size:16px}.aimb-pcard span{font-size:14px;color:#44506b}.aimb-pcard strong{margin-top:6px;font-size:18px;color:#0256ec}.aimb-pcard em{font-style:normal;font-size:13px;color:#0256ec}.aimb-pav{width:48px;height:48px;border-radius:50%;background:#e8efff;color:#0256ec;display:flex;align-items:center;justify-content:center;font-weight:800;overflow:hidden;margin-bottom:6px}.aimb-pav img{width:100%;height:100%;object-fit:cover}</style>`;

function page(o) {
  const url = SITE + o.path;
  const ld = [o.course, o.breadcrumb, o.faq && faqLd(o.faq)].filter(Boolean).map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n');
  return `<!DOCTYPE html>
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
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230b4fd6'/%3E%3Ctext x='32' y='42' text-anchor='middle' font-family='Arial' font-weight='800' font-size='26' fill='%23ffd43b'%3EAIM%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&amp;display=swap">
<link rel="stylesheet" id="hello-elementor-css" href="/wp-content/themes/hello-elementor/style.css?ver=3.1.1">
<link rel="stylesheet" id="aim-blog-css" href="/wp-content/uploads/elementor/css/aim-blog.css?ver=2.4.0"><link rel="stylesheet" id="aim-programs-css" href="/wp-content/uploads/elementor/css/aim-programs.css?ver=1.1.0" media="all">
<link rel="stylesheet" id="aim-themes-css" href="/wp-content/uploads/elementor/css/aim-themes.css?ver=1.0.0">
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
${rs(o.body)}
${PLACED}
<aside class="aimb-cta"><h2>See the fee and apply</h2><p>AI in every module, hands-on inside the platforms, and a 1-month agency internship. &#8377;5,999 without tool access, or &#8377;9,999 with tool access. Same training and agency internship in both. 7-day money-back guarantee.</p><a class="aimb-btn" href="/#bonus">See the fee</a></aside>
</article></main>
<footer class="aimb-footer"><div class="aimb-foot">
<span class="aimb-mark">AIM</span> <span>AI in Marketing by <a href="https://adsmentor.in" target="_blank" rel="noopener">Adsmentor</a> &middot; &copy; 2026</span>
<a href="/">Home</a><a href="/digital-marketing-course">Courses</a><a href="/about">About</a><a href="/blogs">Blogs</a><a href="/all-pages">All pages</a><a href="/privacy-policy">Privacy policy</a><a href="mailto:contact@adsmentor.in">contact@adsmentor.in</a>
</div></footer>
<script id="aim-magnet-js" src="/wp-content/plugins/elementor/assets/js/aim-magnet.js?ver=1.0.0" defer></script><script id="aim-track-js" src="/wp-content/plugins/elementor/assets/js/aim-track.js?ver=1.1.0" defer></script>
</body>
</html>
`;
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
      { '@type': 'Offer', name: 'AIM program, without tool access', price: '5999', priceCurrency: 'INR', category: 'Paid', url: SITE + '/#bonus' },
      { '@type': 'Offer', name: 'AIM program, with tool access', price: '9999', priceCurrency: 'INR', category: 'Paid', url: SITE + '/#bonus' },
    ],
    hasCourseInstance: { '@type': 'CourseInstance', courseMode: 'online', courseWorkload: 'PT2H per weekday' },
  };
  if (o.city) c.areaServed = { '@type': 'City', name: o.city };
  else c.areaServed = { '@type': 'Country', name: 'India' };
  return c;
}
const COMMON_FAQ = [
  ['How much does the course cost?', 'It costs ₹5,999 without tool access, or ₹9,999 with tool access. The training, all four specialisations and the 1-month agency internship are the same in both. The ₹9,999 plan adds access to Claude, Semrush, Gemini Pro, Google AI Pro, Ahrefs, SpyFu, Ubersuggest and Canva. There is no paid ad budget and no other add-on.'],
  ['Do I need marketing experience to join?', 'No. The program starts from building a website and goes step by step to AI-run workflows, so beginners can join.'],
  ['Is there a refund if it is not right for me?', 'Yes. There is a 7-day money-back guarantee. Tell us within 7 days of your first live class and the program fee is refunded. You pay only after an onboarding call, once your questions are answered.'],
  ['Do you guarantee a job?', 'No. We do not promise a job. You get real work, an agency internship and interview preparation. Recent students have been placed at ₹5 to 15 LPA, with public profiles you can check.'],
];

const out = [];
function write(rel, html) { out.push(rel); const f = path.join(ROOT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); }

// ---------- city pages ----------
const bySlug = Object.fromEntries(CITIES.map((c) => [c.slug, c]));
for (const c of CITIES) {
  const p = `/digital-marketing-course/${c.slug}`;
  const title = `Digital Marketing Course in ${c.name} (Live Online, AI) | AIM`;
  const desc = `Live online AI digital marketing course for learners in ${c.name}. 12 weeks, 1-month agency internship, Rs 5,999 or Rs 9,999 with tool access. Evening batches.`;
  const faq = [
    [`Is there a physical centre in ${c.name}?`, `No. AIM is a live online program, so there is no classroom in ${c.name} to travel to. You join the live classes from home and get the same training and internship as every other learner.`],
    c.faq,
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
<p class="aimb-small">This is general context about ${kerala ? 'the place' : 'the city'}&rsquo;s economy, not a salary or hiring statistic. For salary expectations, check current listings for the roles you want.</p>`,
    projects: `<h2 id="projects">${projH}</h2>
<p>Each module ends with a project that goes into your live portfolio. ${['In', 'You could shape yours around businesses in', 'Examples from'][v]} ${N}${['you could shape yours around local businesses, for example:', ', for example:', ':'][v]}</p>
<ul>
${c.projects.map((x) => `<li>${esc(x)}</li>`).join('\n')}
</ul>
<p>For the SEO module, one useful exercise is ${esc(c.seo)}. The same method works for any city, and you keep the result as portfolio proof.</p>`,
    plan: `<h2 id="plan">${planH}</h2>
${PLAN}
<p>Pick a path that suits you: <strong>freelancer</strong> (land your first clients), <strong>agency</strong> (join an agency team or run your own) or <strong>job</strong> (interview-ready for in-house roles). All three use the same nine modules and the same two fees.</p>`,
    fee: `<h2 id="fee">${feeH}</h2>
<p>Course fees vary widely, and a place name on a listing does not change what you learn. Here is what live programs in India list, so you can compare before you pay anyone.</p>
${FEE_TABLE}`,
    faq: faqHtml(faq),
    more: `<h2 id="more">More digital marketing course pages</h2>
<ul>
<li><a href="/digital-marketing-course">Digital marketing course in India: the full program</a></li>
<li><a href="/ai-digital-marketing-course">AI digital marketing course</a> and <a href="/vibe-marketing-course">vibe marketing course</a></li>
${near.map((n) => `<li><a href="/digital-marketing-course/${n.slug}">${n.hub ? 'Digital marketing course in Kerala: all cities' : 'Digital marketing course in ' + esc(n.name)}</a></li>`).join('\n')}
<li><a href="/blogs/best-digital-marketing-courses-india-2026-how-to-choose">How to choose the best digital marketing course in India</a></li>
<li><a href="/blogs/digital-marketing-course-fees-india-2026">Digital marketing course fees in India</a></li>
</ul>`,
  };
  const orders = [['learn', 'work', 'projects', 'plan', 'fee', 'faq', 'more'], ['work', 'learn', 'plan', 'projects', 'faq', 'fee', 'more'], ['projects', 'work', 'learn', 'fee', 'plan', 'faq', 'more']];
  const keralaBlock = c.hub ? `<h2 id="kerala-cities">Digital marketing course by city in Kerala</h2>
<p>One live online program serves every Kerala city. Pick the page closest to where you live to see projects and context for your area.</p>
<ul>
${CITIES.filter((x) => x.region === 'kerala').map((x) => `<li><a href="/digital-marketing-course/${x.slug}">Digital marketing course in ${esc(x.name)}</a></li>`).join('\n')}
</ul>` : (c.region === 'kerala' ? `<p class="aimb-small">Also in Kerala: <a href="/digital-marketing-course/kerala">digital marketing course in Kerala, all cities</a>.</p>` : '');
  const body = '\n' + orders[v].map((k) => sec[k] + (k === 'work' ? '\n' + keralaBlock : '')).join('\n\n');
  write(`digital-marketing-course/${c.slug}.html`, page({
    path: p, title, desc, kicker: 'Live online, for learners in ' + c.name,
    h1: `Digital marketing course in ${c.name}: live online, AI built into every module`,
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
  const desc = 'Live online digital marketing course in India with AI in every module, 4 specialisations and a 1-month agency internship. Rs 5,999, or Rs 9,999 with tool access.';
  const faq = COMMON_FAQ.concat([['Can I join from any city?', 'Yes. Classes are live online from 9 to 11 pm IST on weekdays, so learners in any city in India can join. See the city pages below for local context.']]);
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
<h2 id="fee">Fee and how it compares</h2>
<p>There are two plans. &#8377;5,999 without tool access, or &#8377;9,999 with tool access. The training, the four specialisations and the agency internship are the same in both.</p>
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
    lead: 'Learn digital marketing the way companies now do it, with AI in all nine modules, then spend a month inside an agency. From ₹5,999.',
    crumbs: [['Home', '/'], ['Digital marketing course', null]], body, faq,
    course: courseLd({ name: 'AI Digital Marketing Course in India (AIM)', desc, path: p }),
    breadcrumb: crumbLd([['Home', '/'], ['Digital marketing course', p]]),
  }));
}

// ---------- AI digital marketing course ----------
{
  const p = '/ai-digital-marketing-course';
  const title = 'AI Digital Marketing Course (Live Online, From Rs 5,999) | AIM';
  const desc = 'An AI digital marketing course where AI runs through all 9 modules: Claude, WordPress MCP, ads MCPs, chatbots. 1-month agency internship. Rs 5,999 or Rs 9,999.';
  const faq = [
    ['What makes this an AI digital marketing course and not a normal one?', 'AI is part of all nine modules and all four specialisations, not one chapter. You work with Claude, Claude Code and the command line, WordPress MCP, MCPs for ads, CRO automations and chatbots, on real-style briefs.'],
    ['Which AI tools do I get access to?', 'The ₹9,999 plan includes tool access: Claude, Semrush, Gemini Pro, Google AI Pro, Ahrefs, SpyFu, Ubersuggest and Canva. The ₹5,999 plan has no tool access, and the training is the same. Many tools in the course also have free plans or trials.'],
    ['Will AI replace marketers?', 'AI now does most routine marketing tasks, so the routine part of the job is shrinking. People who know how to direct AI, check its output and own the result are the ones companies keep. That is what the course trains.'],
  ].concat(COMMON_FAQ.slice(1, 3));
  const body = `
<h2 id="ai-in-every-module">AI in every module, not one chapter</h2>
<p>Many courses add one AI chapter near the end. Here AI runs through all nine modules, so you never learn a habit you will have to unlearn. In week 1 you are already working inside the tools.</p>
<ul>
<li><strong>WordPress MCP:</strong> connect Claude to a live WordPress site and direct it to build pages and fix issues. You stay the editor.</li>
<li><strong>Claude and Claude Code:</strong> audits, reports and content batches in the command line that used to take whole days.</li>
<li><strong>MCPs for ads:</strong> ask your ad accounts what is wasting spend, and review the fixes before anything goes live.</li>
<li><strong>CRO automations:</strong> find where visitors drop off and keep tests running.</li>
<li><strong>Chatbots:</strong> website and WhatsApp bots that answer, qualify and book leads.</li>
<li><strong>Agents:</strong> research competitors and draft reports for your review.</li>
</ul>
<h2 id="what-you-build">What you build</h2>
<p>Each module ends with a project in your portfolio: a live website, an SEO audit and roadmap, a 30-day content calendar with one working automation, campaign setups on five platforms, a media plan, your own AI marketing assistant, a lead-to-CRM workflow with a chatbot, a brand kit, and an ad-account audit with a CRO test plan.</p>
<h2 id="plan">The 12-week path</h2>
${PLAN}
<h2 id="fee">Fee</h2>
<p>&#8377;5,999 without tool access, or &#8377;9,999 with tool access. The tiers differ only in tool access.</p>
${FEE_TABLE}
${faqHtml(faq)}
<h2 id="more">More</h2>
<ul>
<li><a href="/digital-marketing-course">Digital marketing course in India: the full program</a></li>
<li><a href="/vibe-marketing-course">Vibe marketing course</a></li>
<li><a href="/blogs/agentic-ai-marketing-work-competitors-hand-to-agents">The marketing work competitors are handing to AI agents</a></li>
<li><a href="/blogs/ai-in-marketing-course-what-to-look-for">Seven questions to ask before paying for an AI marketing course</a></li>
</ul>`;
  write('ai-digital-marketing-course.html', page({ theme: 'ocean', layout: 'left',
    path: p, title, desc, kicker: 'AI digital marketing course', h1: 'AI digital marketing course: AI inside every module',
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
<h2 id="plan">The 12-week path</h2>
${PLAN}
<h2 id="fee">Fee</h2>
<p>&#8377;5,999 without tool access, or &#8377;9,999 with tool access (Claude, Semrush, Gemini Pro, Google AI Pro, Ahrefs, SpyFu, Ubersuggest and Canva). The training is the same in both.</p>
${faqHtml(faq)}
<h2 id="more">More</h2>
<ul>
<li><a href="/digital-marketing-course">Digital marketing course in India: the full program</a></li>
<li><a href="/ai-digital-marketing-course">AI digital marketing course</a></li>
<li><a href="/blogs/what-is-vibe-marketing">What vibe marketing is</a></li>
<li><a href="/blogs/vibe-marketing-course-india-what-you-learn">What a vibe marketing course should teach</a></li>
</ul>`;
  write('vibe-marketing-course.html', page({ theme: 'plum', layout: 'card',
    path: p, title, desc, kicker: 'Vibe marketing course', h1: 'Vibe marketing course: direct AI to do the work, then own the result',
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
    ['Can I do it while working or studying?', 'Yes. The evening schedule was set so learners can join alongside a job or college.'],
    ['What do I need to take part?', 'A laptop and a stable internet connection. The portfolio website, domain and hosting are included, and the ₹9,999 plan adds tool access.'],
  ].concat(COMMON_FAQ.slice(2, 4));
  const body = `
<h2 id="how-it-works">How the online course works</h2>
<p>Classes run live, Monday to Friday, 9 to 11 pm IST. You work inside the platforms yourself, not on a trainer&rsquo;s screen. Each week has one assignment that goes into your portfolio, and weekends are for one-on-one doubt clearing, project reviews and interview prep.</p>
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
    lead: 'Learn from home, live, in the evening, and finish with an agency internship. From ₹5,999.',
    crumbs: [['Home', '/'], ['Digital marketing course', '/digital-marketing-course'], ['Online course', null]], body, faq,
    course: courseLd({ name: 'Online Digital Marketing Course (AIM)', desc, path: p }),
    breadcrumb: crumbLd([['Home', '/'], ['Digital marketing course', '/digital-marketing-course'], ['Online course', p]]),
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
<h2>Main pages</h2>
<ul><li><a href="/">Home: the AIM program, fee and how to apply</a></li><li><a href="/about">About AIM</a></li><li><a href="/blogs">Blog</a></li><li><a href="/terms">Terms and refund policy</a></li><li><a href="/all-pages">All pages</a><a href="/privacy-policy">Privacy policy</a></li></ul>
<h2>Courses</h2>
<ul><li><a href="/digital-marketing-course">Digital marketing course in India</a></li><li><a href="/ai-digital-marketing-course">AI digital marketing course</a></li><li><a href="/vibe-marketing-course">Vibe marketing course</a></li><li><a href="/digital-marketing-course-online">Online digital marketing course</a></li></ul>
<h2>Digital marketing course by city</h2>
<ul>${CITIES.map((c) => `<li><a href="/digital-marketing-course/${c.slug}">Digital marketing course in ${esc(c.name)}</a></li>`).join('')}</ul>
<h2>Blog posts</h2>
<ul>${posts.map(([s, t]) => `<li><a href="/blogs/${s}">${t}</a></li>`).join('')}</ul>
<h2>Authors</h2>
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
