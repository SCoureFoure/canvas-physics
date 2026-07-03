import { test } from 'node:test';
import assert from 'node:assert/strict';

await import('../src/engine/vec2.js');
await import('../src/engine/collide.js');
await import('../src/engine/resolve.js');
await import('../src/engine/world.js');

const Phys = globalThis.Phys;
const close = (a, b, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) < eps, `expected ${a} ≈ ${b}`);
const noNaN = (w) => {
  for (const b of w.bodies) {
    assert.ok(Number.isFinite(b.pos.x) && Number.isFinite(b.pos.y), 'pos NaN');
    assert.ok(Number.isFinite(b.vel.x) && Number.isFinite(b.vel.y), 'vel NaN');
  }
};

test('body factory: defaults, aabb half-extents, unknown shape throws', () => {
  const c = Phys.body({ shape: 'circle', x: 1, y: 2, r: 3 });
  assert.equal(c.mass, 1);
  assert.equal(c.invMass, 1);
  assert.equal(c.restitution, 0.2);
  assert.equal(c.friction, 0.3);
  assert.equal(c.static, false);
  const b = Phys.body({ shape: 'aabb', x: 5, y: 5, w: 10, h: 4 });
  assert.equal(b.hw, 5);
  assert.equal(b.hh, 2);
  assert.equal(b.r, undefined);
  const s = Phys.body({ shape: 'circle', x: 0, y: 0, r: 1, static: true });
  assert.equal(s.invMass, 0);
  assert.throws(() => Phys.body({ shape: 'blob' }), /unknown shape/);
});

test('world: id assignment', () => {
  const w = new Phys.World();
  const a = w.addBody(Phys.body({ shape: 'circle', x: 0, y: 0, r: 1 }));
  const b = w.addBody(Phys.body({ shape: 'circle', x: 9, y: 0, r: 1 }));
  assert.equal(a.id, 0);
  assert.equal(b.id, 1);
});

test('world: semi-implicit free fall', () => {
  const w = new Phys.World();
  const b = w.addBody(Phys.body({ shape: 'circle', x: 0, y: 0, r: 1 }));
  w.step(0.1);
  close(b.vel.y, 90);
  close(b.pos.y, 9); // pos uses NEW velocity — kills explicit Euler
});

test('world: force scaled by invMass and cleared after step', () => {
  const w = new Phys.World({ gravity: { x: 0, y: 0 } });
  const b = w.addBody(Phys.body({ shape: 'circle', x: 0, y: 0, r: 1, mass: 2 }));
  w.applyForce(b, { x: 10, y: 0 });
  w.step(0.5);
  close(b.vel.x, 2.5);
  close(b.pos.x, 1.25);
  w.step(0.5);
  close(b.vel.x, 2.5); // force cleared, no re-application
});

test('world: static bodies inert under gravity', () => {
  const w = new Phys.World();
  const s = w.addBody(Phys.body({ shape: 'aabb', x: 0, y: 0, w: 10, h: 10, static: true }));
  w.step(0.1);
  close(s.pos.y, 0);
  close(s.vel.y, 0);
});

test('constraint: rigid rod holds length under velocity', () => {
  const w = new Phys.World({ gravity: { x: 0, y: 0 } });
  const a = w.addBody(Phys.body({ shape: 'circle', x: 0, y: 0, r: 1 }));
  const b = w.addBody(Phys.body({ shape: 'circle', x: 10, y: 0, r: 1 }));
  const c = w.addConstraint({ a, b }); // length defaults to current distance
  close(c.length, 10);
  b.vel.x = 100;
  for (let i = 0; i < 60; i++) {
    w.step(1 / 60);
    const d = Math.hypot(b.pos.x - a.pos.x, b.pos.y - a.pos.y);
    assert.ok(Math.abs(d - 10) < 0.01, `rod stretched to ${d}`);
  }
});

test('constraint: pendulum swings, anchor pinned', () => {
  const w = new Phys.World();
  const anchor = w.addBody(Phys.body({ shape: 'circle', x: 0, y: 0, r: 1, static: true }));
  const bob = w.addBody(Phys.body({ shape: 'circle', x: 10, y: 0, r: 1, mass: 5 }));
  w.addConstraint({ a: anchor, b: bob, length: 10 });
  for (let i = 0; i < 120; i++) w.step(1 / 60);
  close(anchor.pos.x, 0);
  close(anchor.pos.y, 0);
  const d = Math.hypot(bob.pos.x, bob.pos.y);
  assert.ok(Math.abs(d - 10) < 0.05, `pendulum length drifted to ${d}`);
  assert.ok(bob.pos.y > 0, 'bob should have swung downward');
  noNaN(w);
});

test('world: ball settles on static floor', () => {
  const w = new Phys.World();
  w.addBody(Phys.body({ shape: 'aabb', x: 0, y: 105, w: 400, h: 10, static: true }));
  const ball = w.addBody(Phys.body({ shape: 'circle', x: 0, y: 0, r: 10 }));
  for (let i = 0; i < 600; i++) w.step(1 / 60);
  noNaN(w);
  assert.ok(Math.abs(ball.pos.y - 90) < 1, `ball rests at ${ball.pos.y}, want ~90`);
  assert.ok(Math.abs(ball.vel.y) < 5, `ball still moving vy=${ball.vel.y}`);
});

test('world: bounce loses energy with restitution < 1', () => {
  const w = new Phys.World();
  w.addBody(Phys.body({ shape: 'aabb', x: 0, y: 105, w: 400, h: 10, static: true }));
  const ball = w.addBody(Phys.body({ shape: 'circle', x: 0, y: 0, r: 10, restitution: 0.6 }));
  let minY = Infinity;
  let bounced = false;
  for (let i = 0; i < 300; i++) {
    w.step(1 / 60);
    if (ball.vel.y < 0) bounced = true; // moving up = bounced
    if (bounced) minY = Math.min(minY, ball.pos.y);
  }
  assert.ok(bounced, 'ball never bounced');
  assert.ok(minY > 5, `bounce apex ${minY} higher than drop point — energy gained`);
});
