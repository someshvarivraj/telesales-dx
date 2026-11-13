// Builds public/outage.html: one self-contained file with the artwork inside it, because nginx
// and the service worker show it when nothing else on the server can be reached.
// Run after changing outage/outage.template.html: node scripts/build-outage-page.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const web = new URL('../', import.meta.url);
const pose = (name) =>
  `data:image/webp;base64,${readFileSync(new URL(`public/morabot/${name}.webp`, web)).toString('base64')}`;

// The falling leaves (11/12), shared with the app's overlay and sign-in screen.
const leaves = readFileSync(new URL('outage/leaves.js', web), 'utf8').replaceAll(
  'export function',
  'function',
);

const bounce = readFileSync(new URL('outage/bounce.js', web), 'utf8').replaceAll(
  'export function',
  'function',
);

const page = readFileSync(new URL('outage/outage.template.html', web), 'utf8')
  .replace('/* {{LEAVES_JS}} */', () => leaves)
  .replace('{{BOUNCE}}', () => bounce)
  .replace('{{POSES}}', JSON.stringify(['guide', 'call', 'schedule', 'report'].map(pose)))
  .replace('{{HAPPY}}', JSON.stringify(pose('done')));
writeFileSync(new URL('public/outage.html', web), page);
