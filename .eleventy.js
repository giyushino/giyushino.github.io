const syntaxHighlight = require('@11ty/eleventy-plugin-syntaxhighlight')

module.exports = function (eleventyConfig) {
  // Fenced blocks get tokenised by Prism at build time — no client-side JS,
  // and the token colours live in styles.css alongside everything else.
  eleventyConfig.addPlugin(syntaxHighlight)

  eleventyConfig.addPassthroughCopy({
    'site/css': 'css',
    'site/js': 'js',
    'site/files': 'files',
    'site/img': 'img',
    'site/favicon.svg': 'favicon.svg',
    'site/CNAME': 'CNAME',
  })

  // The static SVG scene renders on every page. Global data loses to front
  // matter, so any page can opt out with `svgBg: false` or name another file
  // in site/img/ with `svgBg: bg-001`.
  eleventyConfig.addGlobalData('svgBg', 'bg-003')

  // The animated canvas scene is the same slot, and stacking the two ASCII
  // pieces just muddies both — so it's off by default now, opt in per page
  // with `asciiScene: true`.
  eleventyConfig.addGlobalData('asciiScene', false)

  // A post with `draft: true` in its frontmatter is dropped from the build —
  // no page, and nothing in the writing index. On the dev server it still
  // renders, so drafts are previewable locally but never ship.
  eleventyConfig.addPreprocessor('drafts', '*', data => {
    if (data.draft && process.env.ELEVENTY_RUN_MODE === 'build') {
      return false
    }
  })

  // March 18, 2026
  eleventyConfig.addFilter('longDate', date =>
    new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    })
  )

  // Newest first, so publications.json can stay in whatever order you add to it.
  eleventyConfig.addFilter('sortByYear', items =>
    [...items].sort((a, b) => b.year - a.year)
  )

  // Bold your own name in an author list.
  eleventyConfig.addFilter('highlightAuthor', (authors, name) =>
    authors.split(name).join(`<strong>${name}</strong>`)
  )

  eleventyConfig.addCollection('posts', collection =>
    collection.getFilteredByGlob('site/posts/*.md').reverse()
  )

  return {
    dir: {
      input: 'site',
      includes: '_includes',
      data: '_data',
      output: '_site',
    },
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
  }
}
