/* ----------------------------------------------------------------------
   ASCII brush trail — a brush of glyphs follows the cursor and the trail
   fades toward the background over time.

   Far cheaper than the plasma: per frame we paint ONE low-alpha bg rect
   over the whole canvas (the fade) plus a few glyphs near the cursor.
   Cost is roughly constant regardless of canvas size — no per-cell loop.
---------------------------------------------------------------------- */
(() => {
  const canvas = document.getElementById('ascii-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const BG = '#0a0a0b';               // matches --bg; the trail fades to this
  const FADE = 'rgba(10,10,11,0.1)'; // same color, low alpha = fade-per-frame
  let COLOR_HI = '#619ee8';           // accent; updated live via setHue
  const RAMP = '·:-=+*#%▒▓█'.split('');

  const FONT_PX = 14;
  const FONT = `${FONT_PX}px "JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace`;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  const BRUSH_R = 26;   // brush radius in px
  const STAMP_GAP = 6;  // px between stamps along the movement path
  const GLYPHS = 5;     // glyphs dropped per stamp

  let W = 0, H = 0, visible = true;
  // cursor (target) and eased brush position, both in CSS px
  let tx = 0, ty = 0, mx = 0, my = 0, hasMoved = false;

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
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);  // start from a clean background
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
  function stamp(x, y) {
    for (let k = 0; k < GLYPHS; k++) {
      const a = Math.random() * Math.PI * 2;
      const rr = Math.random() * BRUSH_R;
      const f = 1 - rr / BRUSH_R;                 // 0..1 closeness to center
      const gi = Math.min(RAMP.length - 1, (f * RAMP.length) | 0);
      ctx.globalAlpha = 0.35 + f * 0.5;
      ctx.fillText(RAMP[gi], x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
  }

  // ~30fps cap — plenty for a trail, half the cost of running at 60fps.
  const FRAME_MS = 1000 / 60;
  let last = performance.now(), acc = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) { last = now; return; }
    acc += now - last; last = now;
    if (acc < FRAME_MS) return;
    acc %= FRAME_MS;

    // Fade the whole canvas toward bg — this is the "colors fade over time".
    ctx.globalAlpha = 1;
    ctx.fillStyle = FADE;
    ctx.fillRect(0, 0, W, H);

    // Ease the brush toward the cursor for a bit of weight/lag.
    const px = mx, py = my;
    mx += (tx - mx) * 0.2;
    my += (ty - my) * 0.2;

    // Stamp along the path so fast moves stay continuous (no dotted gaps).
    ctx.fillStyle = COLOR_HI;
    const dx = mx - px, dy = my - py;
    const steps = Math.max(1, (Math.hypot(dx, dy) / STAMP_GAP) | 0);
    for (let s = 1; s <= steps; s++) stamp(px + dx * (s / steps), py + dy * (s / steps));

    // Bright head at the current position so the cursor tip pops.
    const full = RAMP[RAMP.length - 1];
    ctx.globalAlpha = 1;
    ctx.fillText(full, mx, my);
    for (let k = 0; k < 3; k++) {
      const a = Math.random() * Math.PI * 2;
      const rr = Math.random() * (BRUSH_R * 0.4);
      ctx.globalAlpha = 0.85;
      ctx.fillText(full, mx + Math.cos(a) * rr, my + Math.sin(a) * rr);
    }
    ctx.globalAlpha = 1;
  }
  requestAnimationFrame(frame);
})();
