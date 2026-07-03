globalThis.Phys = globalThis.Phys || {};

Phys.createLoop = function(opts) {
  const step = opts.step;
  const render = opts.render;
  const dt = opts.dt !== undefined ? opts.dt : 1/60;
  const maxSteps = opts.maxSteps !== undefined ? opts.maxSteps : 5;

  let last = null;
  let acc = 0;
  let running = false;

  function tick(nowMs) {
    // Step 1: If last === null, record time and return 0
    if (last === null) {
      last = nowMs;
      return 0;
    }

    // Step 2: Calculate delta and update last
    let delta = (nowMs - last) / 1000;
    last = nowMs;

    // Step 3: Clamp delta
    if (delta > 0.25) {
      delta = 0.25;
    }
    if (delta < 0) {
      delta = 0;
    }

    // Step 4: Accumulate time
    acc += delta;

    // Step 5: Execute fixed steps
    let steps = 0;
    while (acc >= dt && steps < maxSteps) {
      step(dt);
      acc -= dt;
      steps++;
    }

    // Step 6: Guard against spiral of death
    if (steps === maxSteps && acc >= dt) {
      acc = 0;
    }

    // Step 7: Render with interpolation
    if (render) {
      render(acc / dt);
    }

    // Step 8: Return number of steps executed
    return steps;
  }

  function start() {
    if (typeof globalThis.requestAnimationFrame !== 'function') {
      return false;
    }

    running = true;

    function loop(timestamp) {
      tick(timestamp);
      if (running) {
        globalThis.requestAnimationFrame(loop);
      }
    }

    globalThis.requestAnimationFrame(loop);
    return true;
  }

  function stop() {
    running = false;
  }

  return { tick, start, stop };
};
