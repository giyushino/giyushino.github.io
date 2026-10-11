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

  // Links to other sites open in a new tab; links within the site stay in this one.
  eleventyConfig.amendLibrary('md', md => {
    const linkOpen = md.renderer.rules.link_open || ((tokens, idx, options, env, self) =>
      self.renderToken(tokens, idx, options))
    md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
      const token = tokens[idx]
      if (/^https?:\/\//i.test(token.attrGet('href') || '')) {
        token.attrSet('target', '_blank')
        token.attrSet('rel', 'noopener')
      }
      return linkOpen(tokens, idx, options, env, self)
    }
  })

  // ![alt](src "caption") alone in a paragraph becomes a captioned <figure>, the same
  // markup as {% figure %} below. Images inline with other text are left alone.
  eleventyConfig.amendLibrary('md', md => {
    md.core.ruler.push('figure', state => {
      const tokens = state.tokens
      for (let i = 0; i + 2 < tokens.length; i++) {
        if (tokens[i].type !== 'paragraph_open' || tokens[i + 1].type !== 'inline') continue
        const kids = tokens[i + 1].children.filter(t => !(t.type === 'text' && !t.content.trim()))
        if (kids.length !== 1 || kids[0].type !== 'image' || !kids[0].attrGet('title')) continue
        kids[0].meta = { ...kids[0].meta, figure: true }
        tokens[i].hidden = tokens[i + 2].hidden = true  // drop the <p> wrapper
      }
    })
    const image = md.renderer.rules.image
    md.renderer.rules.image = (tokens, idx, options, env, self) => {
      const token = tokens[idx]
      if (!token.meta?.figure) return image(tokens, idx, options, env, self)
      const caption = token.attrGet('title')
      token.attrs = token.attrs.filter(([name]) => name !== 'title')
      token.attrSet('loading', 'lazy')
      const img = image(tokens, idx, options, env, self)
      return `<figure>${img}<figcaption>${md.utils.escapeHtml(caption)}</figcaption></figure>\n`
    }
  })

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

  // An image with a caption: {% figure "/img/posts/x.png", "alt text", "The caption.", 500 %}
  // Caption and width are optional; the caption may contain HTML. Kept on one line so
  // markdown-it treats it as a single HTML block.
  const attr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  eleventyConfig.addShortcode('figure', (src, alt = '', caption = '', width) => {
    const w = width ? ` width="${attr(width)}"` : ''
    const cap = caption ? `<figcaption>${caption}</figcaption>` : ''
    return `<figure><img src="${attr(src)}" alt="${attr(alt)}"${w} loading="lazy">${cap}</figure>`
  })

  return {
    dir: { input: 'site', includes: '_includes', data: '_data', output: '_site' },
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
  }
}
