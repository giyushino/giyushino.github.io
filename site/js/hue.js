(() => {
  const input = document.getElementById('hue-input');
  const root = document.documentElement;
  const switchEl = document.getElementById('theme-switch');
  const mql = window.matchMedia('(prefers-color-scheme: dark)');

  // The accent is stored per theme — a colour picked in dark mode shouldn't
  // follow you into light, where it may not even be legible. Each theme also
  // ships its own default in CSS, which is what shows when nothing is saved.
  const isLight = () => root.getAttribute('data-theme') === 'light';
  const hueKey = () => (isLight() ? 'hue-light' : 'hue-dark');

  // One-time migration off the old single key.
  const legacy = localStorage.getItem('hue');
  if (legacy && !localStorage.getItem('hue-dark') && !localStorage.getItem('hue-light')) {
    localStorage.setItem('hue-dark', legacy);
    localStorage.setItem('hue-light', legacy);
  }
  localStorage.removeItem('hue');

  const toHex = (c) => {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c);
    if (m) return '#' + [1, 2, 3].map((i) => (+m[i]).toString(16).padStart(2, '0')).join('');
    return /^#[0-9a-f]{6}$/i.test(c) ? c : null;
  };

  // Put the current theme's accent in force: the saved colour if there is one,
  // otherwise clear the override so the stylesheet's per-theme default wins.
  const applyStored = () => {
    const saved = localStorage.getItem(hueKey());
    if (saved) root.style.setProperty('--accent', saved);
    else root.style.removeProperty('--accent');
    const effective = saved
      || toHex(getComputedStyle(root).getPropertyValue('--accent').trim());
    if (input && effective) input.value = effective;
    if (effective) window.postMessage({ type: 'setHue', color: effective }, '*');
  };

  if (input) {
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('input', (e) => {
      localStorage.setItem(hueKey(), e.target.value);
      applyStored();
    });
  }

  // Sync accent and theme live across other open tabs/pages.
  window.addEventListener('storage', (e) => {
    if (e.key === 'hue-dark' || e.key === 'hue-light') applyStored();
    if (e.key === 'theme') applyTheme(e.newValue || 'dark');
  });

  // Light / dark segmented switch.
  const getMode = () => localStorage.getItem('theme') || 'dark';
  const applyTheme = (mode) => {
    // 'auto' stays honoured for anyone who set it back when the switch offered
    // it, but the buttons highlight whichever mode it resolves to.
    const light = mode === 'light' || (mode === 'auto' && !mql.matches);
    if (light) root.setAttribute('data-theme', 'light');
    else root.removeAttribute('data-theme');
    if (switchEl) {
      switchEl.querySelectorAll('.ts-opt[data-theme-value]').forEach((b) => {
        b.classList.toggle('active', b.dataset.themeValue === (light ? 'light' : 'dark'));
      });
    }
    applyStored();          // the accent changes with the theme
  };

  applyTheme(getMode());
  if (switchEl) {
    switchEl.querySelectorAll('.ts-opt[data-theme-value]').forEach((b) => {
      b.addEventListener('click', () => {
        localStorage.setItem('theme', b.dataset.themeValue);
        applyTheme(b.dataset.themeValue);
      });
    });
  }
  mql.addEventListener('change', () => { if (getMode() === 'auto') applyTheme('auto'); });

  // Back/forward out of the bfcache restores the DOM exactly as it was left,
  // scripts included — so a mode picked on the page you navigated to would be
  // undone by the stale data-theme on the page you came back to. Re-read the
  // saved mode on every restore.
  window.addEventListener('pageshow', (e) => { if (e.persisted) applyTheme(getMode()); });
})();
