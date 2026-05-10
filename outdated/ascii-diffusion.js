/* ----------------------------------------------------------------------
   Black hole animation — loads blackhole.json, renders 144×40 terminal
   cells (block glyphs + fg/bg colors) scaled to canvas.
---------------------------------------------------------------------- */
(() => {
  const canvas = document.getElementById('ascii-canvas');
  const ctx = canvas.getContext('2d');

  const N_COLS = 144, N_ROWS = 40;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  let W = 0, H = 0, cellW = 0, cellH = 0, offsetX = 0, offsetY = 0;
  let FONT = '';
  let visible = true;
  let frameIdx = 0;
  let last = 0;

  let glyphs = null, fgColors = null, bgColors = null;
  let delays = null, N_FRAMES = 0;

  const _cc = new Map();
  function rgb(r, g, b) {
    const k = r << 16 | g << 8 | b;
    let s = _cc.get(k);
    if (!s) { s = `rgb(${r},${g},${b})`; _cc.set(k, s); }
    return s;
  }

  fetch('blackhole.json')
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(data => {
      N_FRAMES = data.frames.length;
      delays = data.delays;

      glyphs   = new Array(N_FRAMES);
      fgColors = new Array(N_FRAMES);
      bgColors = new Array(N_FRAMES);

      const SIZE = N_COLS * N_ROWS;
      for (let f = 0; f < N_FRAMES; f++) {
        const cells = data.frames[f].cells;
        const gArr  = new Array(SIZE);
        const fgArr = new Array(SIZE);
        const bgArr = new Array(SIZE);
        let idx = 0;
        for (let r = 0; r < N_ROWS; r++) {
          const row = cells[r];
          for (let c = 0; c < N_COLS; c++, idx++) {
            const cell = row[c];
            const [br, bg, bb] = cell.bg;
            const [fr, fg, fb] = cell.fg;
            gArr[idx]  = cell.g === ' ' ? '' : cell.g;
            bgArr[idx] = (br | bg | bb) ? rgb(br, bg, bb) : '';
            fgArr[idx] = (fr | fg | fb) ? rgb(fr, fg, fb) : '';
          }
        }
        glyphs[f]   = gArr;
        fgColors[f] = fgArr;
        bgColors[f] = bgArr;
      }

      resize();
      last = performance.now();
      requestAnimationFrame(frame);
    })
    .catch(e => console.error('blackhole.json failed to load:', e));

  function resize() {
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width  = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    let fs = Math.max(6, (W * 0.90) / N_COLS / 0.605);
    ctx.font = `${fs}px "JetBrains Mono","IBM Plex Mono",ui-monospace,monospace`;
    const mw = ctx.measureText('█').width;
    const fsW = mw > 0 ? fs * (W * 0.90 / N_COLS) / mw : fs;
    const fsH = (H * 0.90) / N_ROWS / 1.2;
    fs = Math.min(fsW, fsH);

    FONT = `${fs}px "JetBrains Mono","IBM Plex Mono",ui-monospace,monospace`;
    ctx.font = FONT;
    cellW = ctx.measureText('█').width;
    cellH = fs * 1.2;

    offsetX = (W - cellW * N_COLS) / 2;
    offsetY = (H - cellH * N_ROWS) / 2;
  }

  window.addEventListener('resize', resize);
  resize();

  const io = new IntersectionObserver(entries => {
    for (const e of entries) visible = e.isIntersecting;
  }, { threshold: 0 });
  io.observe(canvas);
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    if (visible) last = performance.now();
  });

  function frame(now) {
    if (!visible) { last = now; requestAnimationFrame(frame); return; }
    if (!glyphs) return;

    const delay = delays[frameIdx] ?? 80;
    if (now - last >= delay) {
      last += delay;
      if (last < now - delay) last = now;
      frameIdx = (frameIdx + 1) % N_FRAMES;
    }

    ctx.clearRect(0, 0, W, H);
    ctx.textBaseline = 'top';
    ctx.font = FONT;

    const gArr  = glyphs[frameIdx];
    const fgArr = fgColors[frameIdx];
    const bgArr = bgColors[frameIdx];
    const ox = offsetX, oy = offsetY;

    let idx = 0;
    for (let row = 0; row < N_ROWS; row++) {
      const y = oy + row * cellH;
      for (let col = 0; col < N_COLS; col++, idx++) {
        const bg = bgArr[idx];
        const g  = gArr[idx];
        if (!bg && !g) continue;

        const x = ox + col * cellW;
        if (bg) {
          ctx.fillStyle = bg;
          ctx.fillRect(x, y, cellW, cellH);
        }
        if (g) {
          ctx.fillStyle = fgArr[idx];
          ctx.fillText(g, x, y);
        }
      }
    }

    requestAnimationFrame(frame);
  }
})();
