globalThis.Phys = globalThis.Phys || {};

(() => {
const Phys = globalThis.Phys;

// Pure factory for physics bodies.
Phys.body = function(opts) {
  opts = opts || {};

  const shape = opts.shape;
  const mass = opts.mass !== undefined ? opts.mass : 1;
  let isStatic = opts.static !== undefined ? opts.static : false;
  const restitution = opts.restitution !== undefined ? opts.restitution : 0.2;
  const friction = opts.friction !== undefined ? opts.friction : 0.3;
  const vx = opts.vx !== undefined ? opts.vx : 0;
  const vy = opts.vy !== undefined ? opts.vy : 0;

  const invMass = (isStatic || mass <= 0) ? 0 : 1 / mass;
  if (invMass === 0) {
    isStatic = true;
  }

  const b = {
    shape,
    pos: { x: opts.x, y: opts.y },
    vel: { x: vx, y: vy },
    force: { x: 0, y: 0 },
    mass,
    invMass,
    static: !!isStatic,
    restitution,
    friction,
    id: null,
  };

  if (shape === 'circle') {
    b.r = opts.r;
  } else if (shape === 'aabb') {
    b.hw = opts.w / 2;
    b.hh = opts.h / 2;
  } else {
    throw new Error('unknown shape');
  }

  return b;
};

// Fixed-step physics world: bodies, distance constraints, simulation.
Phys.World = class {
  constructor(opts) {
    opts = opts || {};
    this.bodies = [];
    this.constraints = [];
    this.gravity = opts.gravity !== undefined ? opts.gravity : { x: 0, y: 900 };
    this._nextId = 0;
  }

  addBody(b) {
    b.id = this._nextId++;
    this.bodies.push(b);
    return b;
  }

  addConstraint(opts) {
    const a = opts.a;
    const b = opts.b;
    let length = opts.length;

    if (length === undefined) {
      const dx = b.pos.x - a.pos.x;
      const dy = b.pos.y - a.pos.y;
      length = Math.sqrt(dx * dx + dy * dy);
    }

    const constraint = { a, b, length };
    this.constraints.push(constraint);
    return constraint;
  }

  applyForce(b, f) {
    b.force.x += f.x;
    b.force.y += f.y;
  }

  step(dt) {
    const bodies = this.bodies;
    const constraints = this.constraints;
    const gravity = this.gravity;

    // 1. Integrate (semi-implicit Euler)
    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i];
      if (body.invMass <= 0) {
        continue;
      }

      body.vel.x += (gravity.x + body.force.x * body.invMass) * dt;
      body.vel.y += (gravity.y + body.force.y * body.invMass) * dt;
      body.pos.x += body.vel.x * dt;
      body.pos.y += body.vel.y * dt;
    }

    // 2. Constraints: position-based solve, then fold the net position
    // correction back into velocity (PBD). Pure position projection is a
    // velocity-less teleport — without the velocity update a swinging chain
    // bleeds tangential momentum every frame and dead-stops in seconds.
    const preSolve = new Map();
    for (let i = 0; i < constraints.length; i++) {
      const c = constraints[i];
      for (const body of [c.a, c.b]) {
        if (body.invMass > 0 && !preSolve.has(body)) {
          preSolve.set(body, { x: body.pos.x, y: body.pos.y });
        }
      }
    }

    for (let iter = 0; iter < 16; iter++) {
      for (let i = 0; i < constraints.length; i++) {
        const c = constraints[i];
        const a = c.a;
        const b = c.b;

        const dx = b.pos.x - a.pos.x;
        const dy = b.pos.y - a.pos.y;
        const d = Math.sqrt(dx * dx + dy * dy);

        if (d === 0) {
          continue;
        }

        const invSum = a.invMass + b.invMass;
        if (invSum === 0) {
          continue;
        }

        const diff = (d - c.length) / d;
        const aRatio = a.invMass / invSum;
        const bRatio = b.invMass / invSum;

        a.pos.x += dx * diff * aRatio;
        a.pos.y += dy * diff * aRatio;
        b.pos.x -= dx * diff * bRatio;
        b.pos.y -= dy * diff * bRatio;
      }
    }

    // Velocity update: net correction / dt (keeps momentum consistent with
    // the projected positions instead of silently discarding it).
    for (const [body, p] of preSolve) {
      body.vel.x += (body.pos.x - p.x) / dt;
      body.vel.y += (body.pos.y - p.y) / dt;
    }

    // 3. Collisions: 4 solver passes
    for (let pass = 0; pass < 4; pass++) {
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          const a = bodies[i];
          const b = bodies[j];

          if (a.invMass + b.invMass === 0) {
            continue;
          }

          const c = Phys.collide(a, b);
          if (c) {
            Phys.resolveCollision(a, b, c);
          }
        }
      }
    }

    // 4. Clear forces
    for (let i = 0; i < bodies.length; i++) {
      bodies[i].force.x = 0;
      bodies[i].force.y = 0;
    }
  }
};
})();
