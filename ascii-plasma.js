/* ----------------------------------------------------------------------
   Plasma / interference waves — two sine sources + cursor source,
   density maps to block glyph ramp for a smooth shaded look.
   Optimized: glyph atlas (drawImage instead of fillText), tier
   bucketing (one alpha change per tier), per-column trig caching,
   pause when offscreen / tab hidden.
---------------------------------------------------------------------- */
(() => {
  const canvas = document.getElementById('ascii-canvas');
  const ctx = canvas.getContext('2d');
  const RAMP = ' ·:-=+*#%▒▓█'.split('');
  // const RAMP = ' .,:;+x%#&@█'.split('');
  const COLOR_DIM = '#2a2a2c';
  const COLOR_MID = '#5a5a58';
  let COLOR_HI  = '#a4fc6f';

  const FONT_PX = 14;
  // Perf tuning: was 9x15. Larger cells mean fewer glyphs per frame.
  const CELL_X = 11, CELL_Y = 18;
  const FONT = `${FONT_PX}px "JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace`;

  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0, COLS = 0, ROWS = 0;
  let mouseX = 0.5, mouseY = 0.3;
  let targetX = 0.5, targetY = 0.3;
  let visible = true;

  // per-row / per-col caches
  let uCol = new Float32Array(0);
  let u14Col = new Float32Array(0);
  let cosUCol = new Float32Array(0);
  let xCol = new Float32Array(0);
  let s1Col = new Float32Array(0);
  let vRow = new Float32Array(0);
  let yRow = new Float32Array(0);

  // tier buckets — flat [i, j, glyphIdx, ...]
  let bucketHI, bucketMID, bucketDIM, capCells = 0;

  // glyph atlas: 3 color tiers (rows) × RAMP.length glyphs (cols)
  const atlas = document.createElement('canvas');
  const ax = atlas.getContext('2d');
  function buildAtlas() {
    atlas.width = Math.ceil(CELL_X * RAMP.length * DPR);
    atlas.height = Math.ceil(CELL_Y * 3 * DPR);
    ax.setTransform(DPR, 0, 0, DPR, 0, 0);
    ax.clearRect(0, 0, atlas.width / DPR, atlas.height / DPR);
    ax.font = FONT;
    ax.textBaseline = 'top';
    const colors = [COLOR_DIM, COLOR_MID, COLOR_HI];
    for (let c = 0; c < 3; c++) {
      ax.fillStyle = colors[c];
      for (let i = 0; i < RAMP.length; i++) {
        ax.fillText(RAMP[i], i * CELL_X, c * CELL_Y);
      }
    }
  }

  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'setHue' && typeof e.data.color === 'string') {
      COLOR_HI = e.data.color;
      buildAtlas();
    }
  });

  function resize() {
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    COLS = Math.ceil(W / CELL_X) + 2;
    ROWS = Math.ceil(H / CELL_Y) + 2;

    uCol = new Float32Array(COLS);
    u14Col = new Float32Array(COLS);
    cosUCol = new Float32Array(COLS);
    xCol = new Float32Array(COLS);
    s1Col = new Float32Array(COLS);
    vRow = new Float32Array(ROWS);
    yRow = new Float32Array(ROWS);
    for (let i = 0; i < COLS; i++) {
      uCol[i] = i / COLS;
      u14Col[i] = uCol[i] * 14;
      cosUCol[i] = Math.cos(uCol[i] * 8);
      xCol[i] = i * CELL_X;
    }
    for (let j = 0; j < ROWS; j++) {
      vRow[j] = j / ROWS;
      yRow[j] = j * CELL_Y;
    }

    const need = COLS * ROWS;
    if (need > capCells) {
      capCells = need;
      bucketHI = new Int32Array(capCells * 3);
      bucketMID = new Int32Array(capCells * 3);
      bucketDIM = new Int32Array(capCells * 3);
    }

    buildAtlas();
  }
  window.addEventListener('resize', resize);
  resize();

  function onMove(e) {
    const r = canvas.getBoundingClientRect();
    targetX = (e.clientX - r.left) / r.width;
    targetY = (e.clientY - r.top) / r.height;
  }
  canvas.addEventListener('pointermove', onMove);
  document.addEventListener('pointermove', onMove);

  // Skip work when the hero is offscreen or tab is hidden.
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) visible = e.isIntersecting;
  }, { threshold: 0 });
  io.observe(canvas);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) visible = false;
    else { visible = true; last = performance.now(); }
  });

  // atlas source-cell size in atlas pixels (atlas is HiDPI-backed)
  const SX = CELL_X * DPR, SY = CELL_Y * DPR;
  const RAMPN = RAMP.length;

  let t = 0;
  let last = performance.now();
  function frame(now) {
    if (!visible) { last = now; requestAnimationFrame(frame); return; }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;

    mouseX += (targetX - mouseX) * 0.095;
    mouseY += (targetY - mouseY) * 0.095;

    ctx.clearRect(0, 0, W, H);

    const mx = mouseX, my = mouseY;
    const t13 = t * 1.3, t11 = t * 1.1, t32 = t * 3.2;

    // s1 depends only on column + time — compute once per column
    for (let i = 0; i < COLS; i++) s1Col[i] = Math.sin(u14Col[i] + t13);

    let nHI = 0, nMID = 0, nDIM = 0;

    for (let j = 0; j < ROWS; j++) {
      const v = vRow[j];
      const dy = v - my;
      const v12t11 = v * 12 + t11;
      for (let i = 0; i < COLS; i++) {
        const u = uCol[i];
        const dx = u - mx;
        const dc = Math.sqrt(dx * dx + dy * dy);
        const s2 = Math.sin(v12t11 + cosUCol[i]);
        const s3 = Math.sin(dc * 26 - t32);
        let d = 0.5 + (s1Col[i] + s2 + s3) / 6;
        d += (1 - (dc < 0.3333333 ? dc * 3 : 1)) * 0.35;
        if (d < 0.18) continue;
        if (d > 1) d = 1;
        let idx = (d * RAMPN) | 0;
        if (idx >= RAMPN) idx = RAMPN - 1;
        if (d > 0.82) {
          bucketHI[nHI++] = xCol[i]; bucketHI[nHI++] = yRow[j]; bucketHI[nHI++] = idx;
        } else if (d > 0.55) {
          bucketMID[nMID++] = xCol[i]; bucketMID[nMID++] = yRow[j]; bucketMID[nMID++] = idx;
        } else {
          bucketDIM[nDIM++] = xCol[i]; bucketDIM[nDIM++] = yRow[j]; bucketDIM[nDIM++] = idx;
        }
      }
    }

    // One alpha change per tier; drawImage from atlas instead of fillText.
    ctx.globalAlpha = 0.6;
    for (let k = 0; k < nDIM; k += 3) {
      const idx = bucketDIM[k+2];
      ctx.drawImage(atlas, idx * SX, 0, SX, SY,
                    bucketDIM[k], bucketDIM[k+1], CELL_X, CELL_Y);
    }
    ctx.globalAlpha = 0.8;
    for (let k = 0; k < nMID; k += 3) {
      const idx = bucketMID[k+2];
      ctx.drawImage(atlas, idx * SX, SY, SX, SY,
                    bucketMID[k], bucketMID[k+1], CELL_X, CELL_Y);
    }
    ctx.globalAlpha = 0.9;
    for (let k = 0; k < nHI; k += 3) {
      const idx = bucketHI[k+2];
      ctx.drawImage(atlas, idx * SX, SY * 2, SX, SY,
                    bucketHI[k], bucketHI[k+1], CELL_X, CELL_Y);
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
