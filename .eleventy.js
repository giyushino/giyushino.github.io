const syntaxHighlight = require('@11ty/eleventy-plugin-syntaxhighlight')
const katex = require('@vscode/markdown-it-katex').default

module.exports = function (eleventyConfig) {
  // Code is tokenised by Prism and math typeset by KaTeX at build time, so pages
  // ship plain HTML + CSS with no runtime for either.
  eleventyConfig.addPlugin(syntaxHighlight)
  // Curly quotes and proper dashes, like Zola's smart_punctuation on slightknack.dev.
  eleventyConfig.amendLibrary('md', md =>
    md.set({ typographer: true }).use(katex, { throwOnError: false, enableFencedBlocks: true })
  )

  eleventyConfig.addPassthroughCopy({
    'site/css': 'css',
    'site/js': 'js',
    'site/img': 'img',
    'site/files': 'files',
    'site/favicon.svg': 'favicon.svg',
    'site/favicon.png': 'favicon.png',
    'site/favicon.ico': 'favicon.ico',
    'site/apple-touch-icon.png': 'apple-touch-icon.png',
    'site/CNAME': 'CNAME',  // custom domain (allanyz.com) for GitHub Pages
    'node_modules/katex/dist/katex.min.css': 'css/katex/katex.min.css',
    'node_modules/katex/dist/fonts/*.woff2': 'css/katex/fonts',
  })

  // `draft: true` (and everything in posts/in_prog/) renders on the dev server
  // but is dropped from `npm run build`. `npm run serve:prod` (HIDE_DRAFTS=1) hides
  // them on a live-reloading server too, so you can see exactly what will ship.
  eleventyConfig.addPreprocessor('drafts', '*', data => {
    const hide = process.env.ELEVENTY_RUN_MODE === 'build' || process.env.HIDE_DRAFTS === '1'
    if (data.draft && hide) return false
  })

  // Posts, newest first.
  eleventyConfig.addCollection('posts', collection =>
    collection.getFilteredByGlob('site/posts/**/*.md').sort((a, b) => b.date - a.date)
  )

  // September 8, 2026
  eleventyConfig.addFilter('longDate', date =>
    new Date(date).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
    })
  )
  // Aug 02, 2026
  eleventyConfig.addFilter('shortDate', date =>
    new Date(date).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: '2-digit', timeZone: 'UTC',
    })
  )
  // 2026-09-08
  eleventyConfig.addFilter('isoDate', date => new Date(date).toISOString().slice(0, 10))
  // RFC 3339 for the feed
  eleventyConfig.addFilter('rfc3339', date => new Date(date).toISOString())

  // Minutes to read, from the rendered HTML (about 220 words a minute).
  eleventyConfig.addFilter('readingMinutes', html => {
    const words = String(html || '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
    return Math.max(1, Math.round(words / 220))
  })
  eleventyConfig.addFilter('plural', (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`)

  eleventyConfig.addFilter('sortByYear', items => [...items].sort((a, b) => b.year - a.year))
  eleventyConfig.addFilter('highlightAuthor', (authors, name) =>
    authors.split(name).join(`<strong>${name}</strong>`)
  )

  // A margin note: {% aside %}a thought on the side{% endaside %}
  // Sits in the right margin on wide screens and folds inline in parentheses on narrow ones.
  eleventyConfig.addPairedShortcode('aside', content => `<span class="aside">${content.trim()}</span>`)

  return {
    dir: { input: 'site', includes: '_includes', data: '_data', output: '_site' },
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
  }
}
