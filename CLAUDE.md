# CLAUDE.md

## Analytics: Google Tag Manager GTM-NPKP66BD

- Every HTML page must contain the GTM snippet (loader in `<head>`, noscript iframe after `<body>`).
- `scripts/inject-gtm.js` enforces this automatically at deploy time: `vercel.json` sets `"buildCommand": "node scripts/inject-gtm.js"` and `"outputDirectory": "."`, so any new `.html` page gets the snippet during the Vercel build.
- Still run `node scripts/inject-gtm.js` locally after adding a page and commit the result, so the repository files match what is served.
- Never remove the snippet. Do not add a second GTM or duplicate GA4/Clarity tags in page code (GA4, Microsoft Clarity and Search Console are configured inside GTM).
- Events pushed to the dataLayer (by `wp-content/plugins/elementor/assets/js/aim-track.js`): `apply_click`, `lead_submit`, `guide_download`, `buy_click`.
