module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({
    'site/css': 'css',
    'site/js': 'js',
    'site/files': 'files',
    'site/favicon.svg': 'favicon.svg',
    'site/CNAME': 'CNAME',
  })

  // The ASCII scene background renders on every page. Global data loses to
  // front matter, so any page can opt out with `asciiScene: false`.
  eleventyConfig.addGlobalData('asciiScene', true)

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
