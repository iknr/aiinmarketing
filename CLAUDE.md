# CLAUDE.md

## Analytics: Google Tag Manager GTM-NPKP66BD

- Every HTML page must contain the GTM snippet (loader in `<head>`, noscript iframe after `<body>`).
- `scripts/inject-gtm.js` enforces this automatically at deploy time: `vercel.json` sets `"buildCommand": "node scripts/inject-gtm.js"` and `"outputDirectory": "."`, so any new `.html` page gets the snippet during the Vercel build.
- Still run `node scripts/inject-gtm.js` locally after adding a page and commit the result, so the repository files match what is served.
- Never remove the snippet. Do not add a second GTM or duplicate GA4/Clarity tags in page code (GA4, Microsoft Clarity and Search Console are configured inside GTM).
- Events pushed to the dataLayer (by `wp-content/plugins/elementor/assets/js/aim-track.js`): `apply_click`, `lead_submit`, `guide_download`, `buy_click`.

## Authors

Every blog post is credited to both authors. Profile pages: `/author/kailasnathr` (Kailas Nath R) and `/author/kautilyaroshan` (Kautilya Roshan). The content desk must follow this for all future posts:

- Byline under the H1: `By <a href="/author/kailasnathr" rel="author">Kailas Nath R</a> and <a href="/author/kautilyaroshan" rel="author">Kautilya Roshan</a> &middot; <time ...>`.
- Exactly one `<section class="aimb-authors" aria-label="About the authors">` (H2 `id="about-the-authors"`), placed after the closing CTA aside and before the `aimb-more-posts` list. Copy the markup from any existing post (two `aimb-acard` cards with role pills, LinkedIn, GitHub for Kailas, Book on Amazon and Full profile pills). Do not add a second "About the authors" section.
- Article JSON-LD `author` is an array of both Persons (`name`, `url` = author page, `sameAs` = LinkedIn, plus GitHub for Kailas).
- New posts must also be added to the "Articles by" grid on both author pages, to `sitemap.xml` and to `llms.txt`.
- Use `aim-blog.css?ver=2.2.0` or later in posts and author pages. Author photos live in `wp-content/uploads/2026/11/authors/`.
