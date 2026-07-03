globalThis.Phys = globalThis.Phys || {};

(() => {
const Phys = globalThis.Phys;

// Create a 2D vector
Phys.v = function(x, y) {
  return { x, y };
};

// Add two vectors
Phys.add = function(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
};

// Subtract two vectors
Phys.sub = function(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
};

// Scale a vector
Phys.scale = function(a, s) {
  return { x: a.x * s, y: a.y * s };
};

// Dot product
Phys.dot = function(a, b) {
  return a.x * b.x + a.y * b.y;
};

// Length squared
Phys.len2 = function(a) {
  return a.x * a.x + a.y * a.y;
};

// Length
Phys.len = function(a) {
  return Math.sqrt(Phys.len2(a));
};

// Distance between two points
Phys.dist = function(a, b) {
  return Phys.len(Phys.sub(b, a));
};

// Normalize a vector; returns {0,0} for zero-length input
Phys.norm = function(a) {
  const length = Phys.len(a);
  if (length === 0) {
    return { x: 0, y: 0 };
  }
  return { x: a.x / length, y: a.y / length };
};

// Perpendicular (90° counter-clockwise: (-y, x))
Phys.perp = function(a) {
  return { x: -a.y, y: a.x };
};

// Clone a vector
Phys.clone = function(a) {
  return { x: a.x, y: a.y };
};
})();
