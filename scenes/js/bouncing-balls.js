globalThis.Scenes = globalThis.Scenes || {};

Scenes['bouncing-balls'] = {
  title: 'Bouncing Balls',
  width: 900,
  height: 600,

  setup(world) {
    world.addBody(Phys.body({shape:'aabb', x:450, y:595, w:900, h:30, static:true}));
    world.addBody(Phys.body({shape:'aabb', x:450, y:5,   w:900, h:30, static:true}));
    world.addBody(Phys.body({shape:'aabb', x:5,   y:300, w:30,  h:600, static:true}));
    world.addBody(Phys.body({shape:'aabb', x:895, y:300, w:30,  h:600, static:true}));

    let s = 42;
    const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
    for (let i = 0; i < 12; i++) {
      const r = 12 + rnd() * 18;
      const x = 60 + rnd() * 780;
      const y = 60 + rnd() * 250;
      const vx = -200 + rnd() * 400;
      world.addBody(Phys.body({ shape: 'circle', x, y, r, vx, mass: (r * r) / 144, restitution: 0.85, friction: 0.05 }));
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
