(() => {
  const input = document.getElementById('hue-input');
  if (!input) return;
  const apply = (c) => {
    document.documentElement.style.setProperty('--accent', c);
    window.postMessage({ type: 'setHue', color: c }, '*');
  };
  const saved = localStorage.getItem('hue');
  if (saved) { input.value = saved; apply(saved); }
  input.addEventListener('click', (e) => e.stopPropagation());
  input.addEventListener('input', (e) => {
    apply(e.target.value);
    localStorage.setItem('hue', e.target.value);
  });

  // Sync accent live across other open tabs/pages.
  window.addEventListener('storage', (e) => {
    if (e.key === 'hue' && e.newValue) {
      input.value = e.newValue;
      apply(e.newValue);
    }
    if (e.key === 'theme') applyTheme(e.newValue || 'auto');
  });

  // System / light / dark segmented switch.
  const root = document.documentElement;
  const switchEl = document.getElementById('theme-switch');
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const getMode = () => localStorage.getItem('theme') || 'auto';
  const applyTheme = (mode) => {
    const light = mode === 'light' || (mode === 'auto' && !mql.matches);
    if (light) root.setAttribute('data-theme', 'light');
    else root.removeAttribute('data-theme');
    if (switchEl) {
      switchEl.querySelectorAll('.ts-opt').forEach((b) => {
        b.classList.toggle('active', b.dataset.themeValue === mode);
      });
    }
  };
  applyTheme(getMode());
  if (switchEl) {
    switchEl.querySelectorAll('.ts-opt').forEach((b) => {
      b.addEventListener('click', () => {
        localStorage.setItem('theme', b.dataset.themeValue);
        applyTheme(b.dataset.themeValue);
      });
    });
  }
  mql.addEventListener('change', () => { if (getMode() === 'auto') applyTheme('auto'); });
})();
