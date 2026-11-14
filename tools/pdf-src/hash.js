/* Shared by tools/build-pdfs.js and scripts/guard.js. sha256 of a PDF source (.htm) plus every local file it
 * references (src="..."), so a change to the text OR an image without a rebuild of the PDF is detected. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const SRC_DIR = __dirname;
function sourceFiles(name) {
  const htm = path.join(SRC_DIR, name + '.htm');
  const html = fs.readFileSync(htm, 'utf8');
  const refs = new Set();
  for (const m of html.matchAll(/(?:src|href)="([^"#?:]+\.(?:png|svg|webp|jpg|jpeg))"/g)) refs.add(path.resolve(SRC_DIR, m[1]));
  return [htm, ...[...refs].filter((f) => fs.existsSync(f)).sort()];
}
function sourceHash(name) {
  const h = crypto.createHash('sha256');
  for (const f of sourceFiles(name)) { h.update(path.relative(SRC_DIR, f).split(path.sep).join('/')); h.update(fs.readFileSync(f)); }
  return h.digest('hex');
}
const fileHash = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
module.exports = { SRC_DIR, sourceFiles, sourceHash, fileHash };
