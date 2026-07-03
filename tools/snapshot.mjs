// Headless scene snapshotter: runs a scene's real setup/step/render with a
// software-rasterizer stand-in for CanvasRenderingContext2D, and writes PNG
// frames. This is the capture path for judging the scenes without a browser.
//
//   node tools/snapshot.mjs <scene-key> <outDir> <t1> [t2 ...]
//   e.g. node tools/snapshot.mjs wrecking-ball ./shots 0.9 1.6 4
//
// For the cannon scene, a shot is fired at t=0.5s toward (640, 480).
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join } from 'node:path';

await import('../src/engine/vec2.js');
await import('../src/engine/collide.js');
await import('../src/engine/resolve.js');
await import('../src/engine/world.js');
await import('../scenes/js/bouncing-balls.js');
await import('../scenes/js/cannon.js');
await import('../scenes/js/wrecking-ball.js');

// ---------- software canvas ----------
function makeCtx(width, height) {
  const px = new Uint8Array(width * height * 3);
  let path = []; // {type:'arc',x,y,r} | {type:'move'|'line',x,y}
  const color = (hex) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const set = (x, y, [r, g, b]) => {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 3;
    px[i] = r; px[i + 1] = g; px[i + 2] = b;
  };
  const ctx = {
    px, width, height,
    fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1,
    fillRect(x, y, w, h) {
      const c = color(this.fillStyle);
      for (let yy = Math.max(0, y | 0); yy < Math.min(height, y + h); yy++)
        for (let xx = Math.max(0, x | 0); xx < Math.min(width, x + w); xx++)
          set(xx, yy, c);
    },
    beginPath() { path = []; },
    arc(x, y, r) { path.push({ type: 'arc', x, y, r }); },
    moveTo(x, y) { path.push({ type: 'move', x, y }); },
    lineTo(x, y) { path.push({ type: 'line', x, y }); },
    fill() {
      const c = color(this.fillStyle);
      for (const p of path) {
        if (p.type !== 'arc') continue;
        const r2 = p.r * p.r;
        for (let yy = Math.ceil(p.y - p.r); yy <= p.y + p.r; yy++)
          for (let xx = Math.ceil(p.x - p.r); xx <= p.x + p.r; xx++)
            if ((xx - p.x) ** 2 + (yy - p.y) ** 2 <= r2) set(xx, yy, c);
      }
    },
    stroke() {
      const c = color(this.strokeStyle);
      const hw = Math.max(1, this.lineWidth) / 2;
      let cur = null;
      for (const p of path) {
        if (p.type === 'move') { cur = p; continue; }
        if (p.type !== 'line' || !cur) continue;
        const steps = Math.ceil(Math.hypot(p.x - cur.x, p.y - cur.y)) * 2 + 1;
        for (let s = 0; s <= steps; s++) {
          const x = cur.x + ((p.x - cur.x) * s) / steps;
          const y = cur.y + ((p.y - cur.y) * s) / steps;
          for (let dy = -hw; dy <= hw; dy++)
            for (let dx = -hw; dx <= hw; dx++) set(x + dx, y + dy, c);
        }
        cur = p;
      }
    },
  };
  return ctx;
}

// ---------- minimal PNG encoder (color type 2, 8-bit RGB) ----------
const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
};
function encodePng({ px, width, height }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit, RGB
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0; // filter: none
    Buffer.from(px.buffer, y * width * 3, width * 3)
      .copy(raw, y * (width * 3 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- run ----------
const [key, outDir, ...timesRaw] = process.argv.slice(2);
const scene = globalThis.Scenes[key];
if (!scene) throw new Error(`unknown scene '${key}'`);
const times = timesRaw.map(Number).sort((a, b) => a - b);
mkdirSync(outDir, { recursive: true });

const world = new globalThis.Phys.World();
scene.setup(world);

const dt = 1 / 60;
let t = 0;
let fired = false;
for (const target of times) {
  while (t < target - 1e-9) {
    if (key === 'cannon' && !fired && t >= 0.5) {
      scene.onPointer(world, 640, 480);
      fired = true;
    }
    world.step(dt);
    t += dt;
  }
  const ctx = makeCtx(scene.width, scene.height);
  scene.render(ctx, world);
  const file = join(outDir, `${key}-${target.toFixed(2)}s.png`);
  writeFileSync(file, encodePng(ctx));
  console.log(file);
}
