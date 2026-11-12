// Light golden maple leaves drifting down and settling at the bottom of the screen (request
// 11/12). Plain browser JavaScript with no imports: the maintenance page (outage.html) inlines
// it, and the app imports it, so both draw exactly the same leaves.

/** Pale cream to warm gold, like a backlit autumn leaf. */
var LEAF_COLORS = [
  ['#fff6d8', '#f3dc98', '#d9aa4f'],
  ['#fdf0c4', '#eccb7a', '#c99137'],
  ['#fff9e6', '#f6e3a6', '#dcb565'],
  ['#fbe9b3', '#e6bd62', '#b97f2c'],
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
  ctx.globalAlpha = 0.92;
  ctx.fill();
  // Veins from the stem to each lobe, and the stem.
  ctx.globalAlpha = 0.55;
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

/**
 * Starts the leaves on a full-screen canvas. Returns a function that stops them.
 * Nothing moves for people who prefer reduced motion; it pauses while the tab is hidden.
 */
export function startLeaves(canvas, options) {
  var opts = options || {};
  var ctx = canvas.getContext('2d');
  if (!ctx) return function () {};
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return function () {};
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

  function resize() {
    width = canvas.clientWidth || window.innerWidth;
    height = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    // A new width: start a fresh pile.
    resting = [];
    heights = new Array(Math.ceil(width / BUCKET) + 1).fill(0);
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
      draw(r.sprite, r.x, r.y, r.angle, 1, r.squash, 0.95 * Math.max(0, r.fade));
    }

    for (var j = falling.length - 1; j >= 0; j--) {
      var f = falling[j];
      f.phase += dt * 1.6;
      f.flip += dt * 2.2;
      f.angle += f.spin * dt;
      f.y += f.vy * dt;
      f.x += (f.drift + Math.cos(f.phase) * f.sway) * dt;
      var ground = height - Math.min(heights[bucketOf(f.x)], f.sprite.size * 0.55 * LAYERS);
      if (f.y >= ground - f.sprite.size * 0.4) {
        falling.splice(j, 1);
        land(f);
        continue;
      }
      // The leaf turns over as it flutters (narrower when seen edge-on).
      draw(f.sprite, f.x, f.y, f.angle, 0.35 + 0.65 * Math.abs(Math.cos(f.flip)), 1, 0.95);
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
  raf = window.requestAnimationFrame(frame);
  return function stop() {
    window.cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', visibility);
    ctx.clearRect(0, 0, width, height);
  };
}
