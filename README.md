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

Form submissions go to the Heffl CRM through `api/lead.js`. Vercel environment variables:

- `HEFFL_API_KEY` (required for Heffl; Production and Preview; mark Sensitive). Without it leads are only logged.
- `HEFFL_LEAD_SOURCE_NAME` (optional, default `Website`) and `HEFFL_LEAD_STAGE_NAME` (optional, default `New`).
- `HEFFL_USE_CUSTOM_FIELDS` (optional, `true` after creating the Heffl custom fields described in CLAUDE.md).
- `LEAD_WEBHOOK_URL` (optional). Fallback that receives leads Heffl could not store; without `HEFFL_API_KEY`
  it receives every lead (Zapier, Make, Google Apps Script).

Beyond creating leads, `api/lead.js` records flagged submissions as `ABUSE: <type>` leads in the Heffl stage `Unqualified`
(`bad_origin`, `rate_limit`, `repeat_within_60s`, `bot_user_agent`; max 20 per hour per instance, no task), creates a HIGH
"Lead capture failed" task when Heffl rejects a lead, stores the visitor IP and approximate location (from Vercel headers
`x-real-ip` / `x-forwarded-for`, `x-vercel-ip-country`, `-country-region`, `-city`; server side only) with the lead, shows
times in IST and uses friendly form names. Create the `Unqualified` stage in Heffl. Details: CLAUDE.md. `privacy-policy.html` describes this.

No secrets belong in the repository. Setup checklist, key rotation and behaviour: see CLAUDE.md, "Lead capture: Heffl CRM".
Run `node tools/test-lead.js` to test the function offline.

The login page never checks or stores credentials; every attempt shows the standard error.

## Analytics: Google Tag Manager GTM-NPKP66BD

- Every HTML page must contain the GTM snippet (loader in `<head>`, noscript iframe after `<body>`).
- `scripts/inject-gtm.js` enforces this automatically at deploy time: `vercel.json` sets `"buildCommand": "node scripts/inject-gtm.js"` and `"outputDirectory": "."`, so any new `.html` page gets the snippet during the Vercel build.
- Still run `node scripts/inject-gtm.js` locally after adding a page and commit the result, so the repository files match what is served.
- Never remove the snippet. Do not add a second GTM or duplicate GA4/Clarity tags in page code (GA4, Microsoft Clarity and Search Console are configured inside GTM).
- Events pushed to the dataLayer (by `wp-content/plugins/elementor/assets/js/aim-track.js`): `apply_click`, `lead_submit`, `guide_download`, `buy_click`.
