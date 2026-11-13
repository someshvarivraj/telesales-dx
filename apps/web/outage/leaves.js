// Red autumn maple leaves (紅葉) drifting down and settling at the bottom of the screen (request
// 11/12; red since 11/13). Plain browser JavaScript with no imports: the maintenance page (outage.html) inlines
// it, and the app imports it, so both draw exactly the same leaves.

/**
 * Vivid autumn maple (request 11/13, after a photo of 紅葉): scarlet, crimson, red-orange and
 * a few orange and amber leaves. Each runs from a sunlit centre to a deeper edge.
 */
var LEAF_COLORS = [
  ['#ff5a1f', '#ff1a1a', '#c4001a'],
  ['#ff4a2a', '#f20d2e', '#b0001f'],
  ['#ff7a1f', '#ff3314', '#d10a14'],
  ['#ff6a24', '#fa2222', '#c20f1e'],
  ['#ffae2b', '#ff6a0f', '#e03a0a'],
  ['#ffd23a', '#ff9a14', '#e86a0a'],
];
/**
 * Sign-in lake sky (11/13): always a light early-evening sky, around 5 p.m. — soft blue
 * overhead turning peach at the mountains, with the moon and a few stars already out.
 * Set when the lake starts; the maintenance page (no lake) keeps its plain background.
 */
var EVENING = false;

/** How many leaves may lie on top of each other at one spot. */
var LAYERS = 2;
var BUCKET = 18;

/** Right half of a maple leaf, top tip to stem (unit size, pointing up); mirrored for the left. */
var HALF = [
  [0, -1],
  [0.1, -0.8],
  [0.07, -0.72],
  [0.19, -0.64],
  [0.15, -0.54],
  [0.2, -0.36],
  [0.42, -0.52],
  [0.46, -0.62],
  [0.62, -0.53],
  [0.96, -0.5],
  [0.78, -0.31],
  [0.85, -0.22],
  [0.63, -0.1],
  [0.48, 0.02],
  [0.63, 0.11],
  [0.82, 0.42],
  [0.56, 0.36],
  [0.51, 0.45],
  [0.31, 0.32],
  [0.15, 0.38],
  [0.05, 0.42],
  [0.03, 0.45],
];
/** Where the veins run to: the five lobe tips. */
var TIPS = [
  [0, -1],
  [0.96, -0.5],
  [-0.96, -0.5],
  [0.82, 0.42],
  [-0.82, 0.42],
];

/** A maple leaf outline in unit size, pointing up, stem at the bottom. */
function mapleOutline(ctx) {
  ctx.beginPath();
  HALF.forEach(function (p, i) {
    if (i === 0) ctx.moveTo(p[0], p[1]);
    else ctx.lineTo(p[0], p[1]);
  });
  for (var i = HALF.length - 1; i > 0; i--) ctx.lineTo(-HALF[i][0], HALF[i][1]);
  ctx.closePath();
}

/** One leaf drawn once into its own small canvas, then reused every frame. */
function leafSprite(size, colors) {
  var pad = 4;
  var canvas = document.createElement('canvas');
  var px = Math.ceil(size * 2 + pad * 2);
  canvas.width = px;
  canvas.height = px;
  var ctx = canvas.getContext('2d');
  ctx.translate(px / 2, px / 2);
  ctx.scale(size, size);
  var glow = ctx.createRadialGradient(-0.15, -0.25, 0.05, 0, 0, 1.05);
  glow.addColorStop(0, colors[0]);
  glow.addColorStop(0.55, colors[1]);
  glow.addColorStop(1, colors[2]);
  mapleOutline(ctx);
  ctx.fillStyle = glow;
  ctx.globalAlpha = 1;
  ctx.fill();
  // Veins from the stem to each lobe, and the stem.
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = colors[2];
  ctx.lineWidth = 0.03;
  ctx.lineCap = 'round';
  TIPS.forEach(function (tip) {
    ctx.beginPath();
    ctx.moveTo(0, 0.36);
    ctx.lineTo(tip[0] * 0.86, tip[1] * 0.86);
    ctx.stroke();
  });
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 0.05;
  ctx.beginPath();
  ctx.moveTo(0, 0.42);
  ctx.quadraticCurveTo(0.02, 0.7, 0.09, 0.98);
  ctx.stroke();
  return canvas;
}

/** Same numbers every time (mountains keep their shape when the window is resized). */
function seeded(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One mountain range: a ridge line with peaks (sharper where |sin| meets 1). */
function ridgeOf(base, amp, freq, rand) {
  var p1 = rand() * 10;
  var p2 = rand() * 10;
  var p3 = rand() * 10;
  return function (x) {
    var peaks = 1 - Math.abs(Math.sin(x * freq + p1));
    var roll = 0.5 + 0.5 * Math.sin(x * freq * 2.3 + p2);
    var fine = 0.5 + 0.5 * Math.sin(x * freq * 6.1 + p3);
    return base - amp * (0.55 * peaks + 0.3 * roll + 0.15 * fine);
  };
}

/** Where the waterfall comes down: right of the sign-in box on wide screens. */
function fallXOf(width) {
  // Clear of the sign-in box, which sits in the middle (right of centre on wide screens).
  return width * (width < 760 ? 0.88 : 0.91);
}

/**
 * Lake scenery (11/13): distant blue mountains, a nearer range with a cliff and autumn hills
 * with red, orange and amber trees along the shore. Drawn once per size onto its own canvas.
 */
function buildScenery(width, height, top, ratio) {
  var canvas = document.createElement('canvas');
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  var ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  var rand = seeded(1113);
  var tall = Math.min(200, height * 0.21);
  if (EVENING) {
    // Early evening, still light: soft blue overhead, lavender, then peach at the mountains.
    var sky = ctx.createLinearGradient(0, 0, 0, top);
    sky.addColorStop(0, '#b3c1e8');
    sky.addColorStop(0.45, '#d3cdeb');
    sky.addColorStop(0.8, '#f7d8cc');
    sky.addColorStop(1, '#ffe6c8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, top + 4);
  }
  var layers = [
    { ridge: ridgeOf(top, tall, 0.0042, rand), from: '#dfe6ee', to: '#c9d4df' },
    { ridge: ridgeOf(top, tall * 0.68, 0.0071, rand), from: '#b4c3d2', to: '#9cadbf' },
    { ridge: ridgeOf(top, tall * 0.22, 0.016, rand), from: '#a5705e', to: '#7e5446' },
  ];
  var fallX = fallXOf(width);
  layers.forEach(function (layer, index) {
    var highest = top - (index === 0 ? tall : index === 1 ? tall * 0.68 : tall * 0.22);
    var fill = ctx.createLinearGradient(0, highest, 0, top);
    fill.addColorStop(0, layer.from);
    fill.addColorStop(1, layer.to);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, top + 2);
    for (var x = 0; x <= width + 8; x += 8) ctx.lineTo(x, layer.ridge(x));
    ctx.lineTo(width, top + 2);
    ctx.closePath();
    ctx.fill();
    if (index === 0) {
      // Snow on the highest peaks of the far range.
      ctx.save();
      ctx.clip();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.fillRect(0, top - tall - 4, width, tall * 0.16);
      ctx.restore();
    }
  });

  // The cliff the water falls from: a rocky shoulder rising out of the middle range.
  var fallTop = top - tall * 0.62;
  var rock = ctx.createLinearGradient(fallX - 60, 0, fallX + 60, 0);
  rock.addColorStop(0, '#8d99a5');
  rock.addColorStop(0.45, '#6a7682');
  rock.addColorStop(1, '#8592a0');
  ctx.fillStyle = rock;
  ctx.beginPath();
  ctx.moveTo(fallX - 78, top + 2);
  ctx.lineTo(fallX - 58, fallTop + tall * 0.34);
  ctx.lineTo(fallX - 44, fallTop + tall * 0.2);
  ctx.lineTo(fallX - 34, fallTop + 10);
  ctx.lineTo(fallX - 20, fallTop - 6);
  ctx.lineTo(fallX - 6, fallTop - 2);
  ctx.lineTo(fallX + 10, fallTop - 9);
  ctx.lineTo(fallX + 26, fallTop + 4);
  ctx.lineTo(fallX + 40, fallTop + tall * 0.16);
  ctx.lineTo(fallX + 54, fallTop + tall * 0.3);
  ctx.lineTo(fallX + 82, top + 2);
  ctx.closePath();
  ctx.fill();
  // Darker ledges on the rock.
  ctx.strokeStyle = 'rgba(70, 80, 92, 0.45)';
  ctx.lineWidth = 1.2;
  [0.3, 0.55, 0.78].forEach(function (k) {
    var y = fallTop + (top - fallTop) * k;
    ctx.beginPath();
    ctx.moveTo(fallX - 50 + k * 10, y);
    ctx.lineTo(fallX - 22, y + 3);
    ctx.moveTo(fallX + 22, y - 2);
    ctx.lineTo(fallX + 46 - k * 8, y + 2);
    ctx.stroke();
  });

  // Autumn trees along the near hills (left and right of the waterfall's rocks).
  var trees = ['#d9452b', '#e8742a', '#f0a830', '#c2332a', '#b5651d'];
  var near = layers[2].ridge;
  for (var t = 0; t < width / 7; t++) {
    var tx = rand() * width;
    if (Math.abs(tx - fallX) < 70) continue;
    var ground = near(tx);
    var ty = ground + rand() * (top - ground) * 0.85;
    var r = 3 + rand() * 4;
    ctx.fillStyle = trees[Math.floor(rand() * trees.length)];
    ctx.beginPath();
    ctx.ellipse(tx, ty, r, r * 1.15, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  return { canvas: canvas, fallX: fallX, fallTop: fallTop };
}

/** Lake scenery: the mountains, and their faint reflection in the water. */
function drawScenery(ctx, scenery, width, height, top, below) {
  if (!scenery) return;
  if (!below) {
    ctx.drawImage(scenery.canvas, 0, 0, width, height);
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top, width, height - top);
  ctx.clip();
  ctx.globalAlpha = 0.16;
  ctx.translate(0, top * 2);
  ctx.scale(1, -1);
  ctx.drawImage(scenery.canvas, 0, 0, width, height);
  ctx.restore();
}

/** The waterfall: falling streaks over a pale band, mist and foam where it meets the lake. */
function drawWaterfall(ctx, scenery, top, t, falls) {
  if (!scenery) return;
  var x = scenery.fallX;
  var from = scenery.fallTop;
  var w = 30;
  var band = ctx.createLinearGradient(0, from, 0, top);
  band.addColorStop(0, 'rgba(225, 240, 248, 0.92)');
  band.addColorStop(1, 'rgba(200, 228, 242, 0.95)');
  ctx.fillStyle = band;
  ctx.beginPath();
  ctx.moveTo(x - w / 2 + 2, from);
  ctx.lineTo(x + w / 2 - 2, from);
  ctx.lineTo(x + w / 2 + 3, top);
  ctx.lineTo(x - w / 2 - 3, top);
  ctx.closePath();
  ctx.fill();
  var span = top - from;
  ctx.lineCap = 'round';
  for (var i = 0; i < falls.length; i++) {
    var f = falls[i];
    var y = from + ((f.offset + t * f.speed) % (span + f.length)) - f.length;
    var y1 = Math.max(from, y);
    var y2 = Math.min(top, y + f.length);
    if (y2 <= y1) continue;
    var spread = (y1 - from) / span;
    ctx.strokeStyle = 'rgba(255, 255, 255, ' + f.alpha.toFixed(2) + ')';
    ctx.lineWidth = f.width;
    ctx.beginPath();
    ctx.moveTo(x + f.lane * (w / 2 + spread * 3), y1);
    ctx.lineTo(x + f.lane * (w / 2 + ((y2 - from) / span) * 3), y2);
    ctx.stroke();
  }
  // Mist and foam at the foot.
  var pulse = 0.5 + 0.5 * Math.sin(t * 2.1);
  var mist = ctx.createRadialGradient(x, top, 2, x, top, 60);
  mist.addColorStop(0, 'rgba(255, 255, 255, ' + (0.75 + 0.15 * pulse).toFixed(2) + ')');
  mist.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = mist;
  ctx.beginPath();
  ctx.ellipse(x, top + 2, 60, 18, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Waterfall streaks: lanes across the band, each falling at its own speed. */
function makeFalls() {
  var list = [];
  for (var i = 0; i < 34; i++) {
    list.push({
      lane: Math.random() * 2 - 1,
      offset: Math.random() * 400,
      speed: 140 + Math.random() * 120,
      length: 14 + Math.random() * 30,
      width: 1 + Math.random() * 1.6,
      alpha: 0.45 + Math.random() * 0.45,
    });
  }
  return list;
}

/** Lake: where the water starts — about a quarter of the screen, never too thin or too tall. */
function lakeTopOf(height) {
  return height - Math.max(120, Math.min(250, height * 0.26));
}

/** Lake: light on the water, a few dozen thin streaks that drift and glint. */
function makeStreaks() {
  var list = [];
  for (var i = 0; i < 34; i++) {
    list.push({
      x: Math.random(),
      depth: Math.random(),
      length: 18 + Math.random() * 60,
      speed: 0.004 + Math.random() * 0.01,
      phase: Math.random() * Math.PI * 2,
    });
  }
  return list;
}

/** Lake: the shoreline, a gentle moving wave. */
function shoreAt(x, top, t) {
  return top + Math.sin(x * 0.011 + t * 0.55) * 2.4 + Math.sin(x * 0.029 - t * 0.8) * 1.2;
}

/** Lake: still blue water fading deeper towards the front, a soft shore and glints. */
function drawLake(ctx, width, height, top, t, streaks) {
  // Haze just above the water.
  var haze = ctx.createLinearGradient(0, top - 28, 0, top);
  haze.addColorStop(0, 'rgba(170, 210, 228, 0)');
  haze.addColorStop(1, 'rgba(170, 210, 228, 0.35)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, top - 28, width, 28);

  ctx.beginPath();
  ctx.moveTo(0, shoreAt(0, top, t));
  for (var x = 12; x <= width + 12; x += 12) ctx.lineTo(x, shoreAt(x, top, t));
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  var water = ctx.createLinearGradient(0, top, 0, height);
  water.addColorStop(0, 'rgba(196, 228, 241, 0.96)');
  water.addColorStop(0.35, 'rgba(132, 190, 220, 0.97)');
  water.addColorStop(1, 'rgba(58, 118, 160, 0.98)');
  ctx.fillStyle = water;
  ctx.fill();

  // The bright line where the water meets the shore.
  ctx.beginPath();
  ctx.moveTo(0, shoreAt(0, top, t));
  for (var x2 = 12; x2 <= width + 12; x2 += 12) ctx.lineTo(x2, shoreAt(x2, top, t));
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Glints: shorter and fainter far away (near the shore), longer at the front.
  var depthPx = height - top;
  ctx.lineCap = 'round';
  for (var i = 0; i < streaks.length; i++) {
    var s = streaks[i];
    var y = top + 10 + s.depth * (depthPx - 16);
    var near = 0.4 + 0.6 * s.depth;
    var len = s.length * near;
    var sx = ((s.x + t * s.speed) % 1) * (width + len) - len / 2;
    var glow = 0.1 + 0.22 * (0.5 + 0.5 * Math.sin(t * 1.4 + s.phase));
    ctx.strokeStyle = 'rgba(255, 255, 255, ' + (glow * near).toFixed(3) + ')';
    ctx.lineWidth = 1 + near;
    ctx.beginPath();
    ctx.moveTo(sx - len / 2, y);
    ctx.lineTo(sx + len / 2, y);
    ctx.stroke();
  }
}

/**
 * Koi (錦鯉, 11/13), seen from above as in a Japanese garden pond. Each variety has its own
 * body colour and patches: [x, y, rx, ry, colour] along the body (nose at x = 0.5).
 */
var RED = '#e5391f';
var INK = '#1f2328';
var KOI = [
  // 紅白 Kohaku: white with large red patches.
  {
    body: '#fffaf3',
    fin: 'rgba(255, 250, 243, 0.85)',
    spots: [
      [0.3, 0, 0.13, 0.11, RED],
      [0.02, 0.02, 0.14, 0.1, RED],
      [-0.24, -0.01, 0.08, 0.06, RED],
    ],
  },
  // 丹頂 Tancho: white with one red circle on the head.
  { body: '#fffaf3', fin: 'rgba(255, 250, 243, 0.85)', spots: [[0.33, 0, 0.07, 0.07, RED]] },
  // 大正三色 Sanke: white, red and small black spots.
  {
    body: '#fffaf3',
    fin: 'rgba(255, 250, 243, 0.85)',
    spots: [
      [0.24, 0.01, 0.13, 0.1, RED],
      [-0.12, -0.02, 0.11, 0.08, RED],
      [0.06, 0.06, 0.04, 0.03, INK],
      [-0.26, 0.03, 0.04, 0.03, INK],
      [0.12, -0.07, 0.03, 0.025, INK],
    ],
  },
  // 昭和三色 Showa: black with red and white.
  {
    body: '#262a30',
    fin: 'rgba(60, 64, 72, 0.8)',
    spots: [
      [0.3, 0, 0.12, 0.1, RED],
      [-0.06, 0.04, 0.12, 0.07, '#fffaf3'],
      [-0.25, -0.03, 0.08, 0.05, RED],
    ],
  },
  // 黄金 Ogon: shining gold.
  {
    body: '#ffbf2e',
    fin: 'rgba(255, 214, 110, 0.85)',
    spots: [[0.1, -0.03, 0.3, 0.05, '#ffe9a6']],
  },
  // 山吹 / orange.
  { body: '#ff7a1f', fin: 'rgba(255, 168, 100, 0.85)', spots: [[0.05, 0, 0.2, 0.06, '#ffab5c']] },
];

/** Fish (11/13): koi swimming under the surface, some near the shore (small) and some in front. */
function makeFish(width, height, top) {
  var count = width < 760 ? 4 : 8;
  var list = [];
  for (var i = 0; i < count; i++) list.push(newFish(width, height, top, true));
  return list;
}

function newFish(width, height, top, anywhere) {
  var depth = Math.random();
  var dir = Math.random() < 0.5 ? -1 : 1;
  var length = 26 + depth * 24 + Math.random() * 8;
  return {
    depth: depth,
    dir: dir,
    length: length,
    x: anywhere ? Math.random() * width : dir > 0 ? -length * 2 : width + length * 2,
    y: top + 26 + depth * (height - top - 48),
    speed: 14 + Math.random() * 18,
    boost: 0,
    wag: Math.random() * Math.PI * 2,
    wander: Math.random() * Math.PI * 2,
    koi: KOI[Math.floor(Math.random() * KOI.length)],
  };
}

/** One koi, seen from above, facing right in its own coordinates; the tail swings as it swims. */
function drawFish(ctx, fish) {
  var L = fish.length;
  var swing = Math.sin(fish.wag) * (0.32 + Math.min(0.4, fish.boost / 120));
  var koi = fish.koi;
  ctx.save();
  ctx.translate(fish.x, fish.y);
  ctx.scale(fish.dir, 0.62);
  ctx.rotate(Math.sin(fish.wag + 1.2) * 0.05 + Math.cos(fish.wander) * 0.08);
  // Just under the water: a little softer further away.
  ctx.globalAlpha = 0.72 + 0.25 * fish.depth;

  // Shadow on the lake bed.
  ctx.fillStyle = 'rgba(20, 60, 90, 0.2)';
  ctx.beginPath();
  ctx.ellipse(-L * 0.02, L * 0.34, L * 0.5, L * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();

  // Flowing tail fin.
  ctx.save();
  ctx.translate(-L * 0.36, 0);
  ctx.rotate(swing);
  ctx.fillStyle = koi.fin;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-L * 0.12, -L * 0.06, -L * 0.24, -L * 0.24, -L * 0.36, -L * 0.2);
  ctx.quadraticCurveTo(-L * 0.26, -L * 0.02, -L * 0.3, 0);
  ctx.quadraticCurveTo(-L * 0.26, L * 0.02, -L * 0.36, L * 0.2);
  ctx.bezierCurveTo(-L * 0.24, L * 0.24, -L * 0.12, L * 0.06, 0, 0);
  ctx.fill();
  ctx.restore();

  // Pectoral fins spread to the sides, and the small fins near the tail.
  ctx.fillStyle = koi.fin;
  [-1, 1].forEach(function (side) {
    ctx.beginPath();
    ctx.ellipse(
      L * 0.2,
      side * L * 0.15,
      L * 0.12,
      L * 0.06,
      side * (0.9 + swing * 0.5),
      0,
      Math.PI * 2,
    );
    ctx.ellipse(-L * 0.18, side * L * 0.09, L * 0.06, L * 0.03, side * 0.8, 0, Math.PI * 2);
    ctx.fill();
  });

  // Body: a round head, the widest part just behind it, narrowing to the tail.
  ctx.beginPath();
  ctx.moveTo(L * 0.5, 0);
  ctx.bezierCurveTo(L * 0.5, -L * 0.1, L * 0.3, -L * 0.15, L * 0.1, -L * 0.14);
  ctx.bezierCurveTo(-L * 0.12, -L * 0.12, -L * 0.3, -L * 0.06, -L * 0.38, 0);
  ctx.bezierCurveTo(-L * 0.3, L * 0.06, -L * 0.12, L * 0.12, L * 0.1, L * 0.14);
  ctx.bezierCurveTo(L * 0.3, L * 0.15, L * 0.5, L * 0.1, L * 0.5, 0);
  ctx.closePath();
  ctx.fillStyle = koi.body;
  ctx.fill();
  ctx.save();
  ctx.clip();
  koi.spots.forEach(function (spot) {
    ctx.fillStyle = spot[4];
    ctx.beginPath();
    ctx.ellipse(spot[0] * L, spot[1] * L, spot[2] * L, spot[3] * L, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  // Light along the back and faint scales.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.beginPath();
  ctx.ellipse(L * 0.02, 0, L * 0.4, L * 0.025, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
  ctx.lineWidth = 0.8;
  for (var k = 0; k < 5; k++) {
    var sx = L * (0.18 - k * 0.1);
    ctx.beginPath();
    ctx.arc(sx, 0, L * 0.12, -0.9, 0.9);
    ctx.stroke();
  }
  ctx.restore();

  // Eyes on the sides of the head, and the whiskers (barbels) koi are known for.
  ctx.fillStyle = 'rgba(25, 25, 30, 0.85)';
  [-1, 1].forEach(function (side) {
    ctx.beginPath();
    ctx.arc(L * 0.4, side * L * 0.075, Math.max(1, L * 0.025), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.strokeStyle = koi.fin;
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  [-1, 1].forEach(function (side) {
    ctx.beginPath();
    ctx.moveTo(L * 0.48, side * L * 0.04);
    ctx.quadraticCurveTo(L * 0.55, side * L * 0.07, L * 0.56, side * L * 0.11);
    ctx.stroke();
  });
  ctx.restore();
}

/** Moves the fish; they swim back in from the side they left, at a new depth. */
function swimFish(list, dt, width, height, top) {
  for (var i = 0; i < list.length; i++) {
    var f = list[i];
    f.wander += dt * 0.6;
    f.wag += dt * (5 + f.boost / 12);
    f.boost *= Math.pow(0.3, dt);
    f.x += f.dir * (f.speed + f.boost) * dt;
    f.y += Math.sin(f.wander) * 6 * dt;
    f.y = Math.max(top + 18, Math.min(height - 14, f.y));
    if (f.x < -f.length * 3 || f.x > width + f.length * 3)
      list[i] = newFish(width, height, top, false);
  }
}

/** Where the crocodile rests: the bottom-left corner of the lake. */
function crocOf(width, height) {
  var scale = width < 760 ? 0.72 : 1;
  return { x: 26 + 70 * scale, y: height - 30 * scale, scale: scale };
}

/**
 * A friendly crocodile (11/13) lying in the bottom-left corner: only the top of its head is out
 * of the water — two eyes that follow the pointer, the snout, and a smile. It blinks now and then.
 */
function drawCroc(ctx, croc, t, look, blink) {
  var s = croc.scale;
  var bob = Math.sin(t * 1.1) * 1.4;
  ctx.save();
  ctx.translate(croc.x, croc.y + bob);
  ctx.scale(s, s);

  // Its shape under the water.
  ctx.fillStyle = 'rgba(30, 70, 50, 0.22)';
  ctx.beginPath();
  ctx.ellipse(6, 10, 92, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  var skin = ctx.createLinearGradient(0, -26, 0, 6);
  skin.addColorStop(0, '#7dbb4f');
  skin.addColorStop(1, '#3f7a34');
  ctx.fillStyle = skin;
  // Back of the head and the long snout, just above the water line (y = 0).
  ctx.beginPath();
  ctx.moveTo(-52, 2);
  ctx.bezierCurveTo(-50, -16, -24, -20, 0, -15);
  ctx.bezierCurveTo(22, -11, 50, -12, 66, -10);
  ctx.bezierCurveTo(78, -9, 82, -2, 80, 2);
  ctx.closePath();
  ctx.fill();
  // Nostril bump at the tip.
  ctx.beginPath();
  ctx.ellipse(70, -10, 9, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2c5426';
  ctx.beginPath();
  ctx.ellipse(67, -12, 1.6, 1.1, 0, 0, Math.PI * 2);
  ctx.ellipse(73, -12, 1.6, 1.1, 0, 0, Math.PI * 2);
  ctx.fill();
  // Little bumps along the head.
  ctx.fillStyle = 'rgba(44, 84, 38, 0.55)';
  [
    [-38, -9],
    [-30, -13],
    [12, -12],
    [26, -11],
    [40, -11],
  ].forEach(function (b) {
    ctx.beginPath();
    ctx.ellipse(b[0], b[1], 2.4, 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // The smile: along the snout, curling up at the corner of the mouth, with a rosy cheek.
  ctx.strokeStyle = '#24461f';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(76, -4);
  ctx.quadraticCurveTo(30, 5, -4, -1);
  ctx.quadraticCurveTo(-14, -3, -17, -11);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 140, 140, 0.45)';
  ctx.beginPath();
  ctx.ellipse(-12, -2, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // A white tooth peeking out.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(46, 0.6);
  ctx.lineTo(49, 4.4);
  ctx.lineTo(52, 0.2);
  ctx.closePath();
  ctx.fill();

  // Eyes on top of the head.
  [-36, -14].forEach(function (ex) {
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(ex, -20, 10, Math.PI, 0);
    ctx.lineTo(ex + 10, -14);
    ctx.lineTo(ex - 10, -14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fffbea';
    ctx.beginPath();
    ctx.arc(ex, -20, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1f2a1c';
    ctx.beginPath();
    ctx.ellipse(ex + look.x * 2.6, -20 + look.y * 2.2, 2.6, 4.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex + look.x * 2.6 + 1.2, -21.6 + look.y * 2.2, 1.1, 0, Math.PI * 2);
    ctx.fill();
    if (blink > 0) {
      // Eyelid closing over the eye.
      ctx.fillStyle = '#5f9c43';
      ctx.beginPath();
      ctx.rect(ex - 8, -28, 16, 15 * blink);
      ctx.fill();
      ctx.strokeStyle = '#24461f';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(ex - 6, -28 + 15 * blink);
      ctx.lineTo(ex + 6, -28 + 15 * blink);
      ctx.stroke();
    }
  });

  // Water lapping at the head: a bright line and a soft band below it.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(12, 1.5, 74 + Math.sin(t * 1.6) * 2, 5, 0, Math.PI * 0.05, Math.PI * 0.95);
  ctx.stroke();
  ctx.restore();
}

/** Where the moon is: the top-left corner, smaller on phones. */
function sunOf(width) {
  return width < 640
    ? { x: 46, y: 46, r: 24 }
    : width < 1024
      ? { x: 64, y: 64, r: 34 }
      : { x: 84, y: 84, r: 46 };
}

/** The rabbit's mallet (杵): where it strikes, and how high it is raised. */
var MALLET_DOWN = 0.5;
var MALLET_UP = -0.95;

/**
 * The moon in the evening sky (11/13, after the senior's requests): a pale round disc with a
 * soft glow. On it the rabbit in the moon (月のうさぎ) pounds mochi in a mortar: the mallet
 * rises slowly and comes down quickly, and the mochi gives a little at each strike.
 */
function drawSun(ctx, sun, t) {
  var r = sun.r;
  ctx.save();
  ctx.translate(sun.x, sun.y);

  // Soft glow, breathing slowly.
  var breath = 0.5 + 0.5 * Math.sin(t * 0.8);
  var glow = ctx.createRadialGradient(0, 0, r * 0.8, 0, 0, r * (2.2 + 0.15 * breath));
  glow.addColorStop(0, 'rgba(255, 255, 245, 0.55)');
  glow.addColorStop(1, 'rgba(255, 255, 245, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.4, 0, Math.PI * 2);
  ctx.fill();

  var disc = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  disc.addColorStop(0, '#fffef6');
  disc.addColorStop(0.55, '#fbf5dc');
  disc.addColorStop(1, '#ece2c0');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // The rabbit and mortar, in unit size (the disc's radius is 1), in a soft grey-gold.
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.97, 0, Math.PI * 2);
  ctx.clip();
  ctx.scale(r, r);
  var mark = 'rgba(160, 146, 112, 0.6)';
  ctx.fillStyle = mark;
  ctx.strokeStyle = mark;
  ctx.lineCap = 'round';

  // Pounding: a slow lift (70% of the beat), then a quick strike.
  var beat = (t * 0.85) % 1;
  var lift = beat < 0.7 ? Math.sin((beat / 0.7) * Math.PI * 0.5) : 1 - (beat - 0.7) / 0.3;
  var hit = beat > 0.97 || beat < 0.06 ? 1 : 0;
  var angle = MALLET_DOWN + (MALLET_UP - MALLET_DOWN) * lift;

  // Mortar (臼) with the mochi on top, squashed a little at each strike.
  ctx.beginPath();
  ctx.moveTo(0.14, 0.36);
  ctx.lineTo(0.62, 0.36);
  ctx.lineTo(0.54, 0.74);
  ctx.lineTo(0.22, 0.74);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0.38, 0.36, 0.25, 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 252, 235, 0.95)';
  ctx.beginPath();
  ctx.ellipse(0.38, 0.32 + hit * 0.015, 0.16 + hit * 0.03, 0.06 - hit * 0.015, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = mark;

  // Rabbit, sitting up and facing the mortar: body, feet, tail, head and two long ears.
  ctx.beginPath();
  ctx.ellipse(-0.32, 0.3, 0.24, 0.3, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-0.26, 0.6, 0.16, 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-0.56, 0.42, 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-0.18, -0.08, 0.16, 0.14, 0.2, 0, Math.PI * 2);
  ctx.fill();
  var twitch = Math.sin(t * 3) * 0.04;
  ctx.beginPath();
  ctx.ellipse(-0.32, -0.38, 0.05, 0.2, -0.45 + twitch, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-0.19, -0.4, 0.05, 0.21, -0.15 - twitch, 0, Math.PI * 2);
  ctx.fill();
  // Eye.
  ctx.fillStyle = 'rgba(255, 240, 190, 0.95)';
  ctx.beginPath();
  ctx.arc(-0.1, -0.1, 0.03, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = mark;

  // Arms and the mallet (杵), swinging from the paws.
  var px = -0.08;
  var py = 0.08;
  ctx.lineWidth = 0.08;
  ctx.beginPath();
  ctx.moveTo(-0.22, 0.12);
  ctx.lineTo(px, py);
  ctx.stroke();
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(angle);
  ctx.lineWidth = 0.05;
  ctx.beginPath();
  ctx.moveTo(-0.04, 0);
  ctx.lineTo(0.46, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(0.42, -0.11, 0.13, 0.22);
  ctx.fill();
  ctx.restore();

  // A small puff of flour at each strike.
  if (hit) {
    ctx.fillStyle = 'rgba(255, 252, 235, 0.8)';
    [
      [0.18, 0.2],
      [0.58, 0.18],
      [0.4, 0.12],
    ].forEach(function (d) {
      ctx.beginPath();
      ctx.arc(d[0], d[1], 0.025, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  ctx.restore();

  // A thin bright rim.
  ctx.strokeStyle = 'rgba(255, 250, 220, 0.7)';
  ctx.lineWidth = Math.max(1, r * 0.04);
  ctx.beginPath();
  ctx.arc(0, 0, r - r * 0.02, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Where the fisherman's boat floats: right of the middle, near the front of the lake. */
function fisherOf(width, height) {
  var scale = width < 760 ? 0.75 : 1;
  // Narrower screens: the sign-in box covers the middle, so he sits at the right edge, facing left.
  if (width < 1024) return { x: width - 60 * scale, y: height - 56 * scale, scale: scale, dir: -1 };
  return { x: width * 0.76, y: height - 56 * scale, scale: scale, dir: 1 };
}

/**
 * A man fishing from a small wooden boat (11/13): straw hat (菅笠), indigo jacket, a rod with
 * its line and float. Every so often a fish bites: the float dips and the rod bends.
 */
function drawFisher(ctx, fisher, t, bite) {
  var s = fisher.scale;
  ctx.save();
  ctx.translate(fisher.x, fisher.y + Math.sin(t * 1.3) * 1.2 * s);
  ctx.scale(s * (fisher.dir || 1), s);

  // Its reflection, the boat's shadow on the water.
  ctx.fillStyle = 'rgba(30, 60, 80, 0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 8, 54, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // The float on the water, ahead of the boat, and the rings around it.
  var bx = 96;
  var dip = bite * 5;
  ctx.save();
  ctx.rotate(Math.sin(t * 0.9) * 0.02);

  // Rod: from the hands up and out to the right, bending when a fish bites.
  var hx = 12;
  var hy = -26;
  var tipX = 70;
  var tipY = -70 + bite * 18;
  ctx.strokeStyle = '#4a3220';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hx - 6, hy + 4);
  ctx.quadraticCurveTo(hx + 30, -62 + bite * 4, tipX, tipY);
  ctx.stroke();
  ctx.restore();

  // Line from the rod tip down to the float.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.quadraticCurveTo(bx - 6, (tipY + dip) / 2, bx, -2 + dip);
  ctx.stroke();
  ctx.fillStyle = '#e5391f';
  ctx.beginPath();
  ctx.arc(bx, -3 + dip, 3, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(bx, -3 + dip, 3, 0, Math.PI);
  ctx.fill();

  ctx.rotate(Math.sin(t * 0.9) * 0.02);
  // The man, sitting in the boat.
  ctx.fillStyle = '#2f4f8a';
  ctx.beginPath();
  ctx.moveTo(-18, -10);
  ctx.quadraticCurveTo(-20, -36, -6, -38);
  ctx.quadraticCurveTo(6, -38, 6, -10);
  ctx.closePath();
  ctx.fill();
  // White collar line of the jacket.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-10, -37);
  ctx.lineTo(-2, -24);
  ctx.stroke();
  // Arm reaching to the rod, and the hand.
  ctx.strokeStyle = '#26406f';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-4, -32);
  ctx.quadraticCurveTo(4, -22, hx, hy);
  ctx.stroke();
  ctx.fillStyle = '#f0c49a';
  ctx.beginPath();
  ctx.arc(hx, hy, 3, 0, Math.PI * 2);
  ctx.fill();
  // Head, with a smile, looking out at the float.
  ctx.beginPath();
  ctx.arc(-5, -45, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b2b2b';
  ctx.beginPath();
  ctx.arc(-1, -46, 1.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7a4a2a';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(-1.5, -43.5, 2.6, 0.1 * Math.PI, 0.6 * Math.PI);
  ctx.stroke();
  // Straw hat (菅笠).
  ctx.fillStyle = '#e2bf72';
  ctx.beginPath();
  ctx.moveTo(-24, -49);
  ctx.quadraticCurveTo(-5, -53, 14, -49);
  ctx.lineTo(-5, -64);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#b8913f';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-5, -64);
  ctx.lineTo(-12, -50);
  ctx.moveTo(-5, -64);
  ctx.lineTo(2, -50);
  ctx.stroke();

  // The wooden boat.
  var wood = ctx.createLinearGradient(0, -12, 0, 6);
  wood.addColorStop(0, '#a8714a');
  wood.addColorStop(1, '#6e4529');
  ctx.fillStyle = wood;
  ctx.beginPath();
  ctx.moveTo(-50, -14);
  ctx.lineTo(48, -14);
  ctx.quadraticCurveTo(44, 2, 30, 5);
  ctx.lineTo(-36, 5);
  ctx.quadraticCurveTo(-48, 2, -50, -14);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#5a3820';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-50, -14);
  ctx.lineTo(48, -14);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(60, 35, 18, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-44, -5);
  ctx.lineTo(42, -5);
  ctx.stroke();
  // Water along the hull.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(-2, 3, 50 + Math.sin(t * 1.5) * 2, 4, 0, Math.PI * 0.05, Math.PI * 0.95);
  ctx.stroke();
  ctx.restore();
  return { x: fisher.x + bx * s * (fisher.dir || 1), y: fisher.y };
}

/** A few dotted stars high in the evening sky (not too many), away from the moon. */
function makeStars(width, top, moon) {
  var list = [];
  // A light sky: only a few, high up where it is bluest.
  var count = Math.min(28, Math.round(width / 50));
  var ceiling = (top - Math.min(200, top * 0.3)) * 0.5;
  for (var tries = 0; list.length < count && tries < count * 6; tries++) {
    var x = Math.random() * width;
    var y = 6 + Math.random() * Math.max(20, ceiling - 6);
    var dx = x - moon.x;
    var dy = y - moon.y;
    if (Math.sqrt(dx * dx + dy * dy) < moon.r * 2.2) continue;
    list.push({
      x: x,
      y: y,
      size: 1.3 + Math.random() * 1.1,
      phase: Math.random() * Math.PI * 2,
      rate: 0.8 + Math.random() * 1.6,
    });
  }
  return list;
}

function drawStars(ctx, stars, t) {
  for (var i = 0; i < stars.length; i++) {
    var st = stars[i];
    var a = 0.65 + 0.35 * (0.5 + 0.5 * Math.sin(t * st.rate + st.phase));
    ctx.fillStyle = 'rgba(255, 255, 250, ' + a.toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(st.x, st.y, st.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A shooting star (流れ星) crossing the upper sky, its tail fading behind it. */
function newShootingStar(width, top) {
  var dir = Math.random() < 0.5 ? -1 : 1;
  return {
    x: width * (0.15 + Math.random() * 0.7),
    y: 10 + Math.random() * top * 0.3,
    vx: dir * (360 + Math.random() * 160),
    vy: 150 + Math.random() * 80,
    age: 0,
    life: 0.9 + Math.random() * 0.4,
  };
}

function drawShootingStar(ctx, star) {
  var p = star.age / star.life;
  var fade = p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8;
  var hx = star.x + star.vx * star.age;
  var hy = star.y + star.vy * star.age;
  var tail = 0.22;
  var tx = hx - star.vx * tail;
  var ty = hy - star.vy * tail;
  var streak = ctx.createLinearGradient(hx, hy, tx, ty);
  streak.addColorStop(0, 'rgba(255, 252, 235, ' + (0.95 * fade).toFixed(3) + ')');
  streak.addColorStop(1, 'rgba(255, 252, 235, 0)');
  ctx.strokeStyle = streak;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 245, ' + fade.toFixed(3) + ')';
  ctx.beginPath();
  ctx.arc(hx, hy, 1.6, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Starts the leaves on a full-screen canvas. Returns a function that stops them.
 * Nothing moves for people who prefer reduced motion; it pauses while the tab is hidden.
 *
 * `lake: true` (sign-in screen, request 11/13): instead of a pile, a calm lake along the bottom.
 * Leaves land on the water with a small ripple, float and drift, then fade; a click or tap on
 * the water sends a ripple that pushes the floating leaves away.
 */
export function startLeaves(canvas, options) {
  var opts = options || {};
  var ctx = canvas.getContext('2d');
  if (!ctx) return function () {};
  var lake = Boolean(opts.lake);
  EVENING = lake;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    if (!lake) return function () {};
    // Still water, no leaves.
    var still = function () {
      var r = Math.min(2, window.devicePixelRatio || 1);
      var w = canvas.clientWidth || window.innerWidth;
      var h = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.round(w * r);
      canvas.height = Math.round(h * r);
      ctx.setTransform(r, 0, 0, r, 0, 0);
      var top = lakeTopOf(h);
      var scenery = buildScenery(w, h, top, r);
      var moon = sunOf(w);
      drawScenery(ctx, scenery, w, h, top, false);
      if (EVENING) drawStars(ctx, makeStars(w, top, moon), 0);
      drawSun(ctx, moon, 0);
      drawLake(ctx, w, h, top, 0, []);
      drawScenery(ctx, scenery, w, h, top, true);
      drawWaterfall(ctx, scenery, top, 0, []);
      drawFisher(ctx, fisherOf(w, h), 0, 0);
      drawCroc(ctx, crocOf(w, h), 0, { x: 0.6, y: -0.2 }, 0);
    };
    still();
    window.addEventListener('resize', still);
    return function () {
      window.removeEventListener('resize', still);
    };
  }
  var ratio = Math.min(2, window.devicePixelRatio || 1);
  var width = 0;
  var height = 0;
  var sprites = [];
  var falling = [];
  var resting = [];
  var heights = [];
  var raf = 0;
  var last = 0;
  var nextSpawn = 0;
  var maxFalling = opts.maxFalling || 18;
  var every = opts.every || 900;
  // Lake mode.
  var lakeTop = 0;
  var floating = [];
  var ripples = [];
  var streaks = makeStreaks();
  var clock = 0;
  var scenery = null;
  var falls = makeFalls();
  var nextFoam = 0;
  var fish = [];
  var croc = crocOf(0, 0);
  var look = { x: 0.6, y: -0.2 };
  var pointer = null;
  var nextBlink = 3;
  var blinkAt = -1;
  var nextCrocRing = 0;
  var sun = sunOf(0);
  var stars = [];
  var shooting = null;
  var nextShooting = 3;
  var fisher = fisherOf(0, 0);
  var nextBite = 5;
  var biteAt = -10;

  function resize() {
    width = canvas.clientWidth || window.innerWidth;
    height = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    // A new width: start a fresh pile.
    resting = [];
    heights = new Array(Math.ceil(width / BUCKET) + 1).fill(0);
    lakeTop = lakeTopOf(height);
    if (lake) {
      scenery = buildScenery(width, height, lakeTop, ratio);
      fish = makeFish(width, height, lakeTop);
      croc = crocOf(width, height);
      sun = sunOf(width);
      if (EVENING) stars = makeStars(width, lakeTop, sun);
      fisher = fisherOf(width, height);
    }
    floating = floating.filter(function (leaf) {
      return leaf.y0 > lakeTop && leaf.y0 < height;
    });
  }

  for (var s = 0; s < 8; s++) {
    var size = 15 + Math.random() * 12;
    // Drawn at the screen's pixel density, so the leaves stay sharp.
    sprites.push({
      size: size,
      image: leafSprite(size * ratio, LEAF_COLORS[s % LEAF_COLORS.length]),
    });
  }

  function spawn() {
    var sprite = sprites[Math.floor(Math.random() * sprites.length)];
    falling.push({
      sprite: sprite,
      x: Math.random() * width,
      y: -sprite.size * 2,
      vy: 26 + Math.random() * 30,
      drift: (Math.random() - 0.5) * 18,
      sway: 18 + Math.random() * 26,
      phase: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 2.4,
      angle: Math.random() * Math.PI * 2,
      flip: Math.random() * Math.PI * 2,
      // Lake: where on the water it comes down (anywhere between the shore and the front).
      target: 0.12 + Math.random() * 0.8,
    });
  }

  /** Lake: a leaf touches the water — a small ripple, and it floats from there. */
  function splash(leaf) {
    ripples.push({ x: leaf.x, y: leaf.y, age: 0, size: 26 + leaf.sprite.size, strength: 0.55 });
    floating.forEach(function (other) {
      var dx = other.x - leaf.x;
      var dy = (other.y0 - leaf.y) * 3;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < 70 && d > 0.01) {
        other.vx += (dx / d) * 22 * (1 - d / 70);
        other.vy += (dy / d) * 4 * (1 - d / 70);
      }
    });
    floating.push({
      sprite: leaf.sprite,
      x: leaf.x,
      y0: leaf.y,
      vx: (Math.random() - 0.5) * 8,
      vy: 0,
      drift: 3 + Math.random() * 5,
      bob: Math.random() * Math.PI * 2,
      angle: leaf.angle,
      spin: (Math.random() - 0.5) * 0.25,
      squash: 0.42 + Math.random() * 0.14,
      life: 26 + Math.random() * 18,
      age: 0,
    });
    if (floating.length > 36) floating[0].life = Math.min(floating[0].life, floating[0].age + 2);
  }

  /** Lake: the crocodile's eyes follow the pointer. */
  function track(event) {
    pointer = { x: event.clientX, y: event.clientY };
  }

  /** Lake: a click or tap on the water. */
  function poke(event) {
    if (!lake || event.clientY < lakeTop + 4) return;
    var rect = canvas.getBoundingClientRect();
    var x = event.clientX - rect.left;
    var y = event.clientY - rect.top;
    ripples.push({ x: x, y: y, age: 0, size: 120, strength: 1 });
    ripples.push({ x: x, y: y, age: -0.3, size: 80, strength: 0.7 });
    // Fish nearby dart away; the crocodile blinks.
    fish.forEach(function (f) {
      var dx = f.x - x;
      var dy = (f.y - y) * 2;
      if (Math.sqrt(dx * dx + dy * dy) < 170) {
        f.dir = dx >= 0 ? 1 : -1;
        f.boost = 140 + Math.random() * 60;
      }
    });
    if (Math.abs(x - croc.x) < 110 * croc.scale && Math.abs(y - croc.y) < 50) blinkAt = clock;
    floating.forEach(function (leaf) {
      var dx = leaf.x - x;
      var dy = (leaf.y0 - y) * 3;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < 150 && d > 0.01) {
        var push = 1 - d / 150;
        leaf.vx += (dx / d) * 90 * push;
        leaf.vy += (dy / d) * 14 * push;
        leaf.spin += (Math.random() - 0.5) * 1.6 * push;
      }
    });
  }

  function bucketOf(x) {
    return Math.max(0, Math.min(heights.length - 1, Math.floor(x / BUCKET)));
  }

  /** A leaf reaches the pile: it settles there, nudging the ones it lands on aside. */
  function land(leaf) {
    var b = bucketOf(leaf.x);
    var thick = leaf.sprite.size * 0.55;
    var limit = thick * LAYERS;
    var settled = {
      sprite: leaf.sprite,
      x: leaf.x,
      y: height - Math.min(heights[b], limit) - thick * 0.5,
      angle: leaf.angle,
      squash: 0.55 + Math.random() * 0.25,
      vx: 0,
      age: 0,
      fade: 1,
      bucket: b,
    };
    // Leaves underneath are pushed outward a little, the nearest the most.
    resting.forEach(function (other) {
      var dx = other.x - leaf.x;
      var near = Math.abs(dx) < leaf.sprite.size * 2.2;
      if (near && other.fade === 1) {
        other.vx += (dx >= 0 ? 1 : -1) * (40 + Math.random() * 30) * (1 - Math.abs(dx) / 60);
        other.angle += (Math.random() - 0.5) * 0.6;
      }
    });
    if (heights[b] >= limit) {
      // Two layers here already: the oldest leaf at this spot gives way.
      var oldest = null;
      resting.forEach(function (other) {
        if (other.bucket === b && other.fade === 1 && (!oldest || other.age > oldest.age)) {
          oldest = other;
        }
      });
      if (oldest) oldest.fading = true;
    } else {
      heights[b] += thick;
    }
    resting.push(settled);
  }

  function draw(sprite, x, y, angle, scaleX, scaleY, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scaleX, scaleY);
    var w = sprite.image.width / ratio;
    ctx.drawImage(sprite.image, -w / 2, -w / 2, w, w);
    ctx.restore();
  }

  function frame(now) {
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    if (now >= nextSpawn && falling.length < maxFalling) {
      spawn();
      nextSpawn = now + every * (0.6 + Math.random() * 0.8);
    }
    ctx.clearRect(0, 0, width, height);
    clock += dt;

    if (lake) {
      drawScenery(ctx, scenery, width, height, lakeTop, false);
      if (EVENING) {
        drawStars(ctx, stars, clock);
        if (!shooting && clock >= nextShooting) shooting = newShootingStar(width, lakeTop);
        if (shooting) {
          shooting.age += dt;
          if (shooting.age >= shooting.life) {
            shooting = null;
            nextShooting = clock + 5 + Math.random() * 7;
          } else drawShootingStar(ctx, shooting);
        }
      }
      drawSun(ctx, sun, clock);
      drawLake(ctx, width, height, lakeTop, clock, streaks);
      drawScenery(ctx, scenery, width, height, lakeTop, true);
      drawWaterfall(ctx, scenery, lakeTop, clock, falls);
      swimFish(fish, dt, width, height, lakeTop);
      fish.sort(function (a, b) {
        return a.y - b.y;
      });
      fish.forEach(function (f) {
        drawFish(ctx, f);
      });
      // Rings spreading from the foot of the waterfall.
      if (scenery && clock >= nextFoam) {
        ripples.push({
          x: scenery.fallX + (Math.random() - 0.5) * 16,
          y: lakeTop + 10 + Math.random() * 6,
          age: 0,
          size: 40 + Math.random() * 24,
          strength: 0.5,
        });
        nextFoam = clock + 0.55 + Math.random() * 0.4;
      }
      for (var k = ripples.length - 1; k >= 0; k--) {
        var rp = ripples[k];
        rp.age += dt;
        if (rp.age < 0) continue;
        var p = rp.age / 2.4;
        if (p >= 1) {
          ripples.splice(k, 1);
          continue;
        }
        var radius = rp.size * (0.15 + 0.85 * (1 - Math.pow(1 - p, 2)));
        ctx.save();
        if (p < 0.25) {
          // A brief bright spot where the water was touched.
          var glow = ctx.createRadialGradient(rp.x, rp.y, 0, rp.x, rp.y, rp.size * 0.35);
          glow.addColorStop(
            0,
            'rgba(255,255,255,' + (rp.strength * 0.5 * (1 - p / 0.25)).toFixed(3) + ')',
          );
          glow.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.ellipse(rp.x, rp.y, rp.size * 0.35, rp.size * 0.12, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle =
          'rgba(255,255,255,' + Math.min(1, rp.strength * 1.15 * (1 - p)).toFixed(3) + ')';
        ctx.lineWidth = 2.2 * (1 - p * 0.5);
        ctx.beginPath();
        ctx.ellipse(rp.x, rp.y, radius, radius * 0.3, 0, 0, Math.PI * 2);
        ctx.stroke();
        if (p > 0.15) {
          ctx.strokeStyle = 'rgba(255,255,255,' + (rp.strength * 0.75 * (1 - p)).toFixed(3) + ')';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.ellipse(rp.x, rp.y, radius * 0.62, radius * 0.19, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
      for (var m = floating.length - 1; m >= 0; m--) {
        var fl = floating[m];
        fl.age += dt;
        fl.bob += dt * 1.3;
        fl.x += (fl.drift + fl.vx) * dt;
        fl.y0 = Math.max(lakeTop + 6, Math.min(height - 6, fl.y0 + fl.vy * dt));
        fl.vx *= Math.pow(0.25, dt);
        fl.vy *= Math.pow(0.2, dt);
        fl.spin *= Math.pow(0.5, dt);
        fl.angle += fl.spin * dt;
        var alpha = Math.min(1, (fl.life - fl.age) / 3);
        if (alpha <= 0 || fl.x > width + 40 || fl.x < -40) {
          floating.splice(m, 1);
          continue;
        }
        var fy = fl.y0 + Math.sin(fl.bob) * 1.2;
        // Its reflection, then the leaf lying on the water.
        draw(
          fl.sprite,
          fl.x,
          fy + fl.sprite.size * 0.32,
          fl.angle,
          1,
          -fl.squash * 0.7,
          alpha * 0.16,
        );
        draw(fl.sprite, fl.x, fy, fl.angle, 1, fl.squash, alpha);
      }
    }

    if (lake) {
      var want = { x: 0.6, y: -0.2 };
      if (pointer) {
        var px = pointer.x - (croc.x - 25 * croc.scale);
        var py = pointer.y - (croc.y - 20 * croc.scale);
        var pd = Math.max(1, Math.sqrt(px * px + py * py));
        want = { x: px / pd, y: py / pd };
      }
      look.x += (want.x - look.x) * Math.min(1, dt * 6);
      look.y += (want.y - look.y) * Math.min(1, dt * 6);
      if (clock >= nextBlink) {
        blinkAt = clock;
        nextBlink = clock + 3 + Math.random() * 4;
      }
      var since = clock - blinkAt;
      var blink = since >= 0 && since < 0.26 ? Math.sin((since / 0.26) * Math.PI) : 0;
      if (clock >= nextCrocRing) {
        ripples.push({
          x: croc.x + 12 * croc.scale,
          y: croc.y + 2,
          age: 0,
          size: 150 * croc.scale,
          strength: 0.35,
        });
        nextCrocRing = clock + 2.6 + Math.random() * 1.6;
      }
      drawCroc(ctx, croc, clock, look, blink);

      // The fisherman: now and then a fish bites — the float dips twice, with rings.
      if (clock >= nextBite) {
        biteAt = clock;
        nextBite = clock + 6 + Math.random() * 6;
      }
      var biting = clock - biteAt;
      var bite = biting < 1.6 ? Math.max(0, Math.sin((biting / 0.8) * Math.PI)) : 0;
      var float = drawFisher(ctx, fisher, clock, bite);
      if (biting >= 0 && biting < dt + 0.0001) {
        ripples.push({
          x: float.x,
          y: float.y - 2,
          age: 0,
          size: 46 * fisher.scale,
          strength: 0.6,
        });
      }
    }

    for (var i = resting.length - 1; i >= 0; i--) {
      var r = resting[i];
      r.age += dt;
      if (r.vx) {
        var before = r.bucket;
        r.x += r.vx * dt;
        r.vx *= Math.pow(0.04, dt);
        if (Math.abs(r.vx) < 2) r.vx = 0;
        r.bucket = bucketOf(r.x);
        if (r.bucket !== before) {
          var t = r.sprite.size * 0.55;
          heights[before] = Math.max(0, heights[before] - t);
          heights[r.bucket] = Math.min(t * LAYERS, heights[r.bucket] + t);
        }
      }
      if (r.fading || r.x < -30 || r.x > width + 30) {
        r.fade -= dt * 0.8;
        if (r.fade <= 0) {
          heights[r.bucket] = Math.max(0, heights[r.bucket] - r.sprite.size * 0.55);
          resting.splice(i, 1);
          continue;
        }
      }
      draw(r.sprite, r.x, r.y, r.angle, 1, r.squash, Math.max(0, r.fade));
    }

    for (var j = falling.length - 1; j >= 0; j--) {
      var f = falling[j];
      f.phase += dt * 1.6;
      f.flip += dt * 2.2;
      f.angle += f.spin * dt;
      f.y += f.vy * dt;
      f.x += (f.drift + Math.cos(f.phase) * f.sway) * dt;
      if (lake) {
        var surface = lakeTop + 6 + f.target * (height - lakeTop - 14);
        if (f.y >= surface) {
          falling.splice(j, 1);
          splash(f);
          continue;
        }
      } else {
        var ground = height - Math.min(heights[bucketOf(f.x)], f.sprite.size * 0.55 * LAYERS);
        if (f.y >= ground - f.sprite.size * 0.4) {
          falling.splice(j, 1);
          land(f);
          continue;
        }
      }
      // The leaf turns over as it flutters (narrower when seen edge-on).
      draw(f.sprite, f.x, f.y, f.angle, 0.35 + 0.65 * Math.abs(Math.cos(f.flip)), 1, 1);
    }
    raf = window.requestAnimationFrame(frame);
  }

  function visibility() {
    if (document.hidden) {
      window.cancelAnimationFrame(raf);
      raf = 0;
    } else if (!raf) {
      last = 0;
      raf = window.requestAnimationFrame(frame);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', visibility);
  if (lake) {
    window.addEventListener('pointerdown', poke);
    window.addEventListener('pointermove', track);
  }
  raf = window.requestAnimationFrame(frame);
  return function stop() {
    window.cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('pointerdown', poke);
    window.removeEventListener('pointermove', track);
    ctx.clearRect(0, 0, width, height);
  };
}
