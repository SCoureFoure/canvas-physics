globalThis.Scenes = globalThis.Scenes || {};

Scenes['wrecking-ball'] = {
  title: 'Wrecking Ball',
  width: 900,
  height: 600,

  setup(world) {
    // 1. ground
    world.addBody(Phys.body({shape:'aabb', x:450, y:585, w:900, h:30, static:true, friction:0.4}));

    // 2. anchor
    const anchor = Phys.body({shape:'circle', x:450, y:90, r:6, static:true});
    world.addBody(anchor);

    // 3. Chain of 5 links extending horizontally LEFT from the anchor
    let prev = anchor;
    for (let i = 0; i < 5; i++) {
      const link = world.addBody(Phys.body({ shape: 'circle', x: 450 - 45 * (i + 1), y: 90, r: 5, mass: 2, restitution: 0.1, friction: 0.3 }));
      world.addConstraint({ a: prev, b: link, length: 45 });
      prev = link;
    }

    // 4. ball
    const ball = world.addBody(Phys.body({ shape: 'circle', x: 450 - 45 * 6, y: 90, r: 28, mass: 10, restitution: 0.2, friction: 0.3 }));
    world.addConstraint({ a: prev, b: ball, length: 45 });

    // 5. Two box towers, placed under the swing arc so the ball plows
    // through their upper thirds at full speed.
    for (let k = 0; k < 8; k++) {
      world.addBody(Phys.body({ shape: 'aabb', x: 560, y: 552 - 36 * k, w: 36, h: 36, mass: 0.8, restitution: 0.1, friction: 0.4 }));
    }
    for (let k = 0; k < 8; k++) {
      world.addBody(Phys.body({ shape: 'aabb', x: 604, y: 552 - 36 * k, w: 36, h: 36, mass: 0.8, restitution: 0.1, friction: 0.4 }));
    }
  },

  render(ctx, world) {
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, 900, 600);
    for (const c of world.constraints) {
      ctx.strokeStyle = '#e5e9f0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(c.a.pos.x, c.a.pos.y);
      ctx.lineTo(c.b.pos.x, c.b.pos.y);
      ctx.stroke();
    }
    for (const b of world.bodies) {
      if (b.shape === 'circle') {
        ctx.fillStyle = b.static ? '#3b4252' : '#88c0d0';
        ctx.beginPath();
        ctx.arc(b.pos.x, b.pos.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = b.static ? '#3b4252' : '#d08770';
        ctx.fillRect(b.pos.x - b.hw, b.pos.y - b.hh, b.hw * 2, b.hh * 2);
      }
    }
  }
};
