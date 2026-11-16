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
 * overhead turning peach at the mountains, with the moon and Japan drawn in stars.
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
      // Mt. Fuji rises from the far range, behind the torii (11/16).
      drawFuji(ctx, toriiOf(width, height, top).x + 30, top, tall);
    }
  });

  // The falls (11/16, after 布引の滝 in Shin-Kobe): a granite cliff with boulders and autumn
  // trees, a small reservoir behind an old stone dam at the top, the water dropping in two
  // tiers onto a rock ledge and into the lake. The moving water is drawn in drawWaterfall.
  var lipY = top - tall * 0.8;
  var crestY = lipY - 10;
  var midY = lipY + (top - lipY) * 0.46;
  var fallTop = crestY;
  var fx = fallX;
  // Kept modest so it sits in the scene rather than taking it over (11/16); smaller on phones.
  var fallScale = width < 760 ? 0.5 : 0.7;
  ctx.save();
  ctx.translate(fx, top);
  ctx.scale(fallScale, fallScale);
  ctx.translate(-fx, -top);
  // The cliff rises out of the middle range: a flat notch for the dam, shoulders sloping away.
  var shoulder = top - tall * 0.26;
  var cliffTop = function (cx) {
    var d = Math.abs(cx - fx);
    if (d <= 46) return lipY - 16;
    if (d >= 175) return shoulder;
    var k = (d - 46) / 129;
    return (
      lipY -
      16 +
      (shoulder - (lipY - 16)) * (0.5 - 0.5 * Math.cos(k * Math.PI)) +
      Math.sin(cx * 0.21) * 3
    );
  };
  var cliffFill = ctx.createLinearGradient(fx - 175, 0, fx + 175, 0);
  cliffFill.addColorStop(0, 'rgba(156, 173, 191, 1)');
  cliffFill.addColorStop(0.3, '#7b808d');
  cliffFill.addColorStop(0.5, '#5b606c');
  cliffFill.addColorStop(0.7, '#7b808d');
  cliffFill.addColorStop(1, 'rgba(156, 173, 191, 1)');
  ctx.fillStyle = cliffFill;
  ctx.beginPath();
  ctx.moveTo(fx - 180, top + 2);
  for (var cx = fx - 180; cx <= fx + 180; cx += 4) ctx.lineTo(cx, cliffTop(cx));
  ctx.lineTo(fx + 180, top + 2);
  ctx.closePath();
  ctx.fill();
  // Rock strata: faint slanted lines on the face.
  ctx.strokeStyle = 'rgba(40, 44, 52, 0.18)';
  ctx.lineWidth = 1;
  for (var sl = 0; sl < 9; sl++) {
    var sy = lipY + 8 + sl * ((top - lipY) / 9);
    ctx.beginPath();
    ctx.moveTo(fx - 120 + sl * 6, sy + 6);
    ctx.quadraticCurveTo(fx - 70, sy - 2, fx - 30, sy + 3);
    ctx.moveTo(fx + 34, sy + 2);
    ctx.quadraticCurveTo(fx + 76, sy - 3, fx + 124 - sl * 6, sy + 7);
    ctx.stroke();
  }

  // Autumn woods on the cliff top and shoulders: layered rounded canopies, darker underneath.
  var leaves = ['#c2332a', '#d9452b', '#e8742a', '#f0a830', '#b5651d', '#e0582b', '#7d8a3a'];
  for (var layer = 0; layer < 2; layer++) {
    for (var tr = 0; tr < 70; tr++) {
      var tx2 = fx - 178 + rand() * 356;
      if (Math.abs(tx2 - fx) < 40 && layer === 1) continue;
      var tyTop = cliffTop(tx2);
      var tyy = tyTop + (layer === 0 ? -4 : 6) + rand() * (Math.abs(tx2 - fx) < 50 ? 6 : 22);
      var tsz = 5 + rand() * 6;
      ctx.fillStyle = 'rgba(70, 40, 30, 0.35)';
      ctx.beginPath();
      ctx.arc(tx2 + 1.5, tyy + 2, tsz, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = leaves[Math.floor(rand() * leaves.length)];
      ctx.beginPath();
      ctx.arc(tx2, tyy, tsz, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 230, 180, 0.25)';
      ctx.beginPath();
      ctx.arc(tx2 - tsz * 0.3, tyy - tsz * 0.35, tsz * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Trees on the far bank behind the reservoir, and bushes clinging to the cliff face.
  var canopy = function (cx2, cy2, size2) {
    ctx.fillStyle = 'rgba(70, 40, 30, 0.3)';
    ctx.beginPath();
    ctx.arc(cx2 + 1.5, cy2 + 2, size2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = leaves[Math.floor(rand() * leaves.length)];
    ctx.beginPath();
    ctx.arc(cx2, cy2, size2, 0, Math.PI * 2);
    ctx.fill();
  };
  for (var back = 0; back < 16; back++)
    canopy(fx - 56 + back * 7.5, lipY - 25 - rand() * 6, 5 + rand() * 4);
  for (var bush = 0; bush < 34; bush++) {
    var bxx = fx + (rand() < 0.5 ? -1 : 1) * (70 + rand() * 100);
    var byy = cliffTop(bxx) + 18 + rand() * (top - cliffTop(bxx) - 24);
    canopy(bxx, byy, 3.5 + rand() * 4);
  }

  // The reservoir (貯水池): calm water with a bright rim, held by a stone masonry dam.
  var pond = ctx.createLinearGradient(0, lipY - 24, 0, lipY - 10);
  pond.addColorStop(0, '#9fcbd8');
  pond.addColorStop(1, '#5f98ad');
  ctx.fillStyle = pond;
  ctx.beginPath();
  ctx.ellipse(fx, lipY - 17, 48, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(fx, lipY - 17, 48, 6.5, 0, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();
  var stone = ctx.createLinearGradient(0, crestY, 0, lipY + 2);
  stone.addColorStop(0, '#c9c2b2');
  stone.addColorStop(1, '#9d9585');
  ctx.fillStyle = stone;
  ctx.fillRect(fx - 34, crestY, 68, 12);
  ctx.strokeStyle = 'rgba(90, 82, 68, 0.45)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (var row = 0; row < 3; row++) {
    var ry = crestY + row * 4;
    ctx.moveTo(fx - 34, ry);
    ctx.lineTo(fx + 34, ry);
    for (var col = -34 + (row % 2) * 4; col < 34; col += 8) {
      ctx.moveTo(fx + col, ry);
      ctx.lineTo(fx + col, ry + 4);
    }
  }
  ctx.stroke();
  ctx.fillStyle = '#ddd7c9';
  ctx.fillRect(fx - 36, crestY - 2, 72, 2.5);

  // Wet dark rock behind the water.
  var wet = ctx.createLinearGradient(fx - 26, 0, fx + 30, 0);
  wet.addColorStop(0, 'rgba(46, 50, 58, 0)');
  wet.addColorStop(0.5, 'rgba(46, 50, 58, 0.55)');
  wet.addColorStop(1, 'rgba(46, 50, 58, 0)');
  ctx.fillStyle = wet;
  ctx.fillRect(fx - 26, lipY, 58, top - lipY);

  // The ledge halfway down, with its small pool.
  ctx.fillStyle = '#4b505a';
  ctx.beginPath();
  ctx.ellipse(fx + 2, midY + 5, 42, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(150, 156, 168, 0.8)';
  ctx.beginPath();
  ctx.ellipse(fx + 2, midY + 1.5, 40, 3, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#86bccb';
  ctx.beginPath();
  ctx.ellipse(fx + 2, midY + 2, 24, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Granite rocks along the falls and piled at the foot: irregular, lit from the upper left,
  // some with moss — as on the rocks beside 布引の雄滝.
  var span = top - lipY;
  var rock = function (bx, by, br, i) {
    var pts = 7;
    var shape = [];
    for (var q = 0; q < pts; q++) {
      var ang = (q / pts) * Math.PI * 2;
      var rad = br * (0.78 + rand() * 0.3);
      shape.push([bx + Math.cos(ang) * rad, by + Math.sin(ang) * rad * 0.72]);
    }
    var g = ctx.createRadialGradient(bx - br * 0.4, by - br * 0.45, br * 0.1, bx, by, br * 1.05);
    g.addColorStop(0, '#aeb2bb');
    g.addColorStop(0.55, '#70757f');
    g.addColorStop(1, '#474b54');
    ctx.fillStyle = g;
    ctx.beginPath();
    shape.forEach(function (pt, q) {
      var next = shape[(q + 1) % pts];
      var mx = (pt[0] + next[0]) / 2;
      var my = (pt[1] + next[1]) / 2;
      if (q === 0) ctx.moveTo(mx, my);
      else ctx.quadraticCurveTo(pt[0], pt[1], mx, my);
    });
    ctx.quadraticCurveTo(
      shape[0][0],
      shape[0][1],
      (shape[0][0] + shape[1][0]) / 2,
      (shape[0][1] + shape[1][1]) / 2,
    );
    ctx.closePath();
    ctx.fill();
    if (i % 3 === 1) {
      ctx.fillStyle = 'rgba(98, 132, 66, 0.62)';
      ctx.beginPath();
      ctx.ellipse(bx - br * 0.15, by - br * 0.5, br * 0.55, br * 0.2, -0.15, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  var placed = 0;
  [-1, 1].forEach(function (side) {
    for (var rr = 0; rr < 9; rr++) {
      var k2 = 0.05 + rr * 0.11 + rand() * 0.05;
      var dx2 = side * (24 + rand() * 26 + k2 * 18);
      rock(fx + 2 + dx2, lipY + k2 * span, 8 + rand() * 7 + k2 * 6, placed++);
    }
  });
  // The pile at the foot, bigger and overlapping.
  for (var pr = 0; pr < 9; pr++) {
    var px2 = fx + 3 + (pr - 4) * 15 + (rand() - 0.5) * 6;
    if (Math.abs(px2 - fx - 3) < 18) continue;
    rock(px2, top - 6 - rand() * 8, 11 + rand() * 8, placed++);
  }

  ctx.restore();

  // Autumn trees along the near hills (left and right of the waterfall's rocks).
  var trees = ['#d9452b', '#e8742a', '#f0a830', '#c2332a', '#b5651d'];
  var near = layers[2].ridge;
  for (var t = 0; t < width / 7; t++) {
    var tx = rand() * width;
    if (Math.abs(tx - fallX) < 182 * fallScale) continue;
    var ground = near(tx);
    var ty = ground + rand() * (top - ground) * 0.85;
    var r = 3 + rand() * 4;
    ctx.fillStyle = trees[Math.floor(rand() * trees.length)];
    ctx.beginPath();
    ctx.ellipse(tx, ty, r, r * 1.15, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  return {
    canvas: canvas,
    fallX: fallX,
    fallTop: fallTop,
    crestY: crestY,
    midY: midY,
    fallScale: fallScale,
  };
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

/** One sheet of falling water: slightly bowed sides, light in the middle, streaks moving down. */
function drawCurtain(ctx, x, from, to, wTop, wBottom, t, falls, tier) {
  var sheet = ctx.createLinearGradient(0, from, 0, to);
  sheet.addColorStop(0, 'rgba(236, 246, 251, 0.96)');
  sheet.addColorStop(1, 'rgba(214, 234, 245, 0.92)');
  ctx.fillStyle = sheet;
  ctx.beginPath();
  ctx.moveTo(x - wTop / 2, from);
  ctx.lineTo(x + wTop / 2, from);
  ctx.quadraticCurveTo(x + wTop / 2 + 3, (from + to) / 2, x + wBottom / 2, to);
  ctx.lineTo(x - wBottom / 2, to);
  ctx.quadraticCurveTo(x - wTop / 2 - 3, (from + to) / 2, x - wTop / 2, from);
  ctx.closePath();
  ctx.fill();
  // Volume: bluish edges, a bright core.
  var depth = ctx.createLinearGradient(x - wBottom / 2, 0, x + wBottom / 2, 0);
  depth.addColorStop(0, 'rgba(150, 186, 210, 0.45)');
  depth.addColorStop(0.35, 'rgba(255, 255, 255, 0)');
  depth.addColorStop(0.65, 'rgba(255, 255, 255, 0)');
  depth.addColorStop(1, 'rgba(150, 186, 210, 0.45)');
  ctx.fillStyle = depth;
  ctx.fill();
  ctx.save();
  ctx.clip();
  var span = to - from;
  ctx.lineCap = 'round';
  for (var i = 0; i < falls.length; i++) {
    var f = falls[i];
    if (f.tier !== tier) continue;
    var y = from + ((f.offset + t * f.speed) % (span + f.length)) - f.length;
    var k = (y - from) / span;
    var w = wTop + (wBottom - wTop) * Math.max(0, k);
    ctx.strokeStyle = 'rgba(255, 255, 255, ' + f.alpha.toFixed(2) + ')';
    ctx.lineWidth = f.width;
    ctx.beginPath();
    ctx.moveTo(x + f.lane * w * 0.46, y);
    ctx.lineTo(x + f.lane * w * 0.5, y + f.length);
    ctx.stroke();
  }
  // Pale sheets sliding down the curtain.
  for (var band = 0; band < 3; band++) {
    var by = from + ((t * 70 + band * span * 0.37) % span);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fillRect(x - wBottom, by, wBottom * 2, 3);
  }
  ctx.restore();
}

/** Mist, foam and spray where falling water lands. */
function drawSplash(ctx, x, y, size, t, seed) {
  var pulse = 0.5 + 0.5 * Math.sin(t * 2.3 + seed);
  var mist = ctx.createRadialGradient(x, y, 2, x, y - size * 0.2, size * 1.6);
  mist.addColorStop(0, 'rgba(255, 255, 255, ' + (0.7 + 0.2 * pulse).toFixed(2) + ')');
  mist.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = mist;
  ctx.beginPath();
  ctx.ellipse(x, y - size * 0.15, size * 1.6, size * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.beginPath();
  ctx.ellipse(x, y, size * (0.75 + 0.06 * pulse), size * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  // Spray: droplets thrown up and out, falling back.
  for (var i = 0; i < 12; i++) {
    var p = (t * 1.3 + i / 12 + seed) % 1;
    var side = i % 2 ? 1 : -1;
    var dx = side * (size * 0.25 + (i % 6) * size * 0.12) * p;
    var dy = -size * 0.9 * 4 * p * (1 - p);
    ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.85 * (1 - p)).toFixed(2) + ')';
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, 1.2 + (i % 3) * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * The falls (11/16, after 布引の滝): water spills over the stone dam, drops onto the ledge, then
 * falls wider into the lake's emerald plunge pool (滝壺), with mist and spray at each landing.
 */
function drawWaterfall(ctx, scenery, top, t, falls) {
  if (!scenery) return;
  var x = scenery.fallX;
  var crest = scenery.crestY;
  var mid = scenery.midY;
  var k = scenery.fallScale || 1;
  ctx.save();
  ctx.translate(x, top);
  ctx.scale(k, k);
  ctx.translate(-x, -top);
  // Emerald plunge pool under the falls.
  ctx.fillStyle = 'rgba(80, 168, 158, 0.32)';
  ctx.beginPath();
  ctx.ellipse(x + 3, top + 9, 62, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  // A thin sheet spilling over the dam's crest, then the two falls.
  ctx.fillStyle = 'rgba(240, 248, 252, 0.9)';
  ctx.fillRect(x - 13, crest - 1, 26, 3);
  drawCurtain(ctx, x, crest + 1, mid + 1, 22, 30, t, falls, 0);
  drawSplash(ctx, x + 1, mid + 2, 20, t, 0.3);
  drawCurtain(ctx, x + 3, mid + 3, top + 1, 32, 46, t, falls, 1);
  drawSplash(ctx, x + 3, top + 3, 36, t, 0.7);
  ctx.restore();
}

/** Waterfall streaks: lanes across each fall, each moving at its own speed. */
function makeFalls() {
  var list = [];
  for (var i = 0; i < 56; i++) {
    list.push({
      tier: i < 22 ? 0 : 1,
      lane: Math.random() * 2 - 1,
      offset: Math.random() * 400,
      speed: 130 + Math.random() * 110,
      length: 10 + Math.random() * 26,
      width: 0.8 + Math.random() * 1.4,
      alpha: 0.4 + Math.random() * 0.5,
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
  glow.addColorStop(0, 'rgba(255, 250, 225, ' + (0.55 + 0.3 * flash).toFixed(3) + ')');
  glow.addColorStop(1, 'rgba(255, 250, 225, 0)');
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
        'rgba(255, ' +
        (i % 2 ? 236 : 250) +
        ', ' +
        (i % 2 ? 150 : 225) +
        ', ' +
        (1 - p).toFixed(3) +
        ')';
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
  disc.addColorStop(0, '#fffbe6');
  disc.addColorStop(0.6, '#fbefc0');
  disc.addColorStop(1, '#f1dc98');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.98, 0, Math.PI * 2);
  ctx.clip();
  ctx.scale(r, r);
  ctx.fillStyle = 'rgba(232, 196, 110, 0.28)';
  CRATERS.forEach(function (c) {
    ctx.beginPath();
    ctx.ellipse(c[0], c[1], c[2], c[3], 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Rabbits and mortar: soft amber shapes; where they overlap they look a little deeper.
  ctx.save();
  ctx.translate(0, -0.04);
  ctx.scale(1.14, 1.14);
  var mark = 'rgba(214, 150, 60, 0.5)';
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
  ctx.fillStyle = 'rgba(255, 253, 240, 0.95)';
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
    ctx.fillStyle = 'rgba(255, 253, 240, 0.9)';
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
  ctx.strokeStyle = 'rgba(255, 252, 235, 0.8)';
  ctx.lineWidth = Math.max(1, r * 0.03);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.99, 0, Math.PI * 2);
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

/**
 * Japan in stars (11/16): the coasts of the four main islands, [longitude, latitude].
 * Kobe (神戸) and Sanda (三田) shine brighter in their own colours.
 */
var JAPAN = [
  // Hokkaido
  [
    [141.7, 45.4],
    [142.9, 44.7],
    [143.9, 44.1],
    [145.3, 44.3],
    [145.8, 43.3],
    [144.4, 42.95],
    [143.3, 41.95],
    [141.9, 42.6],
    [141.0, 42.35],
    [140.1, 41.45],
    [139.85, 42.25],
    [140.4, 43.25],
    [141.4, 43.8],
    [141.7, 44.6],
  ],
  // Honshu
  [
    [140.9, 41.5],
    [141.45, 41.1],
    [141.95, 39.9],
    [141.55, 38.35],
    [140.95, 36.95],
    [140.85, 35.7],
    [139.85, 34.95],
    [139.1, 34.65],
    [137.6, 34.65],
    [136.85, 34.25],
    [135.8, 33.45],
    [135.1, 34.1],
    [135.19, 34.69],
    [134.1, 34.6],
    [132.5, 34.3],
    [130.95, 33.95],
    [131.4, 34.45],
    [132.9, 35.5],
    [134.8, 35.65],
    [135.9, 35.75],
    [136.85, 37.35],
    [137.35, 36.85],
    [138.6, 37.85],
    [139.85, 39.85],
    [140.0, 40.65],
    [140.55, 41.25],
  ],
  // Shikoku
  [
    [132.05, 33.4],
    [133.0, 34.1],
    [134.6, 34.2],
    [134.7, 33.85],
    [134.2, 33.25],
    [133.0, 32.75],
  ],
  // Kyushu
  [
    [130.9, 33.9],
    [131.9, 33.2],
    [131.55, 32.0],
    [131.05, 31.05],
    [130.2, 31.2],
    [130.15, 32.4],
    [129.75, 32.8],
    [129.9, 33.45],
    [130.4, 33.65],
  ],
];
var KOBE = [135.19, 34.69];
var SANDA = [135.22, 34.89];

/** Points along each island's coast, closer together than the outline, so the dots read as Japan. */
function denseIslands() {
  return JAPAN.map(function (island) {
    var out = [];
    island.forEach(function (p, i) {
      var q = island[(i + 1) % island.length];
      out.push({ lonLat: p, main: true });
      var d = Math.hypot((q[0] - p[0]) * 0.81, q[1] - p[1]);
      var extra = Math.floor(d / 1.1);
      for (var k = 1; k <= extra; k++) {
        var f = k / (extra + 1);
        out.push({ lonLat: [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f], main: false });
      }
    });
    return out;
  });
}

/**
 * Japan in stars across the whole evening sky (11/16): turned a little so the islands run from
 * one side of the screen to the other, sized to fill the sky above the mountains. Only dots at
 * first; 「星をつなぐ」 draws the lines between them.
 */
function starMapOf(width, height, top) {
  var tall = Math.min(200, height * 0.21);
  var skyBottom = top - tall * 1.05;
  if (skyBottom < 80 || width < 320) return null;
  var turn = 0.62;
  var cos = Math.cos(turn);
  var sin = Math.sin(turn);
  var project = function (lonLat) {
    var x = (lonLat[0] - 137.75) * 0.81;
    var y = -(lonLat[1] - 38.2);
    return [x * cos - y * sin, x * sin + y * cos];
  };
  var islands = denseIslands().map(function (island) {
    return island.map(function (pt) {
      return { xy: project(pt.lonLat), main: pt.main };
    });
  });
  var minX = Infinity;
  var maxX = -Infinity;
  var minY = Infinity;
  var maxY = -Infinity;
  islands.forEach(function (island) {
    island.forEach(function (pt) {
      minX = Math.min(minX, pt.xy[0]);
      maxX = Math.max(maxX, pt.xy[0]);
      minY = Math.min(minY, pt.xy[1]);
      maxY = Math.max(maxY, pt.xy[1]);
    });
  });
  // Stretched to the whole sky, edge to edge (11/16): its own scale across and down.
  var margin = Math.max(18, width * 0.025);
  var sx = (width - margin * 2) / (maxX - minX);
  var sy = (skyBottom - 26) / (maxY - minY);
  var s = Math.min(sx, sy);
  var place = function (xy) {
    return [margin + (xy[0] - minX) * sx, 14 + (xy[1] - minY) * sy];
  };
  return {
    islands: islands.map(function (island) {
      return island.map(function (pt, i) {
        return { at: place(pt.xy), main: pt.main, phase: i * 1.7 + pt.xy[0] };
      });
    }),
    kobe: place(project(KOBE)),
    sanda: place(project(SANDA)),
    size: Math.max(1, Math.min(1.6, s / 30)),
  };
}

/**
 * The stars, twinkling. `link` (0–1) draws the lines island by island when 「星をつなぐ」 is on.
 * Kobe (gold) and Sanda (pink) shine brighter; `poked` makes them send out a ring.
 */
function drawStarMap(ctx, map, t, poked, link) {
  if (!map) return;
  ctx.save();
  ctx.shadowColor = 'rgba(60, 70, 150, 0.4)';
  ctx.shadowBlur = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (link > 0) {
    var total = map.islands.length;
    map.islands.forEach(function (island, index) {
      var share = Math.max(0, Math.min(1, link * total - index * 0.7));
      if (share <= 0) return;
      var count = Math.ceil(island.length * share);
      ctx.strokeStyle = 'rgba(255, 255, 255, ' + (0.85 * Math.min(1, link * 3)).toFixed(3) + ')';
      ctx.lineWidth = 1.5 * map.size;
      ctx.beginPath();
      for (var i = 0; i <= count; i++) {
        var pt = island[i % island.length].at;
        if (i === 0) ctx.moveTo(pt[0], pt[1]);
        else ctx.lineTo(pt[0], pt[1]);
      }
      ctx.stroke();
    });
  }
  map.islands.forEach(function (island) {
    island.forEach(function (pt) {
      var tw = 0.5 + 0.5 * Math.sin(t * (1.1 + (pt.phase % 1.3)) + pt.phase);
      ctx.fillStyle = 'rgba(255, 255, 250, ' + (0.6 + 0.4 * tw).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(pt.at[0], pt.at[1], (pt.main ? 2.3 : 1.6) * map.size, 0, Math.PI * 2);
      ctx.fill();
    });
  });
  ctx.shadowBlur = 0;
  var p = poked >= 0 && poked < 1.4 ? poked / 1.4 : -1;
  [
    { at: map.kobe, color: '255, 205, 80', phase: 0 },
    { at: map.sanda, color: '255, 130, 170', phase: 1.6 },
  ].forEach(function (city) {
    var x = city.at[0];
    var y = city.at[1];
    var pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + city.phase);
    var glowR = (9 + 3 * pulse) * map.size + (p >= 0 ? 12 * (1 - p) : 0);
    var glow = ctx.createRadialGradient(x, y, 0, x, y, glowR);
    glow.addColorStop(0, 'rgba(' + city.color + ', 0.9)');
    glow.addColorStop(1, 'rgba(' + city.color + ', 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, glowR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgb(' + city.color + ')';
    sparkle(ctx, x, y, (5.5 + pulse * 1.5) * map.size);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, 1.6 * map.size, 0, Math.PI * 2);
    ctx.fill();
    if (p >= 0) {
      ctx.strokeStyle = 'rgba(' + city.color + ', ' + (1 - p).toFixed(3) + ')';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 6 + 26 * p, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
  ctx.restore();
}

/** Mt. Fuji (11/16): a wide cone with gently curving sides, a flat top and a snow cap. */
function drawFuji(ctx, x, top, tall) {
  var peak = top - tall * 1.45;
  var half = tall * 2.3;
  var cap = 14;
  var outline = function () {
    ctx.beginPath();
    ctx.moveTo(x - half, top + 2);
    ctx.quadraticCurveTo(x - half * 0.28, top - tall * 0.55, x - cap, peak);
    ctx.lineTo(x - cap * 0.4, peak - 2);
    ctx.lineTo(x + cap * 0.3, peak + 1);
    ctx.lineTo(x + cap, peak);
    ctx.quadraticCurveTo(x + half * 0.28, top - tall * 0.55, x + half, top + 2);
    ctx.closePath();
  };
  var body = ctx.createLinearGradient(0, peak, 0, top);
  body.addColorStop(0, '#a9b8cf');
  body.addColorStop(1, '#c7d2e0');
  ctx.fillStyle = body;
  outline();
  ctx.fill();
  // Snow: down to about a third, with a jagged edge running down the ridges.
  ctx.save();
  outline();
  ctx.clip();
  var snowLine = peak + (top - peak) * 0.34;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.beginPath();
  ctx.moveTo(x - half, peak - 4);
  ctx.lineTo(x + half, peak - 4);
  ctx.lineTo(x + half, snowLine - 30);
  var teeth = 9;
  for (var i = teeth; i >= 0; i--) {
    var tx = x - half * 0.55 + (i / teeth) * half * 1.1;
    var deep = i % 2 ? 0 : (top - peak) * (0.08 + 0.05 * Math.sin(i * 1.7));
    ctx.lineTo(tx, snowLine - 8 + deep);
  }
  ctx.lineTo(x - half, snowLine - 30);
  ctx.closePath();
  ctx.fill();
  // A soft shadow on the right slope.
  var shade = ctx.createLinearGradient(x, 0, x + half * 0.6, 0);
  shade.addColorStop(0, 'rgba(90, 110, 150, 0)');
  shade.addColorStop(1, 'rgba(90, 110, 150, 0.14)');
  ctx.fillStyle = shade;
  ctx.fillRect(x, peak - 4, half, top - peak + 8);
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
 * Leaves land on the water with a small ripple, float and drift, then fade; a click or tap on
 * the water sends a ripple that pushes the floating leaves away.
 */
export function startLeaves(canvas, options) {
  var opts = options || {};
  var ctx = canvas.getContext('2d');
  if (!ctx) return function () {};
  var lake = Boolean(opts.lake);
  // Japan in stars across the sky (11/16); lines only when 「星をつなぐ」 is on.
  var linkOn = false;
  var link = 0;
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
      drawStarMap(ctx, starMapOf(w, h, top), 0, -1, linkOn ? 1 : 0);
      drawSun(ctx, moon, 0, -1);
      drawLake(ctx, w, h, top, 0, []);
      drawScenery(ctx, scenery, w, h, top, true);
      drawWaterfall(ctx, scenery, top, 0, []);
      drawTorii(ctx, toriiOf(w, h, top), 0);
      drawFisher(ctx, fisherOf(w, h), 0, 0);
      drawCroc(ctx, crocOf(w, h), 0, { x: 0.6, y: -0.2 }, 0);
    };
    still();
    window.addEventListener('resize', still);
    var stopStill = function () {
      window.removeEventListener('resize', still);
    };
    stopStill.connectStars = function (on) {
      linkOn = Boolean(on);
      still();
    };
    return stopStill;
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
  var moonPokedAt = -10;
  var starMap = null;
  var mapPokedAt = -10;
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
      starMap = starMapOf(width, height, lakeTop);
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
    if (!lake) return;
    // A click on the moon: it bounces, the rabbits hop and sparkles fly.
    var mx = event.clientX - sun.x;
    var my = event.clientY - sun.y;
    if (Math.sqrt(mx * mx + my * my) <= sun.r * 1.1) {
      moonPokedAt = clock;
      return;
    }
    // A click near Kobe or Sanda: both stars send out a ring.
    if (starMap) {
      var near = [starMap.kobe, starMap.sanda].some(function (city) {
        var pt = city;
        return Math.abs(event.clientX - pt[0]) < 22 && Math.abs(event.clientY - pt[1]) < 22;
      });
      if (near) {
        mapPokedAt = clock;
        return;
      }
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
        // Lines grow in over about 2.5 s and fade out quickly when turned off.
        link = linkOn ? Math.min(1, link + dt / 2.5) : Math.max(0, link - dt * 2.5);
        drawStarMap(ctx, starMap, clock, clock - mapPokedAt, link);
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
      drawWaterfall(ctx, scenery, lakeTop, clock, falls);
      drawTorii(ctx, torii, clock);
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
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', visibility);
  if (lake) {
    window.addEventListener('pointerdown', poke);
    window.addEventListener('pointermove', track);
  }
  raf = window.requestAnimationFrame(frame);
  var stop = function () {
    window.cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('pointerdown', poke);
    window.removeEventListener('pointermove', track);
    ctx.clearRect(0, 0, width, height);
  };
  /** 「星をつなぐ」: draw (or hide) the lines that join the stars into Japan. */
  stop.connectStars = function (on) {
    linkOn = Boolean(on);
  };
  return stop;
}
