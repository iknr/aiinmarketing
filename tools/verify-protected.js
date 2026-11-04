#!/usr/bin/env node
/* Guard for parallel sessions: run before EVERY push (content, design, anything). Exit 1 means a protected
 * security / lead-capture / attribution change is missing, i.e. someone's merge or rebase dropped it.
 * Usage: node tools/verify-protected.js   (also runs tools/test-lead.js) */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const problems = [];
const need = (file, markers) => {
  let text = '';
  try { text = read(file); } catch (e) { problems.push(`${file}: file missing`); return; }
  for (const m of markers) if (!text.includes(m)) problems.push(`${file}: missing "${m}"`);
};

need('api/lead.js', ['same_ip_multiple', 'IP_IDENTITY_MAX', 'buildAttribution', 'abuseTitle', 'request_rejected', 'invalid_input', 'unqualified_stage_missing', 'bad_origin', 'rate_limit', 'repeat_within_60s', 'bot_user_agent', 'clientIp']);
need('wp-content/plugins/elementor/assets/js/aim-track.js', ['aim_attr_first', 'aim_attr_last', 'attribution_set', "addEventListener('submit'", 'form_fields[']);
need('scripts/inject-gtm.js', ['TRACK_VER', 'GTM-NPKP66BD']);
need('privacy-policy.html', ['which campaign or link brought you', 'GTM-NPKP66BD']);
need('CLAUDE.md', ['NO DATA IS LOST', 'same_ip_multiple', 'Parallel sessions']);
need('tools/test-lead.js', ['same_ip_multiple']);

// every html page: GTM exactly once, aim-track.js at the current version
const ver = (/TRACK_VER = '([^']+)'/.exec(read('scripts/inject-gtm.js')) || [])[1];
const walk = (d, out) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (['node_modules', '.git', '.vercel'].includes(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out); else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
};
for (const f of walk(ROOT, [])) {
  const h = fs.readFileSync(f, 'utf8');
  const rel = path.relative(ROOT, f);
  const gtm = h.split('googletagmanager.com/gtm.js?id=GTM-NPKP66BD').length - 1;
  if (gtm !== 1) problems.push(`${rel}: GTM loader appears ${gtm} times (must be 1) - run node scripts/inject-gtm.js`);
  if (!h.includes(`aim-track.js?ver=${ver}`)) problems.push(`${rel}: aim-track.js not at ?ver=${ver} - run node scripts/inject-gtm.js`);
}

const t = spawnSync('node', [path.join(ROOT, 'tools', 'test-lead.js')], { encoding: 'utf8' });
if (t.status !== 0) problems.push('tools/test-lead.js failed:\n' + (t.stdout || '').split('\n').filter((l) => /FAIL|passed/.test(l)).join('\n'));

if (problems.length) {
  console.error('PROTECTED CHANGES BROKEN:\n - ' + problems.join('\n - '));
  console.error('\nRestore them from git history (git log -- api/lead.js) and re-apply your own change on top. Do not force-push.');
  process.exit(1);
}
console.log('protected changes intact (lead capture, abuse/IP rules, attribution, GTM, privacy sentence); tests pass');
