import { test } from 'node:test';
import assert from 'node:assert/strict';

// Engine files attach to globalThis.Phys via side effects.
await import('../src/engine/vec2.js');
await import('../src/engine/loop.js');
await import('../src/engine/collide.js');
await import('../src/engine/resolve.js');

const Phys = globalThis.Phys;
const close = (a, b, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) < eps, `expected ${a} ≈ ${b}`);
const closeV = (v, x, y, eps = 1e-9) => { close(v.x, x, eps); close(v.y, y, eps); };

test('vec2: arithmetic', () => {
  closeV(Phys.add({ x: 1, y: 2 }, { x: 3, y: 4 }), 4, 6);
  closeV(Phys.sub({ x: 1, y: 2 }, { x: 3, y: 4 }), -2, -2);
  closeV(Phys.scale({ x: 2, y: -3 }, 2), 4, -6);
  assert.equal(Phys.dot({ x: 1, y: 2 }, { x: 3, y: 4 }), 11);
  assert.equal(Phys.len({ x: 3, y: 4 }), 5);
  assert.equal(Phys.dist({ x: 1, y: 1 }, { x: 4, y: 5 }), 5);
});

test('vec2: norm, zero norm, perp, no mutation', () => {
  closeV(Phys.norm({ x: 3, y: 4 }), 0.6, 0.8);
  closeV(Phys.norm({ x: 0, y: 0 }), 0, 0);
  closeV(Phys.perp({ x: 1, y: 0 }), 0, 1); // (-y, x); -0 tolerated by closeV
  const a = { x: 1, y: 1 };
  Phys.scale(a, 5);
  assert.deepEqual(a, { x: 1, y: 1 });
});

test('loop: fixed-step accumulation', () => {
  let steps = 0;
  const loop = Phys.createLoop({ step: () => steps++, dt: 0.01, maxSteps: 5 });
  assert.equal(loop.tick(0), 0);
  assert.equal(loop.tick(20), 2);
  assert.equal(loop.tick(25), 0);
  assert.equal(loop.tick(31), 1);
  assert.equal(steps, 3);
});

test('loop: clamp + spiral guard + negative delta', () => {
  let steps = 0;
  const loop = Phys.createLoop({ step: () => steps++, dt: 0.01, maxSteps: 5 });
  loop.tick(0);
  assert.equal(loop.tick(999999), 5); // clamped to 0.25s, capped at 5, acc dropped
  assert.equal(loop.tick(999999 + 5), 0); // acc was reset, 5ms accumulates only

  const l2 = Phys.createLoop({ step: () => {}, dt: 0.01 });
  l2.tick(100);
  assert.equal(l2.tick(50), 0); // negative delta -> 0
});

test('loop: render alpha', () => {
  let alpha = null;
  const loop = Phys.createLoop({ step: () => {}, render: (a) => (alpha = a), dt: 0.01 });
  loop.tick(0);
  loop.tick(15);
  close(alpha, 0.5);
});

test('loop: start() without rAF returns false', () => {
  const loop = Phys.createLoop({ step: () => {} });
  assert.equal(loop.start(), false);
});

test('collide: circle-circle', () => {
  const c = (x, y, r) => ({ shape: 'circle', pos: { x, y }, r });
  const hit = Phys.collide(c(0, 0, 5), c(8, 0, 5));
  closeV(hit.normal, 1, 0);
  close(hit.depth, 2);
  assert.equal(Phys.collide(c(0, 0, 5), c(10, 0, 5)), null); // touching = null
  const same = Phys.collide(c(0, 0, 5), c(0, 0, 5));
  closeV(same.normal, 0, -1);
  close(same.depth, 10);
});

test('collide: aabb-aabb', () => {
  const b = (x, y, hw, hh) => ({ shape: 'aabb', pos: { x, y }, hw, hh });
  const hit = Phys.collide(b(0, 0, 5, 5), b(9, 1, 5, 5));
  closeV(hit.normal, 1, 0);
  close(hit.depth, 1);
  const up = Phys.collide(b(0, 0, 5, 5), b(0, -9, 5, 5));
  closeV(up.normal, 0, -1);
  close(up.depth, 1);
  assert.equal(Phys.collide(b(0, 0, 5, 5), b(10, 0, 5, 5)), null);
});

test('collide: circle-aabb corner + flipped order + containment', () => {
  const circ = { shape: 'circle', pos: { x: 11, y: 11 }, r: 2 };
  const box = { shape: 'aabb', pos: { x: 5, y: 5 }, hw: 5, hh: 5 };
  const s = Math.SQRT1_2;
  const h1 = Phys.collide(circ, box);
  closeV(h1.normal, -s, -s);
  close(h1.depth, 2 - Math.SQRT2);
  const h2 = Phys.collide(box, circ); // swapped -> flipped normal
  closeV(h2.normal, s, s);
  close(h2.depth, 2 - Math.SQRT2);

  const inside = { shape: 'circle', pos: { x: 4, y: 0 }, r: 3 };
  const bigBox = { shape: 'aabb', pos: { x: 0, y: 0 }, hw: 6, hh: 6 };
  const h3 = Phys.collide(inside, bigBox);
  closeV(h3.normal, -1, 0);
  close(h3.depth, 5);

  assert.throws(
    () => Phys.collide({ shape: 'poly' }, circ),
    /unknown shape pair/
  );
});

const body = (over = {}) => ({
  pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 },
  invMass: 1, restitution: 1, friction: 0, ...over,
});

test('resolve: equal-mass elastic head-on swaps velocities', () => {
  const a = body({ vel: { x: 2, y: 0 } });
  const b = body({ vel: { x: -2, y: 0 }, pos: { x: 3, y: 0 } });
  Phys.resolveCollision(a, b, { normal: { x: 1, y: 0 }, depth: 0.005 });
  closeV(a.vel, -2, 0);
  closeV(b.vel, 2, 0);
  closeV(a.pos, 0, 0); // depth < slop -> no positional move
});

test('resolve: separating contact is a no-op', () => {
  const a = body({ vel: { x: -1, y: 0 } });
  const b = body({ vel: { x: 1, y: 0 }, pos: { x: 3, y: 0 } });
  Phys.resolveCollision(a, b, { normal: { x: 1, y: 0 }, depth: 0.005 });
  closeV(a.vel, -1, 0);
  closeV(b.vel, 1, 0);
});

test('resolve: ball on static floor, static never moves', () => {
  const ball = body({ vel: { x: 0, y: 100 }, restitution: 0.5 });
  const floor = body({ invMass: 0, restitution: 0.9 });
  Phys.resolveCollision(ball, floor, { normal: { x: 0, y: 1 }, depth: 0.005 });
  closeV(ball.vel, 0, -50);
  closeV(floor.vel, 0, 0);
});

test('resolve: positional correction split', () => {
  const a = body({ restitution: 0 });
  const b = body({ restitution: 0, pos: { x: 1, y: 0 } });
  Phys.resolveCollision(a, b, { normal: { x: 1, y: 0 }, depth: 1.01 });
  close(a.pos.x, -0.4);
  close(b.pos.x, 1.4);
});

test('resolve: Coulomb-clamped friction', () => {
  const a = body({ vel: { x: 10, y: 5 }, restitution: 0, friction: 0.5 });
  const g = body({ invMass: 0, restitution: 0, friction: 0.5 });
  Phys.resolveCollision(a, g, { normal: { x: 0, y: 1 }, depth: 0.005 });
  closeV(a.vel, 7.5, 0);
});

test('resolve: two statics -> nothing happens, no NaN', () => {
  const a = body({ invMass: 0 });
  const b = body({ invMass: 0, pos: { x: 1, y: 0 } });
  Phys.resolveCollision(a, b, { normal: { x: 1, y: 0 }, depth: 0.5 });
  closeV(a.vel, 0, 0);
  closeV(a.pos, 0, 0);
  closeV(b.pos, 1, 0);
});
