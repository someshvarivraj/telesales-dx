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
      drawScenery(ctx, scenery, w, h, top, false);
      drawLake(ctx, w, h, top, 0, []);
      drawScenery(ctx, scenery, w, h, top, true);
      drawWaterfall(ctx, scenery, top, 0, []);
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
    if (lake) scenery = buildScenery(width, height, lakeTop, ratio);
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

  /** Lake: a click or tap on the water. */
  function poke(event) {
    if (!lake || event.clientY < lakeTop + 4) return;
    var rect = canvas.getBoundingClientRect();
    var x = event.clientX - rect.left;
    var y = event.clientY - rect.top;
    ripples.push({ x: x, y: y, age: 0, size: 120, strength: 1 });
    ripples.push({ x: x, y: y, age: -0.3, size: 80, strength: 0.7 });
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
      drawLake(ctx, width, height, lakeTop, clock, streaks);
      drawScenery(ctx, scenery, width, height, lakeTop, true);
      drawWaterfall(ctx, scenery, lakeTop, clock, falls);
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
  if (lake) window.addEventListener('pointerdown', poke);
  raf = window.requestAnimationFrame(frame);
  return function stop() {
    window.cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('pointerdown', poke);
    ctx.clearRect(0, 0, width, height);
  };
}
