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

/** The three mountain ranges' ridge lines (far, middle, near), the same every time. */
function rangesOf(top, tall, rand) {
  return {
    far: ridgeOf(top, tall, 0.0042, rand),
    mid: ridgeOf(top, tall * 0.68, 0.0071, rand),
    near: ridgeOf(top, tall * 0.22, 0.016, rand),
  };
}

/**
 * Which mountain is at this point of the screen (11/17), the front-most first: `near` (the
 * brown hills, left side only), `mid`, `fuji` or `far`, with the screen y of its ridge right there — or null (sky or lake). The
 * sign-in screen uses it to let MoraBot peek out from behind the mountain that was clicked.
 */
export function mountainAt(x, y, width, height) {
  var top = lakeTopOf(height);
  if (y >= top) return null;
  var tall = Math.min(200, height * 0.21);
  // Not the city (11/18: a MoraBot face popping out of a building or the tower looked wrong),
  // nor the torii (MoraBot came up from Fuji right inside the gate).
  var harbor = harborOf(width, top, tall);
  if (harbor.H > 30 && x >= harbor.towerX - harbor.H * 3.3) return null;
  var torii = toriiOf(width, height, top);
  if (Math.abs(x - torii.x) <= torii.h * 0.9 && y >= torii.y - torii.h - 12) return null;
  var ranges = rangesOf(top, tall, seeded(1113));
  var fuji = fujiOf(width, height);
  var order = [
    ['near', nearRidgeOf(ranges.near, width, top, tall)],
    ['mid', ranges.mid],
    ['fuji', fuji.ridge],
    ['far', ranges.far],
  ];
  for (var i = 0; i < order.length; i++) {
    var ridge = order[i][1](x);
    if (y >= ridge && ridge < top - 2) return { kind: order[i][0], ridge: ridge };
  }
  return null;
}

/** A range's ridge at screen x (used to cut a peeking MoraBot along that range). */
export function rangeRidge(kind, x, width, height) {
  var top = lakeTopOf(height);
  var tall = Math.min(200, height * 0.21);
  var ranges = rangesOf(top, tall, seeded(1113));
  if (kind === 'near') return nearRidgeOf(ranges.near, width, top, tall)(x);
  return ranges[kind](x);
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

/**
 * Lake scenery: distant blue mountains, Fuji, and Kobe's waterfront on the right shore (11/17).
 * Drawn once per size onto its own canvas.
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
  var ranges = rangesOf(top, tall, rand);
  // The far blue ranges everywhere; the near brown hills only on the left (11/18), where there is
  // no city — behind Kobe they would hide the waterfront's foot.
  var layers = [
    { ridge: ranges.far, from: '#dfe6ee', to: '#c9d4df' },
    { ridge: ranges.mid, from: '#b4c3d2', to: '#9cadbf' },
  ];
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
      // Mt. Fuji rises from the far range, behind the torii (11/16).
      drawFuji(ctx, toriiOf(width, height, top).x + 30, top, tall);
    }
  });

  // The near brown hills with autumn trees, from the left edge down to the water before the city.
  var nearRidge = nearRidgeOf(ranges.near, width, top, tall);
  var hills = ctx.createLinearGradient(0, top - tall * 0.22, 0, top);
  hills.addColorStop(0, '#a5705e');
  hills.addColorStop(1, '#7e5446');
  ctx.fillStyle = hills;
  ctx.beginPath();
  ctx.moveTo(0, top + 2);
  for (var hx = 0; hx <= width + 8; hx += 8) ctx.lineTo(hx, nearRidge(hx));
  ctx.lineTo(width, top + 2);
  ctx.closePath();
  ctx.fill();
  var trees = ['#d9452b', '#e8742a', '#f0a830', '#c2332a', '#b5651d'];
  for (var tr = 0; tr < width / 7; tr++) {
    var tx = rand() * width;
    var ground = nearRidge(tx);
    var ty = ground + rand() * (top - ground) * 0.85;
    var tr2 = 3 + rand() * 4;
    var tc = trees[Math.floor(rand() * trees.length)];
    if (ground > top - 4) continue;
    ctx.fillStyle = tc;
    ctx.beginPath();
    ctx.ellipse(tx, ty, tr2, tr2 * 1.15, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Kobe's waterfront (11/17) on the far right shore, right of the sign-in box: Sannomiya's towers, Hotel Okura, the Maritime Museum and Port Tower. The Ferris
  // wheel and the tower's light show move, so they are drawn each frame (drawHarborLights).
  var harbor = harborOf(width, top, tall);
  drawWaterfront(ctx, harbor, seeded(1117));
  drawPortTower(ctx, harbor.towerX, harbor.base, harbor.H);
  return { canvas: canvas, harbor: harbor };
}

/** Where the waterfront stands; everything is placed in tower heights (H) around the tower. */
function harborOf(width, top, tall) {
  var H = Math.min(118, tall * 0.66);
  var towerX = towerXOf(width);
  return {
    H: H,
    towerX: towerX,
    base: top - 1,
    // East of the low blocks, in the open (11/17): west of the tower it hid behind Sannomiya
    // and, on most screens, behind the sign-in box.
    wheel: { x: towerX + H * 1.92, y: top - 1 - H * 0.47, r: H * 0.38 },
  };
}

/**
 * The テレマ MoraBot statue (11/18): the pink MoraBot artwork standing among the buildings east of
 * the tower like the great robot statue in Shin-Nagata, the low blocks in front hiding its body.
 * Toned a little by the evening haze, lit warm from below. Drawn only once the artwork has loaded
 * (the sign-in screen passes it in; the outage page has none).
 */
var STATUE = null;

function drawStatue(ctx, image, cx, base, S) {
  if (!image || !(S > 30)) return;
  var w = (S * image.naturalWidth) / image.naturalHeight;
  var glow = ctx.createRadialGradient(cx, base - S * 0.3, 0, cx, base - S * 0.3, S * 0.8);
  glow.addColorStop(0, 'rgba(255, 220, 170, 0.45)');
  glow.addColorStop(1, 'rgba(255, 220, 170, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - S * 0.8, base - S * 1.1, S * 1.6, S * 1.1);
  // The artwork with a light veil of haze on it only (not on the sky around it).
  var off = document.createElement('canvas');
  var scale = 2;
  off.width = Math.max(1, Math.round(w * scale));
  off.height = Math.max(1, Math.round(S * scale));
  var o = off.getContext('2d');
  if (!o) return;
  o.drawImage(image, 0, 0, off.width, off.height);
  o.globalCompositeOperation = 'source-atop';
  o.fillStyle = 'rgba(214, 206, 232, 0.2)';
  o.fillRect(0, 0, off.width, off.height);
  ctx.drawImage(off, cx - w / 2, base - S, w, S);
}

/** Lit and dark windows in rows over a building's face. */
function drawWindows(ctx, x, y, w, h, rand, lit) {
  var cell = Math.max(2.4, w / 6);
  for (var wy = y + cell * 0.8; wy < y + h - cell * 0.6; wy += cell) {
    for (var wx = x + cell * 0.5; wx < x + w - cell * 0.6; wx += cell) {
      ctx.fillStyle = rand() < lit ? 'rgba(255, 214, 128, 0.95)' : 'rgba(70, 78, 100, 0.35)';
      ctx.fillRect(wx, wy, cell * 0.5, cell * 0.42);
    }
  }
}

/**
 * The still part of the waterfront: Sannomiya's high-rises behind (hazy blue, warm windows), a
 * few lower blocks east of the tower, Hotel Okura's round white tower, the Maritime Museum's
 * white wave of a roof, and the quay along the water.
 */
function drawWaterfront(ctx, harbor, rand) {
  var H = harbor.H;
  var X = harbor.towerX;
  var base = harbor.base;
  if (!(H > 30)) return;
  ctx.save();
  // The city's warm glow on the horizon behind the buildings (evening), fading out on all sides.
  ctx.save();
  ctx.translate(X - H * 0.2, base);
  ctx.scale(3.4, 1);
  var glow = ctx.createRadialGradient(0, 0, 0, 0, 0, H * 1.15);
  glow.addColorStop(0, 'rgba(255, 196, 140, 0.5)');
  glow.addColorStop(1, 'rgba(255, 196, 140, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-H * 1.15, -H * 1.15, H * 2.3, H * 1.15);
  ctx.restore();
  // A back row of hazy towers, so it reads as a city and not a few buildings.
  for (var bx = X - H * 3.2; bx < X + H * 1.5; bx += H * (0.13 + rand() * 0.07)) {
    var bw = H * (0.09 + rand() * 0.08);
    var bh = H * (0.32 + rand() * 0.55);
    ctx.fillStyle = 'rgba(160, 170, 192, 0.9)';
    ctx.fillRect(bx, base - bh, bw, bh);
    drawWindows(ctx, bx, base - bh, bw, bh, rand, 0.3);
  }
  // The テレマ MoraBot statue among the buildings east of the tower; the low blocks hide its body.
  drawStatue(ctx, STATUE, X + H * 1.02, base, H * 1.15);
  // Sannomiya: the tall ones behind, west of the tower; lower blocks to the east.
  var blocks = [
    [-2.75, 0.17, 0.42],
    [-2.55, 0.2, 0.62],
    [-2.33, 0.15, 0.5],
    [-2.15, 0.22, 0.86],
    [-1.9, 0.16, 0.58],
    [-1.72, 0.2, 0.74],
    [-1.5, 0.15, 0.46],
    [0.62, 0.18, 0.4],
    [0.82, 0.22, 0.52],
    [1.05, 0.16, 0.34],
    [1.22, 0.2, 0.44],
  ];
  blocks.forEach(function (b) {
    var w = b[1] * H;
    var h = b[2] * H;
    var x = X + b[0] * H;
    var face = ctx.createLinearGradient(x, 0, x + w, 0);
    face.addColorStop(0, '#9aa3b8');
    face.addColorStop(1, '#7f88a0');
    ctx.fillStyle = face;
    ctx.fillRect(x, base - h, w, h);
    drawWindows(ctx, x, base - h, w, h, rand, 0.42);
  });
  // A red light on top of the tallest one.
  ctx.fillStyle = '#ff4a3a';
  ctx.beginPath();
  ctx.arc(X - 2.15 * H + 0.11 * H, base - 0.86 * H - 2, Math.max(1.2, H / 70), 0, Math.PI * 2);
  ctx.fill();

  // Hotel Okura Kobe beside Port Tower (11/17: drawn so it reads as a hotel): a low lobby wing,
  // a round white tower shaded like a cylinder with a grid of lit rooms, and a crown on top.
  var ow = H * 0.22;
  var oh = H * 0.78;
  var ox = X + H * 0.3;
  var ocx = ox + ow / 2;
  ctx.fillStyle = '#d9d7df';
  ctx.fillRect(ocx - H * 0.24, base - H * 0.11, H * 0.48, H * 0.11);
  drawWindows(ctx, ocx - H * 0.24, base - H * 0.11, H * 0.48, H * 0.11, rand, 0.7);
  var body = ctx.createLinearGradient(ox, 0, ox + ow, 0);
  body.addColorStop(0, '#b4b3c2');
  body.addColorStop(0.35, '#f6f4f8');
  body.addColorStop(0.7, '#dedce5');
  body.addColorStop(1, '#a6a5b6');
  ctx.fillStyle = body;
  ctx.fillRect(ox, base - oh, ow, oh - H * 0.11);
  // Rooms: columns squeezed towards the edges, as on a round wall.
  var cols = 6;
  for (var row = base - oh + H * 0.07; row < base - H * 0.14; row += H * 0.034) {
    for (var col = 0; col < cols; col++) {
      var angle = -1.25 + (2.5 * (col + 0.5)) / cols;
      var wxc = ocx + Math.sin(angle) * ow * 0.42;
      var ww = Math.max(0.6, ow * 0.09 * Math.cos(angle));
      ctx.fillStyle = rand() < 0.55 ? 'rgba(255, 210, 120, 0.95)' : 'rgba(84, 92, 118, 0.45)';
      ctx.fillRect(wxc - ww / 2, row, ww, H * 0.016);
    }
  }
  // The crown: a slightly wider ring, a small roof box and a red light.
  ctx.fillStyle = '#c9c7d3';
  ctx.fillRect(ox - ow * 0.06, base - oh - H * 0.03, ow * 1.12, H * 0.035);
  ctx.fillStyle = '#e8e6ee';
  ctx.fillRect(ocx - ow * 0.22, base - oh - H * 0.07, ow * 0.44, H * 0.04);
  ctx.fillStyle = '#ff4a3a';
  ctx.beginPath();
  ctx.arc(ocx, base - oh - H * 0.08, Math.max(1.1, H / 75), 0, Math.PI * 2);
  ctx.fill();

  // Kobe Maritime Museum beside the tower (11/18, after the photo): a white steel lattice like
  // sails or a wave — a tall peak next to the tower, a long dip, a smaller peak at the far end —
  // lit warm white at night, over a low white building with green roofs.
  var m0 = X - H * 1.08;
  var m1 = X - H * 0.24;
  var mw = m1 - m0;
  var roofTop = base - H * 0.12;
  var crest = function (u) {
    // u = 0 at the far end, 1 next to the tower.
    var low = 0.2;
    var dip = 0.42;
    var h =
      u <= dip
        ? low + (0.4 - low) * Math.pow((dip - u) / dip, 2)
        : low + (0.68 - low) * Math.pow((u - dip) / (1 - dip), 2.2);
    return base - H * h;
  };
  // The building underneath: white walls, green roofs, lit windows.
  ctx.fillStyle = '#ece6dc';
  ctx.fillRect(m0 + mw * 0.04, roofTop, mw * 0.96, H * 0.12);
  ctx.fillStyle = '#6b8f7f';
  ctx.beginPath();
  ctx.moveTo(m0 + mw * 0.02, roofTop + H * 0.02);
  ctx.lineTo(m0 + mw * 0.36, roofTop + H * 0.02);
  ctx.lineTo(m0 + mw * 0.32, roofTop - H * 0.03);
  ctx.lineTo(m0 + mw * 0.06, roofTop - H * 0.03);
  ctx.closePath();
  ctx.fill();
  for (var wx = m0 + mw * 0.42; wx < m1 - H * 0.03; wx += H * 0.045) {
    ctx.fillStyle = 'rgba(255, 214, 140, 0.95)';
    ctx.fillRect(wx, roofTop + H * 0.035, H * 0.025, H * 0.04);
  }
  // A soft warm light under the frame, then the lit lattice with a glow.
  ctx.fillStyle = 'rgba(255, 238, 190, 0.2)';
  ctx.beginPath();
  ctx.moveTo(m0, roofTop);
  for (var c = 0; c <= 30; c++) ctx.lineTo(m0 + (mw * c) / 30, crest(c / 30));
  ctx.lineTo(m1, roofTop);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.shadowColor = 'rgba(255, 224, 150, 0.95)';
  ctx.shadowBlur = Math.max(4, H * 0.07);
  ctx.strokeStyle = 'rgba(255, 247, 222, 0.9)';
  ctx.lineWidth = Math.max(0.6, H / 170);
  var bays = 16;
  for (var k = 0; k < bays; k++) {
    var ua = k / bays;
    var ub = (k + 1) / bays;
    var xa = m0 + mw * ua;
    var xb = m0 + mw * ub;
    ctx.beginPath();
    // Each bay: an upright and the two diagonals, which make the diamond net of the frame.
    ctx.moveTo(xa, roofTop);
    ctx.lineTo(xa, crest(ua));
    ctx.moveTo(xa, roofTop);
    ctx.lineTo(xb, crest(ub));
    ctx.moveTo(xb, roofTop);
    ctx.lineTo(xa, crest(ua));
    ctx.stroke();
  }
  // The edge of the sails, brighter and a little heavier.
  ctx.strokeStyle = 'rgba(255, 252, 238, 1)';
  ctx.lineWidth = Math.max(1.1, H / 85);
  ctx.beginPath();
  for (var e = 0; e <= 40; e++) {
    var ex = m0 + (mw * e) / 40;
    if (e === 0) ctx.moveTo(ex, crest(0));
    else ctx.lineTo(ex, crest(e / 40));
  }
  ctx.lineTo(m1, roofTop);
  ctx.stroke();
  ctx.restore();

  // A dense low row along the water, leaving the tower, the hotel and the museum clear.
  for (var lx = X - H * 3.3; lx < X + H * 3.2; lx += H * (0.1 + rand() * 0.06)) {
    var rel = (lx - X) / H;
    if (rel > -1.12 && rel < 0.6) continue;
    var lw = H * (0.08 + rand() * 0.07);
    var lh = H * (0.1 + rand() * 0.17);
    ctx.fillStyle = rand() < 0.5 ? '#8a92a8' : '#7a8299';
    ctx.fillRect(lx, base - lh, lw, lh);
    drawWindows(ctx, lx, base - lh, lw, lh, rand, 0.55);
  }
  // Port cranes at the east end of the quay.
  [2.62, 2.98].forEach(function (at) {
    var cx = X + H * at;
    var ch = H * 0.42;
    ctx.strokeStyle = '#5d6b85';
    ctx.lineWidth = Math.max(1, H / 75);
    ctx.beginPath();
    ctx.moveTo(cx - H * 0.06, base);
    ctx.lineTo(cx - H * 0.04, base - ch);
    ctx.moveTo(cx + H * 0.06, base);
    ctx.lineTo(cx + H * 0.04, base - ch);
    ctx.moveTo(cx - H * 0.12, base - ch);
    ctx.lineTo(cx + H * 0.22, base - ch);
    ctx.moveTo(cx - H * 0.04, base - ch);
    ctx.lineTo(cx, base - ch - H * 0.1);
    ctx.lineTo(cx + H * 0.04, base - ch);
    ctx.stroke();
    ctx.fillStyle = '#ff4a3a';
    ctx.beginPath();
    ctx.arc(cx, base - ch - H * 0.1, Math.max(1, H / 85), 0, Math.PI * 2);
    ctx.fill();
  });

  // The quay along the water.
  ctx.fillStyle = '#8c8f99';
  ctx.fillRect(X - H * 3.4, base - 2, H * 6.7, 3);
  ctx.restore();
}

/** The shared outline of Port Tower: a twisted hyperboloid of straight pipes. */
function towerGeom(cx, base, H) {
  var latticeTop = base - H * 0.84;
  var bottomR = H * 0.17;
  var topR = H * 0.14;
  var twist = 2.45;
  return {
    cx: cx,
    base: base,
    H: H,
    latticeTop: latticeTop,
    bottomR: bottomR,
    topR: topR,
    twist: twist,
    radius: function (v) {
      return Math.sqrt(
        (1 - v) * (1 - v) * bottomR * bottomR +
          v * v * topR * topR +
          2 * v * (1 - v) * bottomR * topR * Math.cos(twist),
      );
    },
    yAt: function (v) {
      return base - (base - latticeTop) * v;
    },
  };
}

/**
 * What moves on the waterfront (11/17): Harborland's big Ferris wheel turning slowly with its
 * rim lights running through the colours, and Port Tower's light show, bands of coloured light
 * rising up the pipes.
 */
function drawHarborLights(ctx, harbor, t) {
  if (!harbor || !(harbor.H > 30)) return;
  var H = harbor.H;
  var wheel = harbor.wheel;
  ctx.save();
  // The wheel's legs.
  ctx.strokeStyle = '#8e95a8';
  ctx.lineWidth = Math.max(1.2, H / 70);
  ctx.beginPath();
  ctx.moveTo(wheel.x - wheel.r * 0.55, harbor.base);
  ctx.lineTo(wheel.x, wheel.y);
  ctx.lineTo(wheel.x + wheel.r * 0.55, harbor.base);
  ctx.stroke();
  // It turns about once every 30 s (11/18: 18 s felt hurried; once a minute looked still).
  var turn = t * 0.2;
  var dot = Math.max(1, H / 90);
  // Spokes.
  ctx.strokeStyle = 'rgba(240, 242, 248, 0.9)';
  ctx.lineWidth = Math.max(0.7, H / 150);
  for (var s = 0; s < 12; s++) {
    var a = turn + (s / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(wheel.x, wheel.y);
    ctx.lineTo(wheel.x + Math.cos(a) * wheel.r, wheel.y + Math.sin(a) * wheel.r);
    ctx.stroke();
  }
  // A deep red rim, so the wheel stands out against the hills.
  ctx.strokeStyle = '#a3201a';
  ctx.lineWidth = Math.max(1.6, H / 55);
  ctx.beginPath();
  ctx.arc(wheel.x, wheel.y, wheel.r, 0, Math.PI * 2);
  ctx.stroke();
  // Rim lights, and one bright light chasing round with a short tail: the turning is easy to see.
  var dots = 36;
  for (var d = 0; d < dots; d++) {
    var b = turn + (d / dots) * Math.PI * 2;
    ctx.fillStyle = 'hsl(' + ((d * 10 + t * 60) % 360) + ', 95%, 60%)';
    ctx.beginPath();
    ctx.arc(
      wheel.x + Math.cos(b) * wheel.r,
      wheel.y + Math.sin(b) * wheel.r,
      dot * 0.8,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  for (var tail = 0; tail < 6; tail++) {
    var e = turn * 1.8 - tail * 0.09;
    ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.95 - tail * 0.15) + ')';
    ctx.beginPath();
    ctx.arc(
      wheel.x + Math.cos(e) * wheel.r,
      wheel.y + Math.sin(e) * wheel.r,
      dot * (1.5 - tail * 0.15),
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  // Gondolas in turn red, blue, yellow and green, hanging under the rim and kept upright.
  var colours = ['#d23a2e', '#3366cc', '#f2b632', '#3d9b5a'];
  for (var g = 0; g < 16; g++) {
    var c = turn + (g / 16) * Math.PI * 2 + 0.1;
    var gx = wheel.x + Math.cos(c) * wheel.r;
    var gy = wheel.y + Math.sin(c) * wheel.r;
    ctx.fillStyle = colours[g % colours.length];
    ctx.fillRect(gx - dot * 1.3, gy + dot * 0.5, dot * 2.6, dot * 2.2);
    ctx.fillStyle = 'rgba(255, 236, 190, 0.95)';
    ctx.fillRect(gx - dot * 0.8, gy + dot * 0.9, dot * 1.6, dot * 0.8);
  }
  // The hub.
  ctx.fillStyle = '#a3201a';
  ctx.beginPath();
  ctx.arc(wheel.x, wheel.y, dot * 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(wheel.x, wheel.y, dot * 0.9, 0, Math.PI * 2);
  ctx.fill();

  // Port Tower's light show: two soft bands of colour rising up the lattice.
  var tower = towerGeom(harbor.towerX, harbor.base, H);
  ctx.beginPath();
  for (var i = 0; i <= 24; i++) ctx.lineTo(tower.cx - tower.radius(i / 24), tower.yAt(i / 24));
  for (var j = 24; j >= 0; j--) ctx.lineTo(tower.cx + tower.radius(j / 24), tower.yAt(j / 24));
  ctx.closePath();
  ctx.clip();
  for (var k = 0; k < 2; k++) {
    var v = (t * 0.16 + k * 0.5) % 1;
    var y = tower.yAt(v);
    var band = (tower.base - tower.latticeTop) * 0.16;
    var hue = (t * 35 + k * 140) % 360;
    var glow = ctx.createLinearGradient(0, y - band, 0, y + band);
    glow.addColorStop(0, 'hsla(' + hue + ', 95%, 62%, 0)');
    glow.addColorStop(0.5, 'hsla(' + hue + ', 95%, 62%, 0.6)');
    glow.addColorStop(1, 'hsla(' + hue + ', 95%, 62%, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(tower.cx - tower.bottomR, y - band, tower.bottomR * 2, band * 2);
  }
  ctx.restore();
}

/**
 * The near brown hills, only where there is no city (11/18): the usual ridge on the left, sloping
 * down into the water a little before the waterfront begins, and flat (water level) after it.
 */
function nearRidgeOf(near, width, top, tall) {
  var H = Math.min(118, tall * 0.66);
  var end = towerXOf(width) - H * 3.6;
  var fadeFrom = end - Math.max(120, width * 0.08);
  return function (x) {
    if (x >= end) return top + 2;
    var y = near(x);
    if (x <= fadeFrom) return y;
    var u = (x - fadeFrom) / (end - fadeFrom);
    u = u * u * (3 - 2 * u);
    return y + (top + 2 - y) * u;
  };
}

/** Where Kobe Port Tower stands: right of the centred sign-in box. */
function towerXOf(width) {
  return width * (width < 760 ? 0.72 : 0.79);
}

/**
 * Kobe Port Tower (11/17), seen across the water: the red hourglass of steel pipes. The shape is
 * a hyperboloid, so it is drawn the way it is built: straight pipes between a wide ring at the
 * foot and a narrower one under the deck, twisted, which pulls the middle into a waist. On top
 * the observation deck with warm lit windows (it is evening), the roof and a mast with a red
 * light. Part of the still scenery, so it is reflected in the lake too.
 */
function drawPortTower(ctx, cx, base, H) {
  if (!(H > 30)) return;
  var geom = towerGeom(cx, base, H);
  var latticeTop = geom.latticeTop;
  var bottomR = geom.bottomR;
  var topR = geom.topR;
  var twist = geom.twist;
  var radius = geom.radius;
  var yAt = geom.yAt;
  ctx.save();
  ctx.globalAlpha = 0.94;

  // The pier it stands on.
  ctx.fillStyle = '#8c8f99';
  ctx.fillRect(cx - bottomR * 1.5, base - 3, bottomR * 3, 4);

  // A faint red body inside the lattice, so it reads as a solid tower from afar.
  ctx.fillStyle = 'rgba(205, 52, 40, 0.26)';
  ctx.beginPath();
  for (var i = 0; i <= 24; i++) ctx.lineTo(cx - radius(i / 24), yAt(i / 24));
  for (var j = 24; j >= 0; j--) ctx.lineTo(cx + radius(j / 24), yAt(j / 24));
  ctx.closePath();
  ctx.fill();

  // The observation floors sit inside the top of the lattice: pale walls, lit windows.
  var deckBottom = yAt(0.86);
  var deckR = radius(0.93) * 0.92;
  ctx.fillStyle = '#efe7df';
  ctx.fillRect(cx - deckR, latticeTop + 1, deckR * 2, deckBottom - latticeTop - 1);
  ctx.fillStyle = '#ffd98a';
  var floors = 3;
  var floorH = (deckBottom - latticeTop) / floors;
  for (var f = 0; f < floors; f++) {
    ctx.fillRect(
      cx - deckR + 1,
      latticeTop + floorH * f + floorH * 0.3,
      deckR * 2 - 2,
      floorH * 0.4,
    );
  }

  // The pipes: two families twisted opposite ways; the far side paler.
  ctx.lineWidth = Math.max(0.9, H / 95);
  var pipes = 18;
  [twist, -twist].forEach(function (turn) {
    for (var k = 0; k < pipes; k++) {
      var a = (k / pipes) * Math.PI * 2;
      var back = Math.sin(a) + Math.sin(a + turn) < 0;
      ctx.strokeStyle = back ? 'rgba(178, 40, 32, 0.42)' : '#d6372a';
      ctx.beginPath();
      ctx.moveTo(cx + bottomR * Math.cos(a), base);
      ctx.lineTo(cx + topR * Math.cos(a + turn), latticeTop);
      ctx.stroke();
    }
  });
  // Rings at the foot, the waist, under the floors and at the top.
  ctx.strokeStyle = '#c42f24';
  [0, 0.5, 0.86, 1].forEach(function (v) {
    var r = radius(v);
    ctx.beginPath();
    ctx.ellipse(cx, yAt(v), r, r * 0.12, 0, 0, Math.PI * 2);
    ctx.stroke();
  });

  // A flat red roof and the mast with its red light.
  var roofH = H * 0.035;
  ctx.fillStyle = '#c42f24';
  ctx.fillRect(cx - topR * 1.08, latticeTop - roofH, topR * 2.16, roofH);
  var mastTop = latticeTop - roofH - H * 0.13;
  ctx.strokeStyle = '#9b2a22';
  ctx.lineWidth = Math.max(1, H / 70);
  ctx.beginPath();
  ctx.moveTo(cx, latticeTop - roofH);
  ctx.lineTo(cx, mastTop);
  ctx.stroke();
  ctx.fillStyle = '#ff3b2f';
  ctx.beginPath();
  ctx.arc(cx, mastTop, Math.max(1.4, H / 60), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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

/** Koi body half-height along its length (u: 0 at the mouth, 1 at the tail's base). */
var KOI_BODY = [
  [0, 0.05],
  [0.07, 0.105],
  [0.22, 0.15],
  [0.42, 0.14],
  [0.66, 0.085],
  [0.86, 0.045],
  [1, 0.04],
];

function koiHalf(u) {
  for (var i = 1; i < KOI_BODY.length; i++) {
    if (u <= KOI_BODY[i][0]) {
      var a = KOI_BODY[i - 1];
      var b = KOI_BODY[i];
      var k = (u - a[0]) / (b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * (0.5 - 0.5 * Math.cos(k * Math.PI));
    }
  }
  return KOI_BODY[KOI_BODY.length - 1][1];
}

/**
 * One koi seen from the side (11/13), facing right in its own coordinates. A wave runs from the
 * head to the tail, so the body bends like a swimming snake, more towards the tail; the fins and
 * the tail follow the bend.
 */
function drawFish(ctx, fish) {
  var L = fish.length;
  var koi = fish.koi;
  var bodyLen = L * 0.86;
  var head = L * 0.46;
  var amp = 0.1 + Math.min(0.06, fish.boost / 2400);
  var N = 16;
  // Spine: x from the mouth backwards, y bending in a travelling wave.
  var spine = [];
  for (var i = 0; i <= N; i++) {
    var u = i / N;
    spine.push({
      u: u,
      x: head - u * bodyLen,
      y: L * amp * (0.08 + Math.pow(u, 1.6)) * Math.sin(u * 5.2 - fish.wag),
    });
  }
  var at = function (u) {
    var f = Math.max(0, Math.min(N, u * N));
    var i0 = Math.min(N - 1, Math.floor(f));
    var k = f - i0;
    return {
      x: spine[i0].x + (spine[i0 + 1].x - spine[i0].x) * k,
      y: spine[i0].y + (spine[i0 + 1].y - spine[i0].y) * k,
    };
  };

  ctx.save();
  ctx.translate(fish.x, fish.y);
  ctx.scale(fish.dir, 1);
  ctx.rotate(Math.cos(fish.wander) * 0.05);
  // Just under the water: a little softer further away.
  ctx.globalAlpha = 0.72 + 0.25 * fish.depth;

  // Shadow on the lake bed.
  ctx.fillStyle = 'rgba(20, 60, 90, 0.16)';
  ctx.beginPath();
  ctx.ellipse(-L * 0.05, L * 0.3, L * 0.48, L * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = koi.fin;
  // Tail fin, turned with the end of the spine.
  var end = spine[N];
  var prev = spine[N - 2];
  var turn = Math.atan2(end.y - prev.y, end.x - prev.x) - Math.PI;
  ctx.save();
  ctx.translate(end.x, end.y);
  ctx.rotate(turn);
  ctx.beginPath();
  ctx.moveTo(0, -L * 0.035);
  ctx.bezierCurveTo(-L * 0.08, -L * 0.08, -L * 0.18, -L * 0.2, -L * 0.27, -L * 0.2);
  ctx.quadraticCurveTo(-L * 0.17, -L * 0.03, -L * 0.2, 0);
  ctx.quadraticCurveTo(-L * 0.17, L * 0.03, -L * 0.27, L * 0.2);
  ctx.bezierCurveTo(-L * 0.18, L * 0.2, -L * 0.08, L * 0.08, 0, L * 0.035);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Dorsal fin along the back, following the bend.
  ctx.beginPath();
  var d0 = at(0.26);
  ctx.moveTo(d0.x, d0.y - koiHalf(0.26) * L);
  for (var du = 0.3; du <= 0.66; du += 0.06) {
    var dp = at(du);
    var rise = Math.sin(((du - 0.26) / 0.4) * Math.PI * 0.9) * 0.09 + 0.02;
    ctx.lineTo(dp.x - L * 0.03, dp.y - (koiHalf(du) + rise) * L);
  }
  var d1 = at(0.68);
  ctx.lineTo(d1.x, d1.y - koiHalf(0.68) * L);
  ctx.closePath();
  ctx.fill();

  // Fins underneath: the pectoral fin paddles, the pelvic fin and the small anal fin behind.
  var paddle = Math.sin(fish.wag * 1.3) * 0.25;
  [
    [0.16, 0.09, 0.035, 0.7 + paddle],
    [0.42, 0.06, 0.028, 0.6],
    [0.66, 0.05, 0.022, 0.5],
  ].forEach(function (fin) {
    var fp = at(fin[0]);
    ctx.beginPath();
    ctx.ellipse(
      fp.x - L * fin[1] * 0.6,
      fp.y + koiHalf(fin[0]) * L + L * fin[2],
      L * fin[1],
      L * fin[2],
      fin[3],
      0,
      Math.PI * 2,
    );
    ctx.fill();
  });

  // Body: top edge from the mouth to the tail, then the belly back to the mouth.
  ctx.beginPath();
  ctx.moveTo(head + L * 0.035, spine[0].y + L * 0.005);
  for (var t1 = 0; t1 <= N; t1++) {
    ctx.lineTo(spine[t1].x, spine[t1].y - koiHalf(spine[t1].u) * L);
  }
  for (var t2 = N; t2 >= 0; t2--) {
    ctx.lineTo(spine[t2].x, spine[t2].y + koiHalf(spine[t2].u) * L * 0.95);
  }
  ctx.closePath();
  ctx.fillStyle = koi.body;
  ctx.fill();

  ctx.save();
  ctx.clip();
  // Koi patches, mostly on the back, moving with the body.
  koi.spots.forEach(function (spot) {
    var su = Math.max(0, Math.min(1, (0.5 - spot[0]) / 0.88));
    var sp = at(su);
    ctx.fillStyle = spot[4];
    ctx.beginPath();
    ctx.ellipse(
      sp.x,
      sp.y - L * 0.05 + spot[1] * L,
      spot[2] * L * 1.1,
      spot[3] * L * 1.25,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  });
  // Pale belly, a light along the back, faint scales.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.beginPath();
  for (var b1 = 0; b1 <= N; b1++) {
    var bp = spine[b1];
    var bh = koiHalf(bp.u) * L;
    if (b1 === 0) ctx.moveTo(bp.x, bp.y + bh * 0.35);
    else ctx.lineTo(bp.x, bp.y + bh * 0.35);
  }
  for (var b2 = N; b2 >= 0; b2--) ctx.lineTo(spine[b2].x, spine[b2].y + koiHalf(spine[b2].u) * L);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
  ctx.lineWidth = 0.8;
  for (var k2 = 0.24; k2 < 0.8; k2 += 0.1) {
    var kp = at(k2);
    var kh = koiHalf(k2) * L;
    ctx.beginPath();
    ctx.arc(kp.x + kh * 0.5, kp.y, kh * 0.8, Math.PI * 0.62, Math.PI * 1.38);
    ctx.stroke();
  }
  ctx.restore();

  // Gill line, eye and whiskers.
  var g = at(0.13);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(g.x + L * 0.05, g.y, koiHalf(0.13) * L * 0.85, Math.PI * 0.6, Math.PI * 1.4);
  ctx.stroke();
  var e = at(0.05);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(e.x, e.y - L * 0.03, Math.max(1.2, L * 0.03), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(25, 25, 30, 0.9)';
  ctx.beginPath();
  ctx.arc(e.x + L * 0.005, e.y - L * 0.03, Math.max(0.8, L * 0.018), 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = koi.fin;
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  var mouth = spine[0];
  ctx.beginPath();
  ctx.moveTo(head + L * 0.02, mouth.y + L * 0.03);
  ctx.quadraticCurveTo(head + L * 0.04, mouth.y + L * 0.08, head + L * 0.0, mouth.y + L * 0.11);
  ctx.stroke();
  ctx.restore();
}

/** Moves the fish; they swim back in from the side they left, at a new depth. */
function swimFish(list, dt, width, height, top) {
  for (var i = 0; i < list.length; i++) {
    var f = list[i];
    f.wander += dt * 0.6;
    f.wag += dt * (4 + f.boost / 14);
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

/** Where the moon is: the top-left corner; large on wide screens, smaller on phones. */
function sunOf(width) {
  if (width < 640) return { x: 50, y: 50, r: 30 };
  if (width < 1024) return { x: 70, y: 70, r: 42 };
  if (width < 1320) return { x: 76, y: 76, r: 48 };
  return { x: 100, y: 100, r: 68 };
}

/**
 * Whether a point on the screen is on the moon (11/17): the sign-in screen's grid skips its
 * click ripple there, so a click on the moon shows only the moon's own animation.
 */
export function isOnMoon(x, y, width) {
  var moon = sunOf(width);
  return Math.hypot(x - moon.x, y - moon.y) <= moon.r * 1.1;
}

/** The mallet (杵): pointing at the mortar when down, raised over the rabbit's head when up. */
var MALLET_DOWN = Math.PI + 0.06;
var MALLET_UP = Math.PI + 1.5;
/** Soft craters on the moon: [x, y, rx, ry] in unit size. */
var CRATERS = [
  [-0.45, -0.55, 0.22, 0.14],
  [0.5, -0.5, 0.16, 0.12],
  [0.62, 0.42, 0.13, 0.1],
  [-0.66, 0.2, 0.1, 0.14],
  [0.05, -0.78, 0.12, 0.07],
];

/** A little four-pointed sparkle. */
function sparkle(ctx, x, y, size) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.quadraticCurveTo(x, y, x + size, y);
  ctx.quadraticCurveTo(x, y, x, y + size);
  ctx.quadraticCurveTo(x, y, x - size, y);
  ctx.quadraticCurveTo(x, y, x, y - size);
  ctx.fill();
}

/** One rabbit sitting up, facing right (`face` 1) or left (-1), in the moon's unit size. */
function moonRabbit(ctx, x, y, face, lean) {
  ctx.save();
  ctx.translate(x, y + 0.26);
  ctx.rotate(lean * face);
  ctx.translate(0, -0.26);
  ctx.scale(face, 1);
  // Body, feet and the round tail.
  ctx.beginPath();
  ctx.ellipse(0, 0.04, 0.16, 0.24, 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0.03, 0.27, 0.14, 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-0.13, 0.13, 0.065, 0, Math.PI * 2);
  ctx.fill();
  // Head and two long ears, leaning back a little.
  ctx.beginPath();
  ctx.ellipse(0.07, -0.26, 0.11, 0.1, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-0.04, -0.47, 0.04, 0.16, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0.06, -0.5, 0.04, 0.16, -0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * The moon (11/13–14, after the senior's requests, as in the classic 月のうさぎ picture): a
 * large pale disc with soft craters and two rabbits making mochi. The one on the right swings
 * the mallet over its head and brings it down; the one on the left kneels at the mortar and
 * turns the mochi between strikes, pulling its paws back just before each one.
 * `poked`: seconds since the moon was clicked — it bounces, the rabbits hop and sparkles fly.
 */
function drawSun(ctx, sun, t, poked) {
  var r = sun.r;
  var p = poked >= 0 && poked < 1.2 ? poked / 1.2 : -1;
  ctx.save();
  ctx.translate(sun.x, sun.y);

  // Soft glow, breathing slowly; brighter for a moment after a click.
  var breath = 0.5 + 0.5 * Math.sin(t * 0.8);
  var flash = p >= 0 ? 1 - p : 0;
  var glow = ctx.createRadialGradient(0, 0, r * 0.8, 0, 0, r * (2 + 0.15 * breath + 0.4 * flash));
  // A cool silver glow (11/17: the お月見 moon, not a gold one).
  glow.addColorStop(0, 'rgba(244, 247, 255, ' + (0.6 + 0.3 * flash).toFixed(3) + ')');
  glow.addColorStop(1, 'rgba(244, 247, 255, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.6, 0, Math.PI * 2);
  ctx.fill();

  // Sparkles flying out after a click.
  if (p >= 0) {
    for (var i = 0; i < 12; i++) {
      var a = (i / 12) * Math.PI * 2 + 0.3;
      var dist = r * (1.05 + 0.9 * Math.sqrt(p) + (i % 3) * 0.08);
      ctx.fillStyle =
        'rgba(' + (i % 2 ? '226, 234, 255' : '255, 255, 255') + ', ' + (1 - p).toFixed(3) + ')';
      sparkle(
        ctx,
        Math.cos(a) * dist,
        Math.sin(a) * dist,
        r * (0.09 + (i % 2) * 0.04) * (1 - p * 0.5),
      );
    }
  }

  // The moon bounces when clicked.
  var bounce = p >= 0 ? 1 + 0.08 * Math.sin(p * Math.PI * 3) * (1 - p) : 1;
  ctx.scale(bounce, bounce);
  var disc = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  // Pale silvery white with a breath of cream, as the moon is drawn for お月見.
  disc.addColorStop(0, '#ffffff');
  disc.addColorStop(0.55, '#f6f4ec');
  disc.addColorStop(1, '#dcdde6');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.98, 0, Math.PI * 2);
  ctx.clip();
  ctx.scale(r, r);
  ctx.fillStyle = 'rgba(160, 168, 190, 0.2)';
  CRATERS.forEach(function (c) {
    ctx.beginPath();
    ctx.ellipse(c[0], c[1], c[2], c[3], 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Rabbits and mortar: soft blue-grey shadows on the silver, the 月のうさぎ people see in the
  // real moon; where they overlap they look a little deeper.
  ctx.save();
  ctx.translate(0, -0.04);
  ctx.scale(1.14, 1.14);
  var mark = 'rgba(122, 132, 160, 0.5)';
  ctx.fillStyle = mark;
  ctx.strokeStyle = mark;
  ctx.lineCap = 'round';
  // After a click both rabbits hop.
  var hop = p >= 0 && p < 0.6 ? -0.12 * Math.sin((p / 0.6) * Math.PI) : 0;

  // Pounding: a slow lift (65% of the beat), then a quick strike.
  var beat = (t * 0.7) % 1;
  var lift = beat < 0.65 ? Math.sin((beat / 0.65) * Math.PI * 0.5) : 1 - (beat - 0.65) / 0.35;
  var hit = beat > 0.96 || beat < 0.05 ? 1 : 0;
  var angle = MALLET_DOWN + (MALLET_UP - MALLET_DOWN) * lift;
  // The turner reaches in while the mallet is up and pulls back before it comes down.
  var reach = beat > 0.12 && beat < 0.62 ? Math.sin(((beat - 0.12) / 0.5) * Math.PI) : 0;

  // Mortar (臼) in the middle, with the mochi on top.
  ctx.beginPath();
  ctx.moveTo(-0.2, 0.12);
  ctx.lineTo(0.2, 0.12);
  ctx.lineTo(0.16, 0.56);
  ctx.lineTo(-0.16, 0.56);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 0.12, 0.22, 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
  ctx.beginPath();
  ctx.ellipse(0, 0.09 + hit * 0.01, 0.14 + hit * 0.03, 0.05 - hit * 0.012, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = mark;

  // Left rabbit: kneels at the mortar and turns the mochi.
  moonRabbit(ctx, -0.46, 0.22 + hop, 1, 0.12 + reach * 0.22);
  ctx.lineWidth = 0.07;
  ctx.beginPath();
  ctx.moveTo(-0.36, 0.14 + hop);
  ctx.quadraticCurveTo(
    -0.26 + reach * 0.06,
    0.02 + hop,
    -0.24 + reach * 0.2,
    0.08 + hop - reach * 0.02,
  );
  ctx.stroke();

  // Right rabbit: stands and swings the mallet.
  moonRabbit(ctx, 0.5, 0.2 + hop, -1, -0.04 + lift * 0.08);
  var px = 0.34;
  var py = 0.04 + hop;
  ctx.lineWidth = 0.07;
  ctx.beginPath();
  ctx.moveTo(0.44, 0.1 + hop);
  ctx.lineTo(px, py);
  ctx.stroke();
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(angle);
  ctx.lineWidth = 0.045;
  ctx.beginPath();
  ctx.moveTo(-0.05, 0);
  ctx.lineTo(0.27, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0.31, 0, 0.06, 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // A small puff of flour at each strike.
  if (hit) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    [
      [-0.16, 0.0],
      [0.15, -0.02],
      [0.0, -0.06],
    ].forEach(function (d) {
      ctx.beginPath();
      ctx.arc(d[0], d[1], 0.025, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  ctx.restore();
  ctx.restore();

  // A thin bright rim.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = Math.max(1, r * 0.03);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.99, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  drawSusuki(ctx, sun, t);
}

/**
 * すすき (11/17, 11/18): pampas grass inside the moon, along its lower right edge, as in every
 * お月見 picture with the moon, the rabbits and the mochi (11/18: drawn outside the moon it looked
 * like strings hanging in the air). A few stalks leaning to the right with feathery plumes,
 * swaying a little, cut to the moon's disc. Soft silhouettes, so the rabbits stay in view.
 */
function drawSusuki(ctx, sun, t) {
  var r = sun.r;
  ctx.save();
  ctx.translate(sun.x, sun.y);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.97, 0, Math.PI * 2);
  ctx.clip();
  ctx.lineCap = 'round';
  // [foot x, height, lean, sway phase] in moon radii; the feet sit below the disc's edge.
  var stalks = [
    [0.02, 0.62, 0.42, 0],
    [0.18, 0.74, 0.5, 1.3],
    [0.34, 0.66, 0.6, 2.1],
    [0.5, 0.52, 0.66, 3.4],
  ];
  var footY = r * 1.02;
  stalks.forEach(function (s) {
    var sway = Math.sin(t * 0.9 + s[3]) * 0.05;
    var baseX = s[0] * r;
    var tall = s[1] * r;
    var lean = s[2] + sway;
    var tipX = baseX + Math.sin(lean) * tall;
    var tipY = footY - Math.cos(lean) * tall;
    // The stalk, curving a little.
    ctx.strokeStyle = 'rgba(86, 80, 102, 0.7)';
    ctx.lineWidth = Math.max(1, r * 0.022);
    ctx.beginPath();
    ctx.moveTo(baseX, footY);
    ctx.quadraticCurveTo(baseX + (tipX - baseX) * 0.2, footY - (footY - tipY) * 0.6, tipX, tipY);
    ctx.stroke();
    // The plume: soft feathers drooping from the top, warm gold against the silver.
    for (var f = 0; f < 6; f++) {
      var u = f / 5;
      var fx = tipX - Math.sin(lean) * u * r * 0.22;
      var fy = tipY + Math.cos(lean) * u * r * 0.22;
      var side = f % 2 ? 1 : -1;
      ctx.strokeStyle = 'rgba(176, 142, 98, ' + (0.85 - u * 0.3).toFixed(3) + ')';
      ctx.lineWidth = Math.max(1, r * 0.024);
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.quadraticCurveTo(
        fx + side * r * 0.07,
        fy + r * 0.015,
        fx + side * r * (0.08 + sway * 0.5),
        fy + r * 0.09,
      );
      ctx.stroke();
    }
    // One long leaf from the foot.
    ctx.strokeStyle = 'rgba(86, 80, 102, 0.5)';
    ctx.lineWidth = Math.max(1, r * 0.018);
    ctx.beginPath();
    ctx.moveTo(baseX, footY);
    ctx.quadraticCurveTo(
      baseX - r * 0.12,
      footY - tall * 0.4,
      baseX - r * (0.3 - sway),
      footY - tall * 0.28,
    );
    ctx.stroke();
  });
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

/**
 * Mt. Fuji (11/16, redrawn 11/17 to look like the real mountain): a wide base with slopes that
 * curve in and steepen towards a short flat summit, blue-violet rock fading into haze below,
 * and a snow cap whose lower edge runs down the gullies in long white streaks.
 */
function fujiShape(x, top, tall) {
  var H = tall * 1.55;
  var half = tall * 2.7;
  var summit = half * 0.075;
  return {
    x: x,
    top: top,
    H: H,
    half: half,
    summit: summit,
    heightAt: function (d) {
      var a = Math.abs(d);
      if (a <= summit) return H - 1.6 * Math.abs(Math.sin(d * 0.55));
      var u = Math.min(1, (a - summit) / (half - summit));
      return H * Math.pow(1 - u, 1.75);
    },
  };
}

/**
 * Where Mt. Fuji stands on a screen of this size (11/17), the same as drawn: the sign-in screen
 * uses it so MoraBot can play hide-and-seek behind the slope. `ridge(x)` is the slope's screen y.
 */
export function fujiOf(width, height) {
  var top = lakeTopOf(height);
  var tall = Math.min(200, height * 0.21);
  var shape = fujiShape(toriiOf(width, height, top).x + 30, top, tall);
  return {
    x: shape.x,
    top: top,
    height: shape.H,
    half: shape.half,
    summit: shape.summit,
    ridge: function (sx) {
      return top - shape.heightAt(sx - shape.x);
    },
  };
}

function drawFuji(ctx, x, top, tall) {
  var shape = fujiShape(x, top, tall);
  var H = shape.H;
  var half = shape.half;
  var summit = shape.summit;
  var peak = top - H;
  var heightAt = shape.heightAt;
  var outline = function () {
    ctx.beginPath();
    ctx.moveTo(x - half, top + 2);
    for (var d = -half; d <= half; d += 2) ctx.lineTo(x + d, top - heightAt(d));
    ctx.lineTo(x + half, top + 2);
    ctx.closePath();
  };
  var body = ctx.createLinearGradient(0, peak, 0, top);
  body.addColorStop(0, '#5d6c95');
  body.addColorStop(0.45, '#7c8bb0');
  body.addColorStop(1, '#b3bfd5');
  ctx.fillStyle = body;
  outline();
  ctx.fill();

  ctx.save();
  outline();
  ctx.clip();
  // Shade on the right slope, light on the left.
  var shade = ctx.createLinearGradient(x - half * 0.5, 0, x + half * 0.6, 0);
  shade.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
  shade.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
  shade.addColorStop(1, 'rgba(30, 40, 80, 0.2)');
  ctx.fillStyle = shade;
  ctx.fillRect(x - half, peak - 4, half * 2, H + 8);

  // Snow: a cap down to about a third with a softly uneven edge, then thin streaks that run
  // down the gullies along the slope, fanning outward and tapering to a point.
  var rand = seeded(2217);
  var capAt = function (d) {
    return (
      H * (0.27 + 0.025 * Math.sin(d * 0.21) + 0.02 * Math.sin(d * 0.53 + 1.3)) + Math.abs(d) * 0.05
    );
  };
  var snow = ctx.createLinearGradient(x - half * 0.3, 0, x + half * 0.3, 0);
  snow.addColorStop(0, '#ffffff');
  snow.addColorStop(0.55, '#f3f6fb');
  snow.addColorStop(1, '#d2dcec');
  ctx.fillStyle = snow;
  ctx.beginPath();
  ctx.moveTo(x - half, peak - 6);
  ctx.lineTo(x + half, peak - 6);
  for (var d2 = half * 0.6; d2 >= -half * 0.6; d2 -= 1.5) ctx.lineTo(x + d2, peak + capAt(d2));
  ctx.closePath();
  ctx.fill();
  // Where along the slope a point at horizontal offset d sits, just inside the surface.
  var surface = function (d) {
    return top - heightAt(d) + 1.5;
  };
  for (var i = 0; i < 26; i++) {
    var at = (i / 25 - 0.5) * half * 0.62 + (rand() - 0.5) * 5;
    var startY = peak + capAt(at) - 2;
    // Mostly short, now and then a long one, as on the real mountain in late autumn.
    var len = H * (0.06 + Math.pow(rand(), 2) * 0.42);
    var spread = 1 + (len / H) * 1.4;
    var endD = at * spread + (at >= 0 ? 1 : -1) * len * 0.12;
    var endY = Math.min(surface(endD), startY + len);
    var w = 1.5 + rand() * 4;
    ctx.beginPath();
    ctx.moveTo(x + at - w, startY);
    ctx.quadraticCurveTo(x + (at + endD) / 2 - w * 0.4, (startY + endY) / 2, x + endD, endY);
    ctx.quadraticCurveTo(x + (at + endD) / 2 + w * 0.4, (startY + endY) / 2, x + at + w, startY);
    ctx.closePath();
    ctx.fill();
  }
  // Haze at the foot.
  var haze = ctx.createLinearGradient(0, top - H * 0.35, 0, top);
  haze.addColorStop(0, 'rgba(225, 215, 230, 0)');
  haze.addColorStop(1, 'rgba(225, 215, 230, 0.55)');
  ctx.fillStyle = haze;
  ctx.fillRect(x - half, top - H * 0.35, half * 2, H * 0.35 + 2);
  ctx.restore();
}

/** Where the floating torii stands: in the lake on the left, near the far shore. */
function toriiOf(width, height, top) {
  var h = Math.max(46, Math.min(84, (height - top) * 0.36));
  return {
    x: width < 760 ? Math.max(70, width * 0.13) : Math.max(110, width * 0.1),
    y: top + 26,
    h: h,
  };
}

/**
 * A floating torii (11/16), like the great gate of Itsukushima standing in the sea: vermilion
 * pillars and beams, the black top beam curving up at the ends, and its reflection in the water.
 */
function drawTorii(ctx, torii, t) {
  var H = torii.h;
  var W = H * 1.15;
  ctx.save();
  ctx.translate(torii.x, torii.y);
  var red = '#d6401f';
  var dark = '#a82c14';
  var paint = function (reflect) {
    ctx.fillStyle = red;
    // Pillars, a little wider at the foot.
    [-1, 1].forEach(function (side) {
      var px = side * W * 0.3;
      ctx.beginPath();
      ctx.moveTo(px - W * 0.035, -H * 0.86);
      ctx.lineTo(px + W * 0.035, -H * 0.86);
      ctx.lineTo(px + W * 0.045, 0);
      ctx.lineTo(px - W * 0.045, 0);
      ctx.closePath();
      ctx.fill();
    });
    // Lower beam (貫) through the pillars, and the centre post with its plaque.
    ctx.fillRect(-W * 0.42, -H * 0.66, W * 0.84, H * 0.065);
    ctx.fillRect(-W * 0.03, -H * 0.84, W * 0.06, H * 0.2);
    ctx.fillStyle = reflect ? red : '#1f1f1f';
    ctx.fillRect(-W * 0.065, -H * 0.8, W * 0.13, H * 0.11);
    // Top beams: the red one (島木) under the black, upturned 笠木.
    ctx.fillStyle = red;
    ctx.fillRect(-W * 0.47, -H * 0.88, W * 0.94, H * 0.06);
    ctx.fillStyle = reflect ? dark : '#262626';
    ctx.beginPath();
    ctx.moveTo(-W * 0.58, -H * 1.0);
    ctx.quadraticCurveTo(-W * 0.3, -H * 0.92, 0, -H * 0.93);
    ctx.quadraticCurveTo(W * 0.3, -H * 0.92, W * 0.58, -H * 1.0);
    ctx.lineTo(W * 0.52, -H * 0.88);
    ctx.quadraticCurveTo(0, -H * 0.86, -W * 0.52, -H * 0.88);
    ctx.closePath();
    ctx.fill();
  };
  // Reflection first, wobbling with the water.
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.translate(Math.sin(t * 1.3) * 1.5, 2);
  ctx.scale(1 + Math.sin(t * 2.1) * 0.015, -0.8);
  paint(true);
  ctx.restore();
  paint(false);
  // Light on the left side of the pillars.
  ctx.fillStyle = 'rgba(255, 230, 200, 0.25)';
  [-1, 1].forEach(function (side) {
    ctx.fillRect(side * W * 0.3 - W * 0.035, -H * 0.86, W * 0.022, H * 0.86);
  });
  // Water at the pillars' feet.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 1.2;
  [-1, 1].forEach(function (side) {
    ctx.beginPath();
    ctx.ellipse(side * W * 0.3, 0, W * 0.09 + Math.sin(t * 2 + side) * 1.2, 2.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.restore();
}

/** おみくじ (11/16): a click on the torii draws a fortune — only good ones. */
var FORTUNES = [
  ['大吉', '今日はアポが取れる日！'],
  ['大吉', 'いい知らせが届きそう'],
  ['中吉', 'いい商談になりそう'],
  ['吉', '一本の電話がご縁に'],
  ['小吉', 'コツコツが実を結ぶ'],
  ['末吉', '午後から運気上昇'],
];

function drawFortune(ctx, fortune, torii) {
  var p = fortune.age / 3.2;
  if (p >= 1) return false;
  var fade = p < 0.12 ? p / 0.12 : p > 0.75 ? 1 - (p - 0.75) / 0.25 : 1;
  var rise = 26 * Math.sin(Math.min(1, p * 2.2) * Math.PI * 0.5);
  var x = torii.x;
  var y = torii.y - torii.h - 46 - rise;
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(x, y);
  ctx.rotate(Math.sin(fortune.age * 3) * 0.03);
  var w = 150;
  var h = 64;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
  ctx.fillRect(-w / 2 + 2, -h / 2 + 3, w, h);
  ctx.fillStyle = '#fffdf6';
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = '#d6401f';
  ctx.lineWidth = 2;
  ctx.strokeRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6);
  ctx.fillStyle = '#d6401f';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = "700 22px 'Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif JP', serif";
  ctx.fillText(fortune.text[0], 0, -10);
  ctx.fillStyle = '#4a3a2a';
  ctx.font = "600 12px 'Hiragino Sans', 'Noto Sans JP', 'Yu Gothic', sans-serif";
  ctx.fillText(fortune.text[1], 0, 15);
  ctx.restore();
  return true;
}

/** A shooting star (流れ星) crossing the upper sky, its tail fading behind it. */
function newShootingStar(width, top) {
  var dir = Math.random() < 0.5 ? -1 : 1;
  return {
    x: width * (0.15 + Math.random() * 0.7),
    y: 10 + Math.random() * top * 0.3,
    vx: dir * (170 + Math.random() * 70),
    vy: 70 + Math.random() * 35,
    age: 0,
    life: 1.9 + Math.random() * 0.6,
  };
}

function drawShootingStar(ctx, star) {
  var p = star.age / star.life;
  var fade = p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8;
  var hx = star.x + star.vx * star.age;
  var hy = star.y + star.vy * star.age;
  var tail = 0.4;
  var tx = hx - star.vx * tail;
  var ty = hy - star.vy * tail;
  var streak = ctx.createLinearGradient(hx, hy, tx, ty);
  streak.addColorStop(0, 'rgba(255, 252, 235, ' + (0.95 * fade).toFixed(3) + ')');
  streak.addColorStop(1, 'rgba(255, 252, 235, 0)');
  ctx.strokeStyle = streak;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  // A soft glow around the head, twinkling as it goes.
  var shine = 0.75 + 0.25 * Math.sin(star.age * 18);
  var halo = ctx.createRadialGradient(hx, hy, 0, hx, hy, 7);
  halo.addColorStop(0, 'rgba(255, 255, 245, ' + (0.7 * fade * shine).toFixed(3) + ')');
  halo.addColorStop(1, 'rgba(255, 255, 245, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(hx, hy, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 245, ' + fade.toFixed(3) + ')';
  ctx.beginPath();
  ctx.arc(hx, hy, 1.8, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Starts the leaves on a full-screen canvas. Returns a function that stops them.
 * Nothing moves for people who prefer reduced motion; it pauses while the tab is hidden.
 *
 * `lake: true` (sign-in screen, request 11/13): instead of a pile, a calm lake along the bottom.
 * Leaves land on the water with a small ripple and sink within two seconds (11/17), so the lake
 * stays clean; a click or tap on the water sends a ripple that pushes the nearby leaves away and
 * keeps them a few seconds more.
 */
/** Loads the statue artwork once, then has the scenery drawn again with it. */
function loadStatue(src, redraw) {
  if (!src || STATUE) return;
  var image = new Image();
  image.onload = function () {
    STATUE = image;
    redraw();
  };
  image.src = src;
}

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
      drawSun(ctx, moon, 0, -1);
      drawLake(ctx, w, h, top, 0, []);
      drawScenery(ctx, scenery, w, h, top, true);
      drawHarborLights(ctx, scenery && scenery.harbor, 0);
      drawTorii(ctx, toriiOf(w, h, top), 0);
      drawFisher(ctx, fisherOf(w, h), 0, 0);
      drawCroc(ctx, crocOf(w, h), 0, { x: 0.6, y: -0.2 }, 0);
    };
    still();
    loadStatue(opts.statue, still);
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
  var fish = [];
  var croc = crocOf(0, 0);
  var look = { x: 0.6, y: -0.2 };
  var pointer = null;
  var nextBlink = 3;
  var blinkAt = -1;
  var nextCrocRing = 0;
  var sun = sunOf(0);
  var moonPokedAt = -10;
  var stars = [];
  var torii = toriiOf(0, 0, 0);
  var fortune = null;
  var shooting = null;
  var nextShooting = 1.5;
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
      torii = toriiOf(width, height, lakeTop);
      if (EVENING) stars = makeStars(width, lakeTop, sun);
      fisher = fisherOf(width, height);
    }
    floating = floating.filter(function (leaf) {
      return leaf.y0 > lakeTop && leaf.y0 < height;
    });
  }

  for (var s = 0; s < 8; s++) {
    // A little smaller (11/17): 10–17px instead of 15–27px, so they don't crowd the scene.
    var size = 10 + Math.random() * 7;
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
      drift: 1.5 + Math.random() * 2.5,
      bob: Math.random() * Math.PI * 2,
      angle: leaf.angle,
      spin: (Math.random() - 0.5) * 0.25,
      // Lying flat, seen across the water: smaller and flatter than in the air (11/17).
      scale: 0.7,
      squash: 0.34 + Math.random() * 0.08,
      // It only touches the water and sinks in under two seconds, so the lake stays clean
      // (11/17: leaves floating for half a minute piled up and made the water look untidy).
      life: 1.6 + Math.random() * 0.4,
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
    if (!lake) return;
    // A click on the moon: it bounces, the rabbits hop and sparkles fly.
    var mx = event.clientX - sun.x;
    var my = event.clientY - sun.y;
    if (Math.sqrt(mx * mx + my * my) <= sun.r * 1.1) {
      moonPokedAt = clock;
      return;
    }
    // A click on the torii draws an おみくじ.
    var tw = torii.h * 0.7;
    if (
      Math.abs(event.clientX - torii.x) <= tw &&
      event.clientY <= torii.y + 6 &&
      event.clientY >= torii.y - torii.h - 8
    ) {
      var pick = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
      fortune = { text: pick, age: 0 };
      ripples.push({ x: torii.x, y: torii.y, age: 0, size: torii.h * 1.6, strength: 0.8 });
      return;
    }
    if (event.clientY < lakeTop + 4) return;
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
        // Pushed by a click, it stays a few seconds more to be seen drifting away.
        leaf.life = Math.max(leaf.life, leaf.age + 4);
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

  /**
   * A leaf lying on the water: turned in its own plane first, then flattened in screen terms,
   * as seen from the shore (squashing after the turn made a sideways leaf look full size).
   */
  function drawFlat(sprite, x, y, angle, size, squash, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(size, size * squash);
    ctx.rotate(angle);
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
            nextShooting = clock + 2.5 + Math.random() * 2.5;
          } else drawShootingStar(ctx, shooting);
        }
      }
      drawSun(ctx, sun, clock, clock - moonPokedAt);
      drawLake(ctx, width, height, lakeTop, clock, streaks);
      drawScenery(ctx, scenery, width, height, lakeTop, true);
      drawHarborLights(ctx, scenery && scenery.harbor, clock);
      drawTorii(ctx, torii, clock);
      swimFish(fish, dt, width, height, lakeTop);
      fish.sort(function (a, b) {
        return a.y - b.y;
      });
      fish.forEach(function (f) {
        drawFish(ctx, f);
      });
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
        // Sinking: over its last second it shrinks a little and fades into the water.
        var left = fl.life - fl.age;
        var alpha = Math.max(0, Math.min(1, left / 1.1));
        if (alpha <= 0 || fl.x > width + 40 || fl.x < -40) {
          floating.splice(m, 1);
          continue;
        }
        var size = fl.scale * (0.75 + 0.25 * alpha);
        var fy = fl.y0 + Math.sin(fl.bob) * 0.8;
        // Its faint reflection, then the leaf lying flat on the water.
        drawFlat(
          fl.sprite,
          fl.x,
          fy + fl.sprite.size * 0.18,
          fl.angle,
          size,
          -fl.squash,
          alpha * 0.14,
        );
        drawFlat(fl.sprite, fl.x, fy, fl.angle, size, fl.squash, alpha);
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
      if (fortune) {
        fortune.age += dt;
        if (!drawFortune(ctx, fortune, torii)) fortune = null;
      }

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
  if (lake)
    loadStatue(opts.statue, function () {
      if (width > 0) scenery = buildScenery(width, height, lakeTop, ratio);
    });
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
