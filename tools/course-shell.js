'use strict';
// Restructures the article of a generated course/city page into a conversion-first layout:
// hero with fee card, one <section class="cv-sec"> per H2, FAQ as accordion, closing CTA.
// Text content is not changed; only wrappers and classes are added.
function upgrade(html) {
  const m = html.match(/<article class="aimb-article aimb-fw">([\s\S]*?)<\/article>/);
  if (!m) return html;
  let inner = m[1];
  const kicker = (inner.match(/<p class="aimb-kicker">([\s\S]*?)<\/p>/) || [])[1] || '';
  const h1 = (inner.match(/<h1>([\s\S]*?)<\/h1>/) || [])[1] || '';
  const crumbs = (inner.match(/<nav class="aimb-small" aria-label="Breadcrumb">[\s\S]*?<\/nav>/) || [''])[0];
  const lead = (inner.match(/<p class="aimb-lead">([\s\S]*?)<\/p>/) || [])[1] || '';
  const cta = (inner.match(/<aside class="aimb-cta">[\s\S]*?<\/aside>/) || [''])[0];
  let rest = inner.slice(inner.indexOf('</p>', inner.indexOf('class="aimb-lead"')) + 4);
  if (cta) rest = rest.replace(cta, '');
  const parts = rest.split(/(?=<h2 )/).filter((x) => x.trim());
  const secs = parts.map((p, i) => {
    const id = (p.match(/^<h2 id="([^"]+)"/) || [])[1] || 'part-' + i;
    let body = p;
    if (id === 'faq') {
      let k = 0;
      body = body.replace(/<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g, (_, q, a) => `<details class="cv-q"${k++ === 0 ? ' open' : ''}><summary>${q}</summary><p>${a}</p></details>`);
      body = body.replace(/(<h2 id="faq">[\s\S]*?<\/h2>)/, '$1<div class="cv-faq">') + '</div>';
    }
    return `<section class="cv-sec cv-s-${id.replace(/^(learn-from|work-in)-.*/, '$1')}" id="sec-${id}"><div class="cv-in">${body}</div></section>`;
  });
  const hero = `<header class="cv-hero"><div class="cv-hero-in"><div class="cv-hero-copy"><p class="aimb-kicker">${kicker}</p><h1>${h1}</h1><p class="aimb-lead">${lead}</p><div class="cv-actions"><a class="cv-btn" href="/#bonus">See the fee and apply</a><a class="cv-link" href="#sec-plan">See the 12-week plan</a></div><ul class="cv-facts"><li><b>12 weeks</b><span>live online, Monday to Friday</span></li><li><b>1 month</b><span>inside a partner agency</span></li><li><b>9 modules</b><span>AI in every one</span></li></ul></div><aside class="cv-fee" aria-label="Fee"><span class="cv-fee-tag">The fee</span><div class="cv-fee-row"><div><b>&#8377;5,999</b><span>Without tool access</span></div><div><b>&#8377;9,999</b><span>With tool access</span></div></div><p>Same training and agency internship in both plans. 7-day money-back guarantee.</p><a class="cv-btn" href="/#bonus">See the fee and apply</a></aside></div></header>`;
  const cta2 = cta.replace('<aside class="aimb-cta">', '<aside class="aimb-cta cv-cta">').replace('class="aimb-btn"', 'class="aimb-btn cv-btn"');
  const out = `<article class="aimb-article aimb-fw cv-page">${crumbs.replace('aimb-small', 'aimb-small cv-crumbs')}${hero}${secs.join('\n')}${cta2}</article>`;
  return html.replace(m[0], out);
}
module.exports = { upgrade };
