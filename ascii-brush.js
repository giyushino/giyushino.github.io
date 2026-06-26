/* ----------------------------------------------------------------------
   ASCII brush trail — a brush of glyphs follows the cursor and the trail
   fades to nothing over time.

   We keep a list of recently-dropped glyphs (position, char, base alpha,
   birth time) and every frame we clear the canvas and redraw the live ones
   with alpha scaled by their age. A glyph past its lifetime is dropped.

   This avoids fading by repeatedly compositing a translucent rect over the
   canvas: that approach (toward a bg color OR via destination-out) leaves an
   8-bit rounding residue — a pixel stuck one notch above zero forever — which
   shows up as a lingering gray trail. Clear+redraw reaches a true zero.
   Cost scales with the number of live glyphs, which a short lifetime keeps small.
---------------------------------------------------------------------- */
(() => {
  const canvas = document.getElementById('ascii-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let COLOR_HI = '#619ee8';           // accent; updated live via setHue
  const RAMP = '·:-=+*#%▒▓█'.split('');

  const FONT_PX = 14;
  const FONT = `${FONT_PX}px "JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace`;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  const BRUSH_R = 26;     // brush radius in px
  const STAMP_GAP = 6;    // px between stamps along the movement path
  const GLYPHS = 5;       // glyphs dropped per stamp
  // Exponential decay: a glyph keeps ~DECAY of its alpha each ~frame, like the
  // old translucent-rect fade (crisp bright head, long soft tail). We drop it
  // once it falls below MIN_A — that's what makes it vanish cleanly instead of
  // leaving the 8-bit gray residue the canvas-fade left behind.
  const DECAY = 0.9;
  const MIN_A = 0.02;

  let W = 0, H = 0, visible = true;
  // cursor (target) and eased brush position, both in CSS px
  let tx = 0, ty = 0, mx = 0, my = 0, hasMoved = false;

  // Live glyphs: each is { x, y, ch, a0 (base alpha), born (ms) }.
  const glyphs = [];

  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'setHue' && typeof e.data.color === 'string') {
      COLOR_HI = e.data.color;
    }
  });

  function resize() {
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.font = FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.clearRect(0, 0, W, H);  // transparent; page bg shows through
    if (!hasMoved) { tx = mx = W / 2; ty = my = H * 0.4; }
  }
  window.addEventListener('resize', resize);
  resize();

  function onMove(e) {
    const r = canvas.getBoundingClientRect();
    tx = e.clientX - r.left;
    ty = e.clientY - r.top;
    if (!hasMoved) { mx = tx; my = ty; hasMoved = true; }
  }
  document.addEventListener('pointermove', onMove);

  // Pause when the hero is offscreen or the tab is hidden.
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) visible = e.isIntersecting;
  }, { threshold: 0 });
  io.observe(canvas);
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; });

  // Drop a cluster of glyphs around (x, y); denser/brighter near the center.
  function stamp(x, y, now) {
    for (let k = 0; k < GLYPHS; k++) {
      const a = Math.random() * Math.PI * 2;
      const rr = Math.random() * BRUSH_R;
      const f = 1 - rr / BRUSH_R;                 // 0..1 closeness to center
      const gi = Math.min(RAMP.length - 1, (f * RAMP.length) | 0);
      glyphs.push({
        x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr,
        ch: RAMP[gi], a0: 0.35 + f * 0.5, born: now,
      });
    }
  }

  // ~60fps cap.
  const FRAME_MS = 1000 / 60;
  let last = performance.now(), acc = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) { last = now; return; }
    acc += now - last; last = now;
    if (acc < FRAME_MS) return;
    acc %= FRAME_MS;

    // Ease the brush toward the cursor for a bit of weight/lag.
    const px = mx, py = my;
    mx += (tx - mx) * 0.2;
    my += (ty - my) * 0.2;

    // Stamp along the path so fast moves stay continuous (no dotted gaps).
    const dx = mx - px, dy = my - py;
    const steps = Math.max(1, (Math.hypot(dx, dy) / STAMP_GAP) | 0);
    for (let s = 1; s <= steps; s++) stamp(px + dx * (s / steps), py + dy * (s / steps), now);

    // Bright head at the current position so the cursor tip pops.
    const full = RAMP[RAMP.length - 1];
    glyphs.push({ x: mx, y: my, ch: full, a0: 1, born: now });
    for (let k = 0; k < 3; k++) {
      const a = Math.random() * Math.PI * 2;
      const rr = Math.random() * (BRUSH_R * 0.4);
      glyphs.push({ x: mx + Math.cos(a) * rr, y: my + Math.sin(a) * rr, ch: full, a0: 0.85, born: now });
    }

    // Redraw the whole trail from scratch each frame. Alpha goes to a true 0,
    // so faded glyphs vanish completely — no leftover gray.
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = COLOR_HI;
    let w = 0;  // write index: compact the array, dropping dead glyphs
    for (let i = 0; i < glyphs.length; i++) {
      const g = glyphs[i];
      // Exponential falloff, frame-rate independent via age-in-frames.
      const a = g.a0 * Math.pow(DECAY, (now - g.born) / FRAME_MS);
      if (a < MIN_A) continue;
      ctx.globalAlpha = a;
      ctx.fillText(g.ch, g.x, g.y);
      glyphs[w++] = g;
    }
    glyphs.length = w;
    ctx.globalAlpha = 1;
  }
  requestAnimationFrame(frame);
})();
