// Home scene: the aquarium cut into depth layers. Each layer slides sideways against the
// pointer, nearer layers further, blended with a slow idle drift so the tank still
// breathes when nobody is moving the mouse.
(() => {
  const W = 2000, H = 1061   // source art size
  const TRAVEL = 140         // art px the nearest layer may travel each way; also the hidden margin
  const DRIFT_PERIOD = 20000 // ms for one idle sway

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
  const layers = [...document.querySelectorAll('.scene .layer')].map(el => ({
    el, speed: +el.dataset.speed,
  }))
  let k = 1

  // Cover the window, keeping TRAVEL px of art hidden on each side as room to move.
  function layout() {
    const vw = window.innerWidth, vh = window.innerHeight
    k = Math.max(vw / (W - 2 * TRAVEL), vh / H)
    const w = W * k, h = H * k
    // Wide screens centre on the sharks; tall ones swing over to keep the girl in frame.
    const focusX = vw / vh >= 1.3 ? 1150 : 1420
    const left = Math.min(-TRAVEL * k, Math.max(vw - (W - TRAVEL) * k, vw / 2 - focusX * k))
    const top = (vh - h) / 2
    for (const { el } of layers) {
      Object.assign(el.style, { width: `${w}px`, height: `${h}px`, left: `${left}px`, top: `${top}px` })
    }
    place(current)
  }

  // Layers move against the pointer: mouse right, scene slides left.
  function place(n) {
    for (const { el, speed } of layers) {
      el.style.transform = `translate3d(${(-n * TRAVEL * speed * k).toFixed(2)}px, 0, 0)`
    }
  }

  // Pointer across the window as 0..1, eased toward.
  let target = 0.5, smooth = 0.5, current = 0, last = 0
  window.addEventListener('pointermove', e => { target = e.clientX / window.innerWidth }, { passive: true })
  document.documentElement.addEventListener('mouseleave', () => { target = 0.5 })

  function frame(now) {
    const dt = last ? Math.min(64, now - last) : 16.7
    last = now
    smooth += (target - smooth) * (1 - Math.pow(1 - 0.08, dt / 16.7))
    const drift = Math.cos((now / DRIFT_PERIOD) * Math.PI * 2)
    current = Math.max(-1, Math.min(1, (smooth - 0.5) * 2 * 0.85 + drift * 0.15))
    place(current)
    if (!reduce.matches) requestAnimationFrame(frame)
  }

  // Fade the whole scene in at once when every layer has downloaded (or after 6 s,
  // showing whatever has arrived), so layers never pop in one by one. Decoding gets
  // at most 0.4 s on top: decode() can stall, e.g. while the tab is in the background.
  const scene = document.querySelector('.scene')
  const ready = () => scene.classList.add('ready')
  const wait = ms => new Promise(res => setTimeout(res, ms))
  const loaded = img => img.complete && img.naturalWidth ? Promise.resolve() : new Promise(res => {
    img.addEventListener('load', res, { once: true })
    img.addEventListener('error', res, { once: true })
  })
  const decodedSoon = img => Promise.race([(img.decode ? img.decode() : Promise.resolve()).catch(() => {}), wait(400)])
  Promise.all(layers.map(({ el }) => {
    const img = el.querySelector('.main')
    return loaded(img).then(() => decodedSoon(img))
  })).then(ready)
  setTimeout(ready, 6000)

  window.addEventListener('resize', layout)
  layout()
  if (!reduce.matches) requestAnimationFrame(frame)
  reduce.addEventListener?.('change', () => {
    current = 0; place(0)
    if (!reduce.matches) requestAnimationFrame(frame)
  })
})()
