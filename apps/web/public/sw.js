// Shows the maintenance page instead of a 502 or a browser error when the server cannot be
// reached. It only ever answers page loads, and only when they fail: the app itself and the API
// are never cached here.
const CACHE = 'outage-v1';
const PAGE = new URL('outage.html', self.registration.scope).href;
const DOWN = [502, 503, 504];
// A switched-off server can leave the browser waiting for over a minute.
const WAIT_MS = 20000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new Request(PAGE, { cache: 'reload' })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

async function outagePage() {
  const cached = await caches.match(PAGE);
  if (!cached) return Response.error();
  // Its own headers only: the app's security policy would stop the page's inline script.
  return new Response(await cached.text(), {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/** A new version of the page does not change this file, so it is fetched again while all is well. */
function keepPageFresh() {
  caches
    .open(CACHE)
    .then((cache) => cache.add(PAGE))
    .catch(() => {});
}

async function loadPage(request) {
  const timedOut = new Promise((_resolve, reject) => {
    setTimeout(() => reject(new Error('timeout')), WAIT_MS);
  });
  try {
    const response = await Promise.race([fetch(request), timedOut]);
    if (DOWN.includes(response.status)) return await outagePage();
    keepPageFresh();
    return response;
  } catch {
    return outagePage();
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') event.respondWith(loadPage(event.request));
});
