/* ----------------------------------------------------------------------
   ASCII koi (realistic) — Kohaku-style koi swim around the hero, drawn
   entirely with text glyphs.

   Body: a spine (follow-the-leader chain) so it curves and swims. At each
   segment we draw a row of glyphs across the width, shaded by a density
   ramp and tinted by a koi color map (white base, orange/red blanket with
   a white channel, black sumi spots). A traveling wave makes it undulate.
   Big translucent pectoral + caudal fins are drawn as soft glyph fans.

   Cheap: a few hundred glyph fills per frame, no per-pixel work.
---------------------------------------------------------------------- */
(() => {
  const canvas = document.getElementById('ascii-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const BG = '#0a0a0b';
  const FADE = 'rgba(10,10,11,0.5)';   // crisp-ish, short wake
  const WHITE  = '#e9edf0';
  const ORANGE = '#ef5a22';
  const RED    = '#d4380f';
  const BLACK  = '#17171b';
  const FIN    = '225,231,238';        // rgb for translucent fins

  const FONT_PX = 14;
  const FONT = `${FONT_PX}px "JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace`;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  const SEGMENTS = 26;
  const LINK = 9;          // px between spine points
  const STEP = 6;          // px between glyphs across the width
  const MAX_HALF = 4;      // max half-width in glyph columns
  const WAVE_K = 0.45;

  let W = 0, H = 0, visible = true;
  const fish = [];

  function makeFish(speed, scale) {
    const f = { x: 0, y: 0, angle: Math.random() * 6.28,
                speed, scale, swim: Math.random() * 10, fin: Math.random() * 10,
                tx: 0, ty: 0, spine: [] };
    f.x = Math.random() * 500 + 120; f.y = Math.random() * 250 + 90;
    for (let i = 0; i < SEGMENTS; i++)
      f.spine.push({ x: f.x - Math.cos(f.angle) * LINK * i,
                     y: f.y - Math.sin(f.angle) * LINK * i });
    pickTarget(f);
    return f;
  }
  function pickTarget(f) {
    const m = 110;
    f.tx = m + Math.random() * Math.max(1, W - 2 * m);
    f.ty = m + Math.random() * Math.max(1, H - 2 * m);
  }

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
    ctx.fillRect(0, 0, W, H);
    if (!fish.length) { fish.push(makeFish(1.05, 1.0)); fish.push(makeFish(0.8, 0.72)); }
    else for (const f of fish) pickTarget(f);
  }
  window.addEventListener('resize', resize);
  resize();

  const io = new IntersectionObserver((es) => { for (const e of es) visible = e.isIntersecting; },
                                      { threshold: 0 });
  io.observe(canvas);
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; });

  // thin rounded nose -> broad just behind head -> taper to tail
  function widthAt(t) {
    const tt = Math.pow(t, 0.62);
    const w = Math.pow(Math.sin(Math.PI * tt), 0.62);
    return t < 0.2 ? Math.max(w, 0.45) : w;   // round the nose a bit
  }

  // koi color map. t: 0(head)->1(tail), u: -1..1 across the body
  const SPOTS = [[0.10, 0.25], [0.13, -0.18], [0.43, -0.28], [0.38, 0.18], [0.6, -0.08]];
  function colorAt(t, u) {
    for (const [st, su] of SPOTS) {
      const dt = (t - st) * 3.0, du = u - su;
      if (dt * dt + du * du < 0.02) return BLACK;
    }
    if (t > 0.06 && t < 0.2 && u > -0.2 && u < 0.85) return ORANGE; // head cheek
    const edge = 0.85 + 0.12 * Math.sin(t * 16 + 1.5);             // wavy blanket edge
    if (t > 0.27 && t < 0.74 && Math.abs(u) < edge) {
      if (u > -0.16 && u < 0.18 && t > 0.45 && t < 0.7) return WHITE; // white channel
      return t > 0.6 ? RED : ORANGE;
    }
    if (t > 0.78 && t < 0.9 && Math.abs(u) < 0.5) return ORANGE;   // tail base
    return WHITE;
  }
  function bodyGlyph(edge) {
    if (edge < 0.45) return '█';
    if (edge < 0.72) return '▓';
    if (edge < 0.9) return '▒';
    return '░';
  }

  function update(f) {
    let desired = Math.atan2(f.ty - f.y, f.tx - f.x);
    desired += Math.sin(f.swim * 0.4) * 0.18;
    let diff = ((desired - f.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    f.angle += Math.max(-0.04, Math.min(0.04, diff));
    f.x += Math.cos(f.angle) * f.speed;
    f.y += Math.sin(f.angle) * f.speed;
    if (Math.hypot(f.tx - f.x, f.ty - f.y) < 80 || Math.random() < 0.003) pickTarget(f);

    f.spine[0].x = f.x; f.spine[0].y = f.y;
    for (let i = 1; i < SEGMENTS; i++) {
      const a = f.spine[i - 1], b = f.spine[i];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      b.x = a.x + (dx / d) * LINK; b.y = a.y + (dy / d) * LINK;
    }
    f.swim += f.speed * 0.12;
    f.fin += 0.07;
  }

  // soft translucent fan of glyphs (fins / tail)
  function fan(x, y, baseAng, spread, rays, len, intensity) {
    for (let k = 0; k < rays; k++) {
      const ang = baseAng + (k / (rays - 1) - 0.5) * spread;
      const steps = 6;
      for (let s = 1; s <= steps; s++) {
        const r = (s / steps) * len;
        ctx.globalAlpha = intensity * (1 - s / steps) * 0.9;
        ctx.fillText(s < steps * 0.5 ? ':' : '·',
                     x + Math.cos(ang) * r, y + Math.sin(ang) * r);
      }
    }
  }

  function draw(f) {
    const sc = f.scale;
    const pts = new Array(SEGMENTS);
    for (let i = 0; i < SEGMENTS; i++) {
      const a = f.spine[i], b = f.spine[Math.min(i + 1, SEGMENTS - 1)];
      let dx = a.x - b.x, dy = a.y - b.y; const d = Math.hypot(dx, dy) || 1;
      dx /= d; dy /= d;
      const px = -dy, py = dx, t = i / (SEGMENTS - 1);
      const amp = (2 + t * 8) * sc;
      const off = Math.sin(f.swim - i * WAVE_K) * amp;
      pts[i] = { x: a.x + px * off, y: a.y + py * off, px, py, dx, dy, t };
    }

    // --- caudal tail fin (drawn first, behind body) ---
    const tail = pts[SEGMENTS - 1];
    const sweep = Math.sin(f.swim) * 0.35;
    const tailAng = Math.atan2(-tail.dy, -tail.dx) + sweep;
    ctx.fillStyle = `rgba(${FIN},1)`;
    fan(tail.x, tail.y, tailAng, 1.1, 9, 46 * sc, 0.22);

    // --- pectoral fins ---
    const pi = Math.round(SEGMENTS * 0.3), fp = pts[pi];
    const flap = 0.5 + 0.5 * Math.sin(f.fin);
    const base = widthAt(fp.t) * MAX_HALF * STEP * sc;
    for (const side of [-1, 1]) {
      const bx = fp.x + fp.px * base * side, by = fp.y + fp.py * base * side;
      const outAng = Math.atan2(fp.py * side, fp.px * side) + side * 0.4 - 0.15 * side;
      fan(bx, by, outAng - fp.dx * 0, 0.9, 6, (20 + flap * 12) * sc, 0.2);
    }

    // --- body ---
    for (let i = 0; i < SEGMENTS; i++) {
      const p = pts[i];
      const hw = Math.round(widthAt(p.t) * MAX_HALF * sc);
      for (let w = -hw; w <= hw; w++) {
        const u = hw === 0 ? 0 : w / hw;
        const edge = Math.abs(u);
        ctx.fillStyle = colorAt(p.t, u);
        ctx.globalAlpha = 1 - edge * 0.45;
        ctx.fillText(bodyGlyph(edge),
                     p.x + p.px * (w * STEP * sc), p.y + p.py * (w * STEP * sc));
      }
    }

    // --- eyes near the nose ---
    const head = pts[2];
    ctx.fillStyle = BLACK; ctx.globalAlpha = 0.9;
    const er = 5 * sc;
    ctx.fillText('•', head.x + head.px * er, head.y + head.py * er);
    ctx.fillText('•', head.x - head.px * er, head.y - head.py * er);
    ctx.globalAlpha = 1;
  }

  const FRAME_MS = 1000 / 30;
  let last = performance.now(), acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) { last = now; return; }
    acc += now - last; last = now;
    if (acc < FRAME_MS) return;
    acc %= FRAME_MS;
    ctx.globalAlpha = 1; ctx.fillStyle = FADE; ctx.fillRect(0, 0, W, H);
    for (const f of fish) { update(f); draw(f); }
  }
  requestAnimationFrame(frame);
})();
