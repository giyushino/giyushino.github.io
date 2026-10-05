# giyushino.github.io

Allan's site (allanyz.com), in the style of [slightknack.dev](https://slightknack.dev). Eleventy 3, Nunjucks, Markdown posts, build-time KaTeX and Prism. Pushing `main` deploys it
through `.github/workflows/deploy.yml`.

```
npm run serve        # dev server with drafts, http://localhost:8080
npm run serve:prod   # live-reloading server without drafts (what will ship), http://localhost:8091
npm run build        # production build into _site/ (drafts dropped)
```

- `site/index.njk` is the home scene: the aquarium layers in `site/img/aquarium/`, moved by `site/js/home.js`.
- Pages: `about`, `writing`, `research` (plus an unlinked `now`) (`site/*.njk`), laid out by `_includes/page.njk`.
- Posts live in `site/posts/` (`in_prog/` is always draft). Reading time is computed, so `readingTime` in front matter is ignored.
- Menu entries: `site/_data/nav.json`.
- Margin notes in posts: `{% aside %}a thought on the side{% endaside %}`.
