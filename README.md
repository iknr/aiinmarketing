# Ads Mentor landing page

Static build of the Elementor page (post 622), laid out like a WordPress install so it is easy to follow.

```
index.html                                        page markup (Elementor containers and widgets)
wp-content/themes/hello-elementor/style.css       base reset
wp-content/plugins/elementor/assets/css/frontend.css   container, widget, form and popup primitives
wp-content/plugins/elementor/assets/js/frontend.js     nav toggle, popup #519, form submit
wp-content/uploads/elementor/css/post-622.css     page styles
wp-login.html, wp-admin/                          placeholder login (served at /wp-login.php and /wp-admin)
api/lead.js                                       form endpoint (served at /wp-admin/admin-ajax.php)
vercel.json                                       rewrites and headers
```

## Deploy

```bash
npx vercel --prod
```

Set `LEAD_WEBHOOK_URL` in the Vercel project settings to forward form submissions
(Zapier, Make, Google Apps Script, a CRM). Without it, leads are only written to the function logs.

The login page never checks or stores credentials; every attempt shows the standard error.

## Analytics: Google Tag Manager GTM-NPKP66BD

- Every HTML page must contain the GTM snippet (loader in `<head>`, noscript iframe after `<body>`).
- `scripts/inject-gtm.js` enforces this automatically at deploy time: `vercel.json` sets `"buildCommand": "node scripts/inject-gtm.js"` and `"outputDirectory": "."`, so any new `.html` page gets the snippet during the Vercel build.
- Still run `node scripts/inject-gtm.js` locally after adding a page and commit the result, so the repository files match what is served.
- Never remove the snippet. Do not add a second GTM or duplicate GA4/Clarity tags in page code (GA4, Microsoft Clarity and Search Console are configured inside GTM).
- Events pushed to the dataLayer (by `wp-content/plugins/elementor/assets/js/aim-track.js`): `apply_click`, `lead_submit`, `guide_download`, `buy_click`.
