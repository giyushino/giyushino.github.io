/* ----------------------------------------------------------------------
   ASCII scene background — the ASCIInator export rendered to a canvas that
   sits behind the page, dim until the cursor disturbs it.

   The export is a <pre> with one coloured <span> per character (~30k nodes).
   tools/build-ascii-scene.py boils that down to window.ASCII_SCENE: a flat
   char string plus one RGB triple per cell, which we draw ourselves.

   Two passes:
     base   every visible cell at low alpha, drawn once per resize into an
            offscreen canvas and blitted back whenever the light moves.
     light  cells lit by the cursor glow and by expanding ripple rings,
            redrawn at full strength on top of the dim base.

   Light is accumulated per cell (glow + every live ring) before drawing, so
   overlapping rings brighten smoothly instead of stacking into hard seams.
   Each frame only walks the cells inside the union of the live light sources.
---------------------------------------------------------------------- */
(() => {
  const canvas = document.getElementById('ascii-bg');
  const scene = window.ASCII_SCENE;
  if (!canvas || !scene) return;

  const ctx = canvas.getContext('2d');
  const base = document.createElement('canvas');
  const bctx = base.getContext('2d');

  // Cell proportions come from the export: font-size 16px, line-height 1.188,
  // and a monospace advance of 0.6em. Keeping the ratio keeps the scene from
  // stretching.
  const ADVANCE = 0.6;
  const ASPECT = 1.188 / ADVANCE;        // cell height / cell width
  // 'cover' sizes cells to fill the viewport and crops whatever overflows;
  // 'contain' shrinks them until the whole scene is on screen, which on a
  // viewport wider than the scene leaves page background down both sides.
  const FIT = 'contain';
  const SCALE = 1;                       // 1 = fill the viewport, lower = smaller glyphs
  // Where the scene sits in whatever room is left over: 0.5 centres it, 1 pins
  // it right. Biased right so it clears the hero copy, which is left-aligned in
  // a centred 940px column. It's a share of the slack rather than a pixel
  // offset, so it fades to nothing on narrow viewports that have none to give.
  const ALIGN_X = 0.8;
  const GLYPH = 1;                       // glyph size within its cell; < 1 airs the texture out
  const STACK = 'ui-monospace, "SF Mono", "IBM Plex Mono", Menlo, Consolas, monospace';

  // Cursor lighting (glow + ripples) is off for now: the scene just sits there,
  // dim and static. Flip this to true to bring the whole effect back.
  const INTERACTIVE = false;
  // Dark mode only: the scene is a bioluminescent piece and on cream it can
  // only ever be a pale wash. Set false to render it in light mode too — the
  // light ramp (RAMP_LIGHT) is still here and working.
  const DARK_ONLY = true;

  const RADIUS = 150;                    // cursor glow radius, CSS px
  const BOOST = 2.6;                     // how hard lit cells brighten (dark theme)
  const TINT = 0.28;                     // how much of the accent bleeds in

  const RING_SPEED = 0.34;               // px per ms the ring travels outward
  const RING_WIDTH = 40;                 // thickness of the bright band
  const RING_LIFE = 1400;                // ms until a ring has fully faded
  const RING_GAIN = 0.95;                // peak brightness of a ring crest
  const TRAIL_MS = 380;                  // gap between ripples while moving
  const TRAIL_MIN_D = 26;                // px of travel needed to shed one
  const MAX_RIPPLES = 14;

  // Recomputed on every resize: browser zoom changes devicePixelRatio, and a
  // value captured once at load leaves the canvas backing store at the old
  // density — which is exactly what makes the scene go blurry when zoomed.
  let dpr = 1;
  const readDpr = () => Math.min(window.devicePixelRatio || 1, 3);

  // Two scene formats: the ASCIInator export carries an RGB triple per cell,
  // tools/image-to-ascii.py carries one luminance byte (all the renderer needs,
  // since it re-colours everything through its own ramp).
  const unpack = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const rgb = scene.rgb ? unpack(scene.rgb) : null;
  const lums = scene.lum ? unpack(scene.lum) : null;
  const { cols, rows, chars } = scene;

  let accent = [61, 127, 208];
  let W = 0, H = 0, cellW = 0, cellH = 0, originX = 0, originY = 0;
  // Half a cell, snapped: glyphs are centred, so this is what keeps their
  // centres on whole device pixels instead of half-pixel boundaries.
  let halfW = 0, halfH = 0, fontPx = 0;
  let tx = -1e4, ty = -1e4, mx = -1e4, my = -1e4;
  let visible = true, hasCursor = false, painted = false;
  let lastSpawn = 0, lastSpawnX = 0, lastSpawnY = 0;

  // Live ripples: { x, y, born, gain }.
  const ripples = [];

  const isLight = () => document.documentElement.getAttribute('data-theme') === 'light';
  const parseHex = (h) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(h || '');
    return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null;
  };

  // Every cell is drawn — the water renders as a deep navy glyph field rather
  // than being dropped, so the grid is continuous. Raise WATER above 0 to cut
  // the dimmest cells and leave the brightest shapes floating on the page;
  // how much that takes depends on the scene, since each export sits at its
  // own overall brightness.
  const WATER = 0;                     // luminance cutoff, 0-255
  const RAMP_DARK = [[5, 14, 58], [42, 116, 240], [175, 228, 255]];
  // On paper the ramp runs the other way: near-paper for the darkest water,
  // deep ink blue for the brightest animals, so it reads on cream.
  const RAMP_LIGHT = [[228, 236, 248], [70, 130, 225], [6, 26, 110]];

  // Colour for cell i, or null when the cell is water/blank.
  function cellColor(i, light) {
    const ch = chars[i];
    if (ch === ' ') return null;
    const o = i * 3;
    const lum = lums ? lums[i]
      : 0.2126 * rgb[o] + 0.7152 * rgb[o + 1] + 0.0722 * rgb[o + 2];
    if (lum < WATER) return null;
    // Gentle gamma: enough to reach the ramp's vivid middle, not so much that
    // the water lifts off the background.
    const t = Math.pow(Math.min(1, (lum - WATER) / (215 - WATER)), 0.75);
    const ramp = light ? RAMP_LIGHT : RAMP_DARK;
    const seg = t < 0.5 ? 0 : 1;
    const f = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    const a = ramp[seg], b = ramp[seg + 1];
    return [
      a[0] + (b[0] - a[0]) * f,
      a[1] + (b[1] - a[1]) * f,
      a[2] + (b[2] - a[2]) * f,
    ];
  }

  // Draw the whole visible grid, dimmed, into the offscreen canvas.
  // The scene is a dark-mode piece: on paper it can only ever be a pale wash,
  // so light mode gets a clean page instead of a compromised version of this.
  function paintBase() {
    const light = isLight();
    if (light && DARK_ONLY) return;
    const alpha = light ? 0.7 : 0.85;
    // Clear the whole backing store, not W x H through the transform: those
    // differ by a fraction of a pixel and would leave a stale edge sliver.
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.clearRect(0, 0, base.width, base.height);
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bctx.font = `${fontPx}px ${STACK}`;
    bctx.textAlign = 'center';
    bctx.textBaseline = 'middle';
    bctx.globalAlpha = alpha;

    const c0 = Math.max(0, Math.floor(-originX / cellW));
    const c1 = Math.min(cols, Math.ceil((W - originX) / cellW));
    const r0 = Math.max(0, Math.floor(-originY / cellH));
    const r1 = Math.min(rows, Math.ceil((H - originY) / cellH));

    for (let r = r0; r < r1; r++) {
      for (let c = c0; c < c1; c++) {
        const i = r * cols + c;
        const col = cellColor(i, light);
        if (!col) continue;
        bctx.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`;
        bctx.fillText(chars[i], originX + c * cellW + halfW, originY + r * cellH + halfH);
      }
    }
    bctx.globalAlpha = 1;
  }

  // Copy the base canvas back at exactly 1:1. Drawing it through the dpr
  // transform instead would target W * dpr device px while the backing store
  // is a whole number of them — when those disagree by a fraction the whole
  // scene gets resampled, softening every glyph at once.
  function blit() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(base, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function resize() {
    dpr = readDpr();
    W = window.innerWidth;
    H = window.innerHeight;
    for (const el of [canvas, base]) {
      el.width = Math.round(W * dpr);
      el.height = Math.round(H * dpr);
    }
    canvas.style.width = base.style.width = W + 'px';
    canvas.style.height = base.style.height = H + 'px';

    // Everything below is snapped to whole device pixels. Canvas text gets no
    // hinting, so a fractional cell size lands every column on a different
    // subpixel phase and the rasteriser smears each glyph a different way —
    // which reads as blur rather than as the sharp grid it should be.
    const up = (v) => Math.ceil(v * dpr) / dpr;     // round up to a whole device px
    const down = (v) => Math.floor(v * dpr) / dpr;  // round down
    const near = (v) => Math.round(v * dpr) / dpr;  // round to nearest

    // The cell size that just fills the viewport (cover) or just fits inside it
    // (contain). SCALE shrinks it from there — smaller glyphs, more of the
    // scene in view. Whenever the grid doesn't span the viewport it stays
    // centred and the page background shows at the edges.
    //
    // The snap rounds whichever way preserves the intent: up so cover has no
    // seam at the edge, down so contain doesn't push the last row off screen.
    const contain = FIT === 'contain';
    const raw = (contain ? Math.min : Math.max)(W / cols, H / (rows * ASPECT));
    cellW = (contain ? down : up)(raw * SCALE);
    // Keep the cell's own proportions: rounding height independently is what
    // would squash the scene, so snap to nearest and only step down if that
    // overshoots the viewport.
    cellH = near(cellW * ASPECT);
    if (contain && rows * cellH > H) cellH = down(cellW * ASPECT);
    halfW = near(cellW / 2);
    halfH = near(cellH / 2);
    // With origin and cell both on whole device pixels, every glyph centre
    // (origin + c * cell + half) lands on one too, with no per-cell rounding.
    originX = near((W - cols * cellW) * ALIGN_X);
    originY = near((H - rows * cellH) / 2);
    fontPx = Math.max(1, Math.round(cellW / ADVANCE * GLYPH * dpr)) / dpr;

    paintBase();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = `${fontPx}px ${STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.clearRect(0, 0, W, H);
    blit();
    painted = true;              // one frame to repaint the glow after a resize
  }

  function spawn(x, y, gain) {
    if (ripples.length >= MAX_RIPPLES) ripples.shift();
    ripples.push({ x, y, born: performance.now(), gain });
    lastSpawnX = x;
    lastSpawnY = y;
  }

  // Total light on a point: the cursor glow plus every ring crest passing over
  // it. Rings are annuli — brightest exactly on the crest, falling off to
  // nothing RING_WIDTH away on either side, and dimming as the ring ages.
  function lightAt(x, y, now) {
    let v = 0;
    if (hasCursor) {
      const d = Math.hypot(x - mx, y - my);
      if (d < RADIUS) {
        const f = 1 - d / RADIUS;
        v += f * f;
      }
    }
    for (let k = 0; k < ripples.length; k++) {
      const rp = ripples[k];
      const age = now - rp.born;
      const rad = age * RING_SPEED;
      const d = Math.abs(Math.hypot(x - rp.x, y - rp.y) - rad);
      if (d > RING_WIDTH) continue;
      const band = 1 - d / RING_WIDTH;
      const fade = 1 - age / RING_LIFE;
      v += band * band * fade * fade * rp.gain;
    }
    return v > 1 ? 1 : v;
  }

  function paintLight(now) {
    const light = isLight();
    // Cell-space bounds covering every live light source.
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    if (hasCursor) {
      x0 = mx - RADIUS; x1 = mx + RADIUS;
      y0 = my - RADIUS; y1 = my + RADIUS;
    }
    for (const rp of ripples) {
      const reach = (now - rp.born) * RING_SPEED + RING_WIDTH;
      x0 = Math.min(x0, rp.x - reach); x1 = Math.max(x1, rp.x + reach);
      y0 = Math.min(y0, rp.y - reach); y1 = Math.max(y1, rp.y + reach);
    }
    if (!isFinite(x0)) return false;

    const c0 = Math.max(0, Math.floor((x0 - originX) / cellW));
    const c1 = Math.min(cols, Math.ceil((x1 - originX) / cellW));
    const r0 = Math.max(0, Math.floor((y0 - originY) / cellH));
    const r1 = Math.min(rows, Math.ceil((y1 - originY) / cellH));
    if (c1 <= c0 || r1 <= r0) return false;

    // Dark theme: add light, so cells glow above the dim base. Light theme:
    // adding light on white erases the glyphs, so paint the scene at full
    // strength instead — the light reveals the art rather than igniting it.
    ctx.globalCompositeOperation = light ? 'source-over' : 'lighter';
    const boost = light ? 0.75 : BOOST;
    let drew = false;

    for (let r = r0; r < r1; r++) {
      const y = originY + r * cellH + halfH;
      for (let c = c0; c < c1; c++) {
        const i = r * cols + c;
        const col = cellColor(i, light);
        if (!col) continue;
        const x = originX + c * cellW + halfW;
        const v = lightAt(x, y, now);
        if (v < 0.02) continue;
        const lr = col[0] * boost + accent[0] * TINT;
        const lg = col[1] * boost + accent[1] * TINT;
        const lb = col[2] * boost + accent[2] * TINT;
        ctx.globalAlpha = v;
        ctx.fillStyle = `rgb(${Math.min(255, lr) | 0},${Math.min(255, lg) | 0},${Math.min(255, lb) | 0})`;
        ctx.fillText(chars[i], x, y);
        drew = true;
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    return drew;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) return;

    // Retire ripples that have faded out or outrun the viewport diagonal.
    const reach = Math.hypot(W, H);
    for (let k = ripples.length - 1; k >= 0; k--) {
      const age = now - ripples[k].born;
      if (age > RING_LIFE || age * RING_SPEED > reach) ripples.splice(k, 1);
    }

    // Ease toward the cursor so the glow trails slightly behind it.
    const dx = tx - mx, dy = ty - my;
    const moving = Math.hypot(dx, dy) > 0.3;
    if (moving) { mx += dx * 0.18; my += dy * 0.18; }

    // Shed a ripple as the cursor travels, so movement leaves a wake.
    if (hasCursor && now - lastSpawn > TRAIL_MS &&
        Math.hypot(mx - lastSpawnX, my - lastSpawnY) > TRAIL_MIN_D) {
      spawn(mx, my, RING_GAIN);
      lastSpawn = now;
    }

    // Nothing in motion and nothing left over to clear: the canvas already
    // shows the right thing, so idle frames cost nothing.
    const active = moving || ripples.length > 0;
    if (!active && !painted) return;
    painted = active;

    ctx.clearRect(0, 0, W, H);
    blit();
    paintLight(now);
  }

  window.addEventListener('resize', resize);

  // Zooming changes devicePixelRatio, and browsers don't reliably fire resize
  // for it. A resolution media query does fire, but only for the exact density
  // it was created with, so it gets re-armed after each change.
  let dprQuery = null;
  const onDprChange = () => { resize(); watchDpr(); };
  function watchDpr() {
    if (dprQuery) dprQuery.removeEventListener('change', onDprChange);
    dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    dprQuery.addEventListener('change', onDprChange);
  }
  watchDpr();
  if (INTERACTIVE) {
    document.addEventListener('pointermove', (e) => {
      if (!hasCursor) { mx = e.clientX; my = e.clientY; hasCursor = true; }
      tx = e.clientX;
      ty = e.clientY;
    }, { passive: true });
    // A click drops a bigger, brighter ripple.
    document.addEventListener('pointerdown', (e) => {
      spawn(e.clientX, e.clientY, RING_GAIN * 1.6);
      lastSpawn = performance.now();
    }, { passive: true });
    document.addEventListener('visibilitychange', () => { visible = !document.hidden; });
  }

  // Follow the nav's colour picker, same channel ascii-brush.js listens on.
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'setHue') {
      const c = parseHex(e.data.color);
      if (c) accent = c;
    }
  });
  // Accent is stored per theme; hue.js also broadcasts it on load.
  const savedKey = isLight() ? 'hue-light' : 'hue-dark';
  const saved = parseHex(localStorage.getItem(savedKey));
  if (saved) accent = saved;

  // The dim level differs per theme, so repaint when the theme flips.
  new MutationObserver(resize).observe(document.documentElement, {
    attributes: true, attributeFilter: ['data-theme'],
  });

  resize();
  if (INTERACTIVE && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    requestAnimationFrame(frame);
  }
})();
