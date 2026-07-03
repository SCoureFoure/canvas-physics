# canvas-physics

Self-contained HTML5 canvas scenes driven by a real 2D rigid-body physics engine — semi-implicit Euler integration, impulse-based collision resolution with restitution and Coulomb friction, positional correction, rigid distance constraints, fixed-timestep loop with accumulator. No dependencies, no build step.

## Scenes

| Scene | Description |
|-------|-------------|
| bouncing-balls.html | 12 seeded balls bouncing in a box |
| cannon.html | Click to fire cannonballs at a crate pyramid |
| wrecking-ball.html | Chained wrecking ball demolishes two box towers |

Note: open each file directly in a browser — file:// works, no server needed.

## Engine

- **src/engine/vec2.js** — vector math
- **src/engine/collide.js** — narrow-phase: circle/circle, circle/AABB, AABB/AABB → contact normal + depth
- **src/engine/resolve.js** — impulse resolution: restitution, friction cone clamp, positional correction with slop
- **src/engine/world.js** — body factory, gravity, distance constraints — 8 position iterations + velocity pass — 4 collision solver passes per step
- **src/engine/loop.js** — fixed-timestep accumulator, spiral-of-death guard

Engine files attach to globalThis.Phys, so they load as plain browser scripts AND as side-effect imports in Node — that is what makes the test suite headless.

## Tests

```
npm test
```

Headless: the same engine + scene files run under node:test; scenes are verified by stepping the simulation (e.g. the wrecking ball must actually knock the tower over) rather than by rendering.
