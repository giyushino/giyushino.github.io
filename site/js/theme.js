// Light/dark toggle in the menu. Until it's pressed the site follows the system setting;
// a press picks the opposite of what's showing and remembers it.
(() => {
  const root = document.documentElement
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)')
  const current = () => root.dataset.theme || (systemDark.matches ? 'dark' : 'light')

  function label() {
    const next = current() === 'dark' ? 'light' : 'dark'
    for (const b of document.querySelectorAll('.theme-toggle')) {
      b.setAttribute('aria-label', `Switch to ${next} theme`)
      b.title = `Switch to ${next} theme`
    }
  }

  document.addEventListener('click', e => {
    if (!e.target.closest('.theme-toggle')) return
    const next = current() === 'dark' ? 'light' : 'dark'
    root.dataset.theme = next
    try { localStorage.setItem('theme', next) } catch (err) {}
    label()
  })
  systemDark.addEventListener?.('change', label)
  label()
})()
