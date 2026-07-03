globalThis.Phys = globalThis.Phys || {};

const Phys = globalThis.Phys;

// Clamp a value between lo and hi
function clamp(v, lo, hi) {
  return Math.min(Math.max(v, lo), hi);
}

// Narrow-phase circle vs circle. Normal points from a toward b.
function collideCircleCircle(a, b) {
  const dx = b.pos.x - a.pos.x;
  const dy = b.pos.y - a.pos.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const rSum = a.r + b.r;

  if (d >= rSum) {
    return null;
  }

  if (d === 0) {
    return { normal: { x: 0, y: -1 }, depth: rSum };
  }

  return {
    normal: { x: dx / d, y: dy / d },
    depth: rSum - d,
  };
}

// Narrow-phase aabb vs aabb. Normal points from a toward b.
function collideAabbAabb(a, b) {
  const dx = b.pos.x - a.pos.x;
  const dy = b.pos.y - a.pos.y;
  const ox = a.hw + b.hw - Math.abs(dx);
  const oy = a.hh + b.hh - Math.abs(dy);

  if (ox <= 0 || oy <= 0) {
    return null;
  }

  if (ox < oy) {
    return { normal: { x: dx < 0 ? -1 : 1, y: 0 }, depth: ox };
  }

  if (oy < ox) {
    return { normal: { x: 0, y: dy < 0 ? -1 : 1 }, depth: oy };
  }

  // ox === oy (tie): use the X axis
  return { normal: { x: dx < 0 ? -1 : 1, y: 0 }, depth: ox };
}

// Narrow-phase circle vs aabb. a is the circle, b is the aabb.
// Normal points from a (circle) toward b (aabb).
function collideCircleAabb(a, b) {
  const cx = clamp(a.pos.x, b.pos.x - b.hw, b.pos.x + b.hw);
  const cy = clamp(a.pos.y, b.pos.y - b.hh, b.pos.y + b.hh);

  if (cx !== a.pos.x || cy !== a.pos.y) {
    // Circle center is outside the box.
    const delta = { x: cx - a.pos.x, y: cy - a.pos.y };
    const d = Math.sqrt(delta.x * delta.x + delta.y * delta.y);

    if (d >= a.r) {
      return null;
    }

    return {
      normal: { x: delta.x / d, y: delta.y / d },
      depth: a.r - d,
    };
  }

  // Circle center is inside the box: push out along the axis of least penetration.
  const px = b.hw - Math.abs(a.pos.x - b.pos.x);
  const py = b.hh - Math.abs(a.pos.y - b.pos.y);

  if (px < py) {
    return {
      normal: { x: b.pos.x >= a.pos.x ? 1 : -1, y: 0 },
      depth: a.r + px,
    };
  }

  return {
    normal: { x: 0, y: b.pos.y >= a.pos.y ? 1 : -1 },
    depth: a.r + py,
  };
}

// Narrow-phase collision test between two bodies. Returns null when not
// overlapping, or { normal, depth } where normal is a unit vector pointing
// from a toward b and depth is the (strictly positive) penetration depth.
Phys.collide = function (a, b) {
  if (a.shape === 'circle' && b.shape === 'circle') {
    return collideCircleCircle(a, b);
  }

  if (a.shape === 'aabb' && b.shape === 'aabb') {
    return collideAabbAabb(a, b);
  }

  if (a.shape === 'circle' && b.shape === 'aabb') {
    return collideCircleAabb(a, b);
  }

  if (a.shape === 'aabb' && b.shape === 'circle') {
    const result = collideCircleAabb(b, a);
    if (!result) {
      return null;
    }
    return {
      normal: { x: -result.normal.x, y: -result.normal.y },
      depth: result.depth,
    };
  }

  throw new Error('unknown shape pair');
};
