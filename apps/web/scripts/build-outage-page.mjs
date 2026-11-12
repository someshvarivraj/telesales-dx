// Builds public/outage.html: one self-contained file with the artwork inside it, because nginx
// and the service worker show it when nothing else on the server can be reached.
// Run after changing outage/outage.template.html: node scripts/build-outage-page.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const web = new URL('../', import.meta.url);
// Sakura edition (11/12): MoraBot's sakura look.
const pose = (name) =>
  `data:image/webp;base64,${readFileSync(new URL(`public/morabot/girl/${name}.webp`, web)).toString('base64')}`;

// sakura-js (npm, MIT): a plain browser script and its stylesheet, inlined like the art.
const sakura = (file) => readFileSync(new URL(`node_modules/sakura-js/dist/${file}`, web), 'utf8');

const bounce = readFileSync(new URL('outage/bounce.js', web), 'utf8').replace(
  'export function',
  'function',
);

const page = readFileSync(new URL('outage/outage.template.html', web), 'utf8')
  .replace('{{SAKURA_CSS}}', () => sakura('sakura.min.css'))
  .replace('/* {{SAKURA_JS}} */', () => sakura('sakura.min.js'))
  .replace('{{BOUNCE}}', () => bounce)
  .replace('{{POSES}}', JSON.stringify(['guide', 'call', 'schedule', 'report'].map(pose)))
  .replace('{{HAPPY}}', JSON.stringify(pose('done')));
writeFileSync(new URL('public/outage.html', web), page);
