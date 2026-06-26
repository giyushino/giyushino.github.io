// Runs synchronously in <head> — applies saved accent and mode before first paint.
(function () {
  var h = localStorage.getItem('hue');
  if (h) document.documentElement.style.setProperty('--accent', h);
  var t = localStorage.getItem('theme');           // 'auto' | 'light' | 'dark'
  var sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var light = t === 'light' || ((!t || t === 'auto') && !sysDark);
  if (light) document.documentElement.setAttribute('data-theme', 'light');
})();
