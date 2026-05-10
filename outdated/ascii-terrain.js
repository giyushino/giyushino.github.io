/* -------------------------------------------------------------------------
   Loss landscape terrain — procedural 3D wireframe with mouse traversal.
   Mouse X pans camera left/right; mouseY subtly pitches; terrain drifts
   forward automatically. Pre-computed color palette avoids per-frame
   string allocation.
------------------------------------------------------------------------- */
(() => {
  const canvas = document.getElementById('ascii-canvas');
  const ctx = canvas.getContext('2d');

  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;

  // Smooth camera state
  let camZ = 0;
  let camX = 0;
  let mouseX = 0.5, mouseY = 0.5;
  let targetMX = 0.5, targetMY = 0.5;

  // Accent color (lime green default — updated by hue picker)
  let acR = 164, acG = 252, acB = 111;

  // Perspective constants
  const BASE_PITCH = 0.86;  // ~49° looking down
  const PITCH_VARY = 0.10;  // ±~6° with mouse Y
  const CAM_H     = 13;     // camera height above terrain baseline
  const FOCAL     = 460;    // perspective focal length (px)
  const HORIZ_Y   = 0.38;   // screen fraction where horizon sits

  // Grid
  const COLS   = 60;
  const ROWS   = 48;
  const SPREAD = 32;   // ±world units left/right of camera
  const NEAR   = 3;    // closest z-depth rendered
  const FAR    = 52;   // furthest z-depth rendered

  let visible = true, t = 0, last = performance.now();

  // Per-point buffers — avoid allocation in hot path
  const pts = new Float32Array(COLS * ROWS * 3); // [sx, sy, Zcam] per point
  const ht  = new Float32Array(COLS * ROWS);     // height per point

  // Pre-computed colour palette: N_HQ height buckets × N_AQ alpha buckets
  const N_HQ = 48, N_AQ = 12;
  const palette = new Array(N_HQ * N_AQ);

  function buildColor(h, alpha) {
    const f = Math.max(0, Math.min(1, (h + 6.5) / 13));
    let r, g, b;
    if (f < 0.22) {
      const q = f / 0.22;
      r = 4  + q * 8  | 0;
      g = 4  + q * 8  | 0;
      b = 10 + q * 22 | 0;
    } else if (f < 0.50) {
      const q = (f - 0.22) / 0.28;
      r = 12 + q * 22 | 0;
      g = 12 + q * 26 | 0;
      b = 32 + q * 32 | 0;
    } else if (f < 0.76) {
      const q = (f - 0.50) / 0.26;
      r = 34 + q * (acR * 0.45 - 34) | 0;
      g = 38 + q * (acG * 0.45 - 38) | 0;
      b = 64 + q * (acB * 0.45 - 64) | 0;
    } else {
      const q = (f - 0.76) / 0.24;
      r = acR * 0.45 + q * acR * 0.55 | 0;
      g = acG * 0.45 + q * acG * 0.55 | 0;
      b = acB * 0.45 + q * acB * 0.55 | 0;
    }
    return `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
  }

  function buildPalette() {
    for (let hi = 0; hi < N_HQ; hi++) {
      const h = -6.5 + (hi + 0.5) / N_HQ * 13;
      for (let ai = 0; ai < N_AQ; ai++) {
        const alpha = 0.14 + (ai / (N_AQ - 1)) * 0.74;
        palette[hi * N_AQ + ai] = buildColor(h, alpha);
      }
    }
  }

  function lookupColor(h, Zcam) {
    const fadeT = Math.max(0, Math.min(1, (Zcam - NEAR) / (FAR - NEAR)));
    const alpha = 0.88 - fadeT * 0.64; // 0.88 near → 0.24 far
    const hi = Math.max(0, Math.min(N_HQ - 1, (h + 6.5) / 13 * N_HQ | 0));
    const ai = Math.max(0, Math.min(N_AQ - 1, (alpha - 0.14) / 0.74 * (N_AQ - 1) + 0.5 | 0));
    return palette[hi * N_AQ + ai];
  }

  buildPalette();

  // Terrain height from multi-octave sine (incommensurate frequencies → no
  // obvious tiling). Total amplitude roughly ±7 world units.
  function terrain(x, z) {
    return (
      Math.sin(x * 0.31 + z * 0.19) * 2.8 +
      Math.sin(x * 0.74 + z * 0.53 + 1.7) * 1.4 +
      Math.sin(x * 0.13 - z * 0.47 + 0.9) * 1.8 +
      Math.sin(x * 1.52 + z * 1.13 - 2.3) * 0.7 +
      Math.sin(x * 2.87 - z * 2.05 + 1.1) * 0.35
    );
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width  = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  function onMove(e) {
    const r = canvas.getBoundingClientRect();
    targetMX = (e.clientX - r.left) / r.width;
    targetMY = (e.clientY - r.top)  / r.height;
  }
  document.addEventListener('pointermove', onMove);

  const io = new IntersectionObserver(entries => {
    for (const e of entries) visible = e.isIntersecting;
  }, { threshold: 0 });
  io.observe(canvas);
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    if (visible) last = performance.now();
  });

  window.addEventListener('message', e => {
    if (e.data?.type === 'setHue' && typeof e.data.color === 'string') {
      const hex = e.data.color;
      if (hex[0] === '#' && hex.length === 7) {
        acR = parseInt(hex.slice(1, 3), 16);
        acG = parseInt(hex.slice(3, 5), 16);
        acB = parseInt(hex.slice(5, 7), 16);
        buildPalette();
      }
    }
  });

  function frame(now) {
    if (!visible) { last = now; requestAnimationFrame(frame); return; }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;

    // Smooth mouse tracking
    mouseX += (targetMX - mouseX) * 0.06;
    mouseY += (targetMY - mouseY) * 0.06;

    // Camera: drift forward, pan with mouse X
    camZ += dt * 2.0;
    camX += ((mouseX - 0.5) * 30 - camX) * 0.04;

    // Pitch shifts subtly with mouse Y
    const pitch = BASE_PITCH + (mouseY - 0.5) * PITCH_VARY;
    const SP = Math.sin(pitch), CP = Math.cos(pitch);

    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 1.0;

    // --- Project all grid points into screen space ---
    for (let iz = 0; iz < ROWS; iz++) {
      const wz = camZ + NEAR + (FAR - NEAR) * (iz / (ROWS - 1));
      for (let ix = 0; ix < COLS; ix++) {
        const wx  = camX + (-SPREAD + (2 * SPREAD) * (ix / (COLS - 1)));
        const h   = terrain(wx, wz);
        const idx = iz * COLS + ix;
        ht[idx] = h;

        // Camera-space transform (pitch rotation around X axis)
        const dx   = wx - camX;
        const dy   = h  - CAM_H;
        const dz   = wz - camZ;
        const Zcam = -dy * SP + dz * CP;
        if (Zcam < 0.5) { pts[idx * 3] = NaN; continue; }
        const Ycam = dy * CP + dz * SP;
        const sc   = FOCAL / Zcam;
        pts[idx * 3    ] = W / 2 + dx * sc;
        pts[idx * 3 + 1] = H * HORIZ_Y - Ycam * sc;
        pts[idx * 3 + 2] = Zcam;
      }
    }

    // --- Horizontal lines (constant iz, back-to-front for depth order) ---
    for (let iz = ROWS - 1; iz >= 0; iz--) {
      for (let ix = 0; ix < COLS - 1; ix++) {
        const i0 = iz * COLS + ix, i1 = i0 + 1;
        const x0 = pts[i0 * 3], y0 = pts[i0 * 3 + 1];
        const x1 = pts[i1 * 3], y1 = pts[i1 * 3 + 1];
        if (isNaN(x0) || isNaN(x1)) continue;
        ctx.strokeStyle = lookupColor(
          (ht[i0] + ht[i1]) * 0.5,
          (pts[i0 * 3 + 2] + pts[i1 * 3 + 2]) * 0.5
        );
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
    }

    // --- Vertical lines (constant ix) ---
    for (let ix = 0; ix < COLS; ix++) {
      for (let iz = 0; iz < ROWS - 1; iz++) {
        const i0 = iz * COLS + ix, i1 = i0 + COLS;
        const x0 = pts[i0 * 3], y0 = pts[i0 * 3 + 1];
        const x1 = pts[i1 * 3], y1 = pts[i1 * 3 + 1];
        if (isNaN(x0) || isNaN(x1)) continue;
        ctx.strokeStyle = lookupColor(
          (ht[i0] + ht[i1]) * 0.5,
          (pts[i0 * 3 + 2] + pts[i1 * 3 + 2]) * 0.5
        );
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
