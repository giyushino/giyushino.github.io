// Runs synchronously in <head> — applies saved accent before first paint.
(function () {
  var h = localStorage.getItem('hue');
  if (h) document.documentElement.style.setProperty('--accent', h);
})();
