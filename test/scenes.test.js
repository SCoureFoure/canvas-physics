import { test } from 'node:test';
import assert from 'node:assert/strict';

await import('../src/engine/vec2.js');
await import('../src/engine/collide.js');
await import('../src/engine/resolve.js');
await import('../src/engine/world.js');
await import('../scenes/js/bouncing-balls.js');
await import('../scenes/js/cannon.js');
await import('../scenes/js/wrecking-ball.js');

const Phys = globalThis.Phys;
const Scenes = globalThis.Scenes;

const noNaN = (w) => {
  for (const b of w.bodies) {
    assert.ok(
      Number.isFinite(b.pos.x) && Number.isFinite(b.pos.y) &&
      Number.isFinite(b.vel.x) && Number.isFinite(b.vel.y),
      `body ${b.id} has non-finite state`
    );
  }
};

// Stub 2d context: every canvas method the scenes' render may call.
const stubCtx = () => {
  const calls = [];
  const rec = (name) => (...args) => calls.push([name, args]);
  return {
    calls,
    fillStyle: '', strokeStyle: '', lineWidth: 0,
    fillRect: rec('fillRect'), beginPath: rec('beginPath'),
    arc: rec('arc'), fill: rec('fill'),
    moveTo: rec('moveTo'), lineTo: rec('lineTo'), stroke: rec('stroke'),
  };
};

test('bouncing-balls: deterministic setup, balls stay in the box', () => {
  const scene = Scenes['bouncing-balls'];
  assert.equal(scene.title, 'Bouncing Balls');
  const w = new Phys.World();
  scene.setup(w);
  assert.equal(w.bodies.length, 16);
  assert.equal(w.bodies.filter((b) => b.static).length, 4);
  assert.equal(w.bodies.filter((b) => b.shape === 'circle').length, 12);

  // Determinism: a second setup produces identical initial positions.
  const w2 = new Phys.World();
  scene.setup(w2);
  for (let i = 0; i < 16; i++) {
    assert.equal(w.bodies[i].pos.x, w2.bodies[i].pos.x);
    assert.equal(w.bodies[i].pos.y, w2.bodies[i].pos.y);
  }

  for (let i = 0; i < 600; i++) w.step(1 / 60);
  noNaN(w);
  for (const b of w.bodies) {
    if (b.shape !== 'circle') continue;
    assert.ok(b.pos.x > -50 && b.pos.x < 950, `ball escaped x=${b.pos.x}`);
    assert.ok(b.pos.y > -50 && b.pos.y < 650, `ball escaped y=${b.pos.y}`);
  }

  const ctx = stubCtx();
  scene.render(ctx, w);
  assert.ok(ctx.calls.some(([n]) => n === 'arc'), 'render drew no circles');
  assert.ok(ctx.calls.some(([n]) => n === 'fillRect'), 'render drew no rects');
});

test('cannon: pyramid stands, fired ball demolishes it', () => {
  const scene = Scenes['cannon'];
  const w = new Phys.World();
  scene.setup(w);
  assert.equal(w.bodies.length, 11);

  // Pyramid must be stable before any shot: settle 300 frames, crates keep formation.
  const before = w.bodies.filter((b) => !b.static).map((b) => ({ x: b.pos.x, y: b.pos.y }));
  for (let i = 0; i < 300; i++) w.step(1 / 60);
  noNaN(w);
  w.bodies.filter((b) => !b.static).forEach((b, i) => {
    const d = Math.hypot(b.pos.x - before[i].x, b.pos.y - before[i].y);
    assert.ok(d < 12, `crate ${i} drifted ${d}px with no impact`);
  });

  // Fire straight right at the pyramid.
  scene.onPointer(w, 660, 500);
  assert.equal(w.bodies.length, 12);
  const ball = w.bodies[11];
  assert.equal(ball.vel.x, 900);
  assert.equal(ball.vel.y, 0);

  for (let i = 0; i < 300; i++) w.step(1 / 60);
  noNaN(w);
  const moved = w.bodies
    .filter((b) => !b.static && b.shape === 'aabb')
    .filter((b, i) => Math.hypot(b.pos.x - before[i].x, b.pos.y - before[i].y) > 30);
  assert.ok(moved.length >= 3, `impact only displaced ${moved.length} crates > 30px`);
});

test('wrecking-ball: chain holds, ball actually smashes the tower', () => {
  const scene = Scenes['wrecking-ball'];
  const w = new Phys.World();
  scene.setup(w);
  assert.equal(w.bodies.length, 24);
  assert.equal(w.constraints.length, 6);

  const boxes = w.bodies.filter((b) => b.shape === 'aabb' && !b.static);
  assert.equal(boxes.length, 16);
  const start = boxes.map((b) => ({ x: b.pos.x, y: b.pos.y }));
  const ball = w.bodies.find((b) => b.shape === 'circle' && b.r === 28);
  assert.ok(ball, 'no wrecking ball found');
  const anchor = w.bodies.find((b) => b.static && b.shape === 'circle');

  for (let i = 0; i < 900; i++) w.step(1 / 60);
  noNaN(w);

  // Anchor pinned; chain never stretches beyond ~total length + slack.
  assert.equal(anchor.pos.x, 450);
  assert.equal(anchor.pos.y, 90);
  const armLen = Math.hypot(ball.pos.x - 450, ball.pos.y - 90);
  assert.ok(armLen < 285, `chain stretched to ${armLen} (rig is 270)`);

  // The crash is real: several boxes knocked far from their tower slots.
  const smashed = boxes.filter(
    (b, i) => Math.hypot(b.pos.x - start[i].x, b.pos.y - start[i].y) > 30
  );
  assert.ok(smashed.length >= 4, `only ${smashed.length} boxes displaced > 30px — no smash`);

  const ctx = stubCtx();
  scene.render(ctx, w);
  assert.ok(ctx.calls.some(([n]) => n === 'stroke'), 'render drew no chain lines');
});
