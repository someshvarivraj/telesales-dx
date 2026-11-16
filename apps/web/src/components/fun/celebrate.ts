/**
 * A short celebration (11/16): red maple leaves burst from the button that was just pressed,
 * with a 祝 stamp and a line, then everything fades — about 1.4 seconds, never in the way.
 * Lives on <body>, so it keeps playing while the page moves on. Nothing moves for people who
 * prefer reduced motion: they see only the line, briefly.
 */
const LEAF_COLORS = ['#e5391f', '#f2602a', '#ff8a3a', '#c4291a', '#ffb02e'];
/** Half a maple leaf (x, y), mirrored for the other half; unit size, pointing up. */
const HALF = [
  [0, -1],
  [0.1, -0.8],
  [0.19, -0.64],
  [0.2, -0.36],
  [0.46, -0.62],
  [0.96, -0.5],
  [0.78, -0.31],
  [0.63, -0.1],
  [0.48, 0.02],
  [0.82, 0.42],
  [0.51, 0.45],
  [0.31, 0.32],
  [0.05, 0.42],
];
const MAPLE = `M${[
  ...HALF,
  ...HALF.slice(1)
    .reverse()
    .map(([x = 0, y = 0]) => [-x, y]),
]
  .map(([x = 0, y = 0]) => `${(x * 10).toFixed(1)},${(y * 10).toFixed(1)}`)
  .join('L')}Z`;

export function celebrate(line = 'アポを登録しました！') {
  if (typeof document === 'undefined') return;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const active = document.activeElement;
  const rect =
    active instanceof HTMLElement && active !== document.body
      ? active.getBoundingClientRect()
      : null;
  const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;

  const layer = document.createElement('div');
  layer.className = 'celebrate';
  layer.setAttribute('aria-hidden', 'true');
  layer.style.setProperty('--x', `${x}px`);
  layer.style.setProperty('--y', `${y}px`);
  // The line stays on screen even when the button is near an edge.
  layer.style.setProperty('--lx', `${Math.min(window.innerWidth - 130, Math.max(130, x))}px`);
  if (!reduced) {
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 70 + Math.random() * 90;
      const leaf = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      leaf.setAttribute('viewBox', '-11 -11 22 22');
      leaf.setAttribute('class', 'celebrate-leaf');
      leaf.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
      leaf.style.setProperty('--dy', `${Math.sin(angle) * dist * 0.8 - 30}px`);
      leaf.style.setProperty('--rot', `${(Math.random() - 0.5) * 540}deg`);
      leaf.style.setProperty('--size', `${12 + Math.random() * 10}px`);
      leaf.style.animationDelay = `${Math.random() * 60}ms`;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', MAPLE);
      path.setAttribute('fill', LEAF_COLORS[i % LEAF_COLORS.length] ?? '#e5391f');
      leaf.appendChild(path);
      layer.appendChild(leaf);
    }
    const stamp = document.createElement('span');
    stamp.className = 'celebrate-stamp';
    stamp.textContent = '祝';
    layer.appendChild(stamp);
  }
  const text = document.createElement('span');
  text.className = 'celebrate-line';
  text.textContent = line;
  layer.appendChild(text);
  document.body.appendChild(layer);
  window.setTimeout(() => layer.remove(), reduced ? 1200 : 1600);
}
