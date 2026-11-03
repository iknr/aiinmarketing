# CLAUDE.md

## Analytics: Google Tag Manager GTM-M3H6S33J

- Every HTML page must contain the GTM snippet (loader in `<head>`, noscript iframe after `<body>`).
- `scripts/inject-gtm.js` enforces this (it is NOT wired as a Vercel `buildCommand`: that makes Vercel require a `public` output dir and fails the deploy, so run it by hand and commit the result).
- After adding any new `.html` page (blog posts, landing pages), always run `node scripts/inject-gtm.js` after adding pages.
- Never remove the snippet. Do not add a second GTM or duplicate GA4/Clarity tags in page code (GA4, Microsoft Clarity and Search Console are configured inside GTM).
- Events pushed to the dataLayer (by `wp-content/plugins/elementor/assets/js/aim-track.js`): `apply_click`, `lead_submit`, `guide_download`, `buy_click`.
