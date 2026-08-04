// Runs synchronously in <head> — applies saved accent and mode before first paint.
(function () {
  var t = localStorage.getItem('theme');           // 'auto' | 'light' | 'dark'
  var sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  // Dark is the default — the ASCII scene is a dark-mode piece. 'auto' only
  // applies for visitors who set it back when the switch offered it.
  var light = t === 'light' || (t === 'auto' && !sysDark);
  if (light) document.documentElement.setAttribute('data-theme', 'light');
  // The accent is saved per theme, so the mode has to be resolved first. With
  // nothing saved we leave --accent alone and the stylesheet default applies.
  var h = localStorage.getItem(light ? 'hue-light' : 'hue-dark')
    || localStorage.getItem('hue');               // pre-split key
  if (h) document.documentElement.style.setProperty('--accent', h);
})();
