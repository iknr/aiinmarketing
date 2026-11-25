/* UTM link builder that enforces the naming rules in CLAUDE.md (lowercase, words joined with "-").
 * Usage: node tools/utm-link.js <url> <source> <medium> <campaign> [content] [term]
 * Example: node tools/utm-link.js https://aiinmarketing.in/vibe-marketing-course linkedin social vibe-marketing-nov26 carousel-1
 * Prints the tagged link. Exits 1 with a message when a value breaks the rules. Makes no network calls. */
const [url, source, medium, campaign, content, term] = process.argv.slice(2);
const SOURCES = ['linkedin', 'x', 'whatsapp', 'email', 'youtube', 'github', 'udemy', 'bio', 'instagram', 'facebook', 'google', 'bing', 'newsletter', 'wordpress'];
const MEDIUMS = ['social', 'email', 'bio', 'referral', 'paid-social', 'cpc', 'qr', 'pdf'];
const bad = (m) => { process.stderr.write(m + '\n'); process.exit(1); };
if (!url || !source || !medium || !campaign) bad('Usage: node tools/utm-link.js <url> <source> <medium> <campaign> [content] [term]');
let u;
try { u = new URL(url); } catch (e) { bad('Not a valid URL: ' + url); }
if (!/^https:\/\/(www\.)?aiinmarketing\.in$/.test(u.origin)) process.stderr.write('note: this link is not on aiinmarketing.in\n');
for (const [k, v] of [['source', source], ['medium', medium], ['campaign', campaign], ['content', content], ['term', term]]) {
  if (v && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v)) bad(`utm_${k} "${v}" must be lowercase letters and digits, words joined with "-".`);
}
if (!SOURCES.includes(source)) process.stderr.write(`note: source "${source}" is new. Known: ${SOURCES.join(', ')}. Add it to this list and to CLAUDE.md if it is meant to stay.\n`);
if (!MEDIUMS.includes(medium)) process.stderr.write(`note: medium "${medium}" is new. Known: ${MEDIUMS.join(', ')}.\n`);
for (const [k, v] of [['utm_source', source], ['utm_medium', medium], ['utm_campaign', campaign], ['utm_content', content], ['utm_term', term]]) if (v) u.searchParams.set(k, v);
process.stdout.write(u.toString() + '\n');
