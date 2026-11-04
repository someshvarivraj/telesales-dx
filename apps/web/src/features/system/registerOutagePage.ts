/**
 * Lets the browser show the maintenance page by itself when the server is gone (request 11/4).
 * It needs one visit while the server is up, and HTTPS (or localhost).
 */
export function registerOutagePage(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const base = import.meta.env.BASE_URL;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {
      // The app works the same without it.
    });
  });
}
