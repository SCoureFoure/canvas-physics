globalThis.Scenes = globalThis.Scenes || {};

Scenes['cannon'] = {
  title: 'Cannon vs Crate Pyramid',
  width: 900,
  height: 600,

  setup(world) {
    world.addBody(Phys.body({shape:'aabb', x:450, y:580, w:900, h:40, static:true, friction:0.5}));
    for (let row = 0; row < 4; row++) {
      const n = 4 - row;                 // crates in this row
      const y = 540 - 42 * row;          // bottom row centers at y=540
      for (let i = 0; i < n; i++) {
        const x = 640 - (n - 1) * 21 + i * 42;   // 42px spacing (2px gap)
        world.addBody(Phys.body({ shape: 'aabb', x, y, w: 40, h: 40, mass: 1, restitution: 0.1, friction: 0.5 }));
      }
    }
  },

  onPointer(world, x, y) {
    const dx = x - 60, dy = y - 500;
    const d = Math.hypot(dx, dy);
    if (d === 0) return;                  // pointer exactly on muzzle: do nothing
    world.addBody(Phys.body({ shape: 'circle', x: 60, y: 500, r: 12, mass: 3, restitution: 0.3, friction: 0.3, vx: (dx / d) * 900, vy: (dy / d) * 900 }));
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
