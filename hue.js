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
  });
})();
