/**
 * One step of MoraBot bouncing around the screen, used by the app's overlay and, copied in by
 * scripts/build-outage-page.mjs, by outage.html. Plain JavaScript for that reason.
 * Returns 'corner', 'wall' or null.
 */
export function stepBounce(s, dt, maxX, maxY, speed) {
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  // Only a wall it is moving towards counts: bouncing off must not count as hitting it again.
  var hitX = (s.vx > 0 && s.x >= maxX) || (s.vx < 0 && s.x <= 0);
  var hitY = (s.vy > 0 && s.y >= maxY) || (s.vy < 0 && s.y <= 0);
  // Reaching one wall just short of the other counts as the corner.
  var near = Math.abs(s.vx * dt) + Math.abs(s.vy * dt) + 6;
  var nearX = s.vx > 0 ? maxX - s.x < near : s.x < near;
  var nearY = s.vy > 0 ? maxY - s.y < near : s.y < near;
  if (hitX && !hitY && nearY) hitY = true;
  if (hitY && !hitX && nearX) hitX = true;
  if (hitX) {
    s.x = s.vx > 0 ? maxX : 0;
    s.vx = -s.vx;
  }
  if (hitY) {
    s.y = s.vy > 0 ? maxY : 0;
    s.vy = -s.vy;
  }
  // The screen got smaller, or it started outside: back inside without counting a hit.
  s.x = Math.max(0, Math.min(maxX, s.x));
  s.y = Math.max(0, Math.min(maxY, s.y));
  if (!hitX && !hitY) return null;
  s.walls += 1;
  if (hitX && hitY) {
    // A new angle: straight back would only reach the opposite corner, again and again.
    var angle = (Math.PI / 180) * (25 + Math.random() * 40);
    s.vx = (s.vx > 0 ? 1 : -1) * speed * Math.cos(angle);
    s.vy = (s.vy > 0 ? 1 : -1) * speed * Math.sin(angle);
    return 'corner';
  }
  // Every few walls it heads straight for the corner it is moving towards.
  if (s.walls % 4 === 0) {
    var dx = (s.vx > 0 ? maxX : 0) - s.x;
    var dy = (s.vy > 0 ? maxY : 0) - s.y;
    var distance = Math.hypot(dx, dy);
    if (distance >= 80 && Math.abs(dx) >= 40 && Math.abs(dy) >= 40) {
      s.vx = (speed * dx) / distance;
      s.vy = (speed * dy) / distance;
    }
  }
  return 'wall';
}
