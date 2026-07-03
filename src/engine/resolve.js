globalThis.Phys = globalThis.Phys || {};

const Phys = globalThis.Phys;

// Resolve a collision between two bodies with impulse-based physics,
// Coulomb friction, and positional correction. Mutates a/b pos & vel in place.
Phys.resolveCollision = function(a, b, contact) {
  const nx = contact.normal.x;
  const ny = contact.normal.y;

  // Step 1: two statics, nothing to do
  const invSum = a.invMass + b.invMass;
  if (invSum === 0) {
    return;
  }

  // Step 2: relative velocity along normal
  let rvx = b.vel.x - a.vel.x;
  let rvy = b.vel.y - a.vel.y;
  const vn = rvx * nx + rvy * ny;

  let j = 0;

  // Step 3: normal impulse (only when approaching)
  if (vn < 0) {
    const e = Math.min(a.restitution, b.restitution);
    j = -(1 + e) * vn / invSum;

    a.vel.x -= j * nx * a.invMass;
    a.vel.y -= j * ny * a.invMass;
    b.vel.x += j * nx * b.invMass;
    b.vel.y += j * ny * b.invMass;

    // Step 4: friction impulse, computed from updated velocities
    rvx = b.vel.x - a.vel.x;
    rvy = b.vel.y - a.vel.y;
    const rvn = rvx * nx + rvy * ny;
    let tx = rvx - rvn * nx;
    let ty = rvy - rvn * ny;
    const tlen = Math.sqrt(tx * tx + ty * ty);

    if (tlen >= 1e-9) {
      tx /= tlen;
      ty /= tlen;

      const rvt = rvx * tx + rvy * ty;
      let jt = -rvt / invSum;

      const mu = Math.min(a.friction, b.friction);
      const maxJt = mu * Math.abs(j);
      if (Math.abs(jt) > maxJt) {
        jt = (jt < 0 ? -1 : 1) * maxJt;
      }

      a.vel.x -= jt * tx * a.invMass;
      a.vel.y -= jt * ty * a.invMass;
      b.vel.x += jt * tx * b.invMass;
      b.vel.y += jt * ty * b.invMass;
    }
  }

  // Step 5: positional correction (always runs)
  const slop = 0.01;
  const percent = 0.8;
  const corr = Math.max(contact.depth - slop, 0) / invSum * percent;

  a.pos.x -= corr * nx * a.invMass;
  a.pos.y -= corr * ny * a.invMass;
  b.pos.x += corr * nx * b.invMass;
  b.pos.y += corr * ny * b.invMass;
};
