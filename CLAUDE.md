# CLAUDE.md

## Analytics: Google Tag Manager GTM-NPKP66BD

- Every HTML page must contain the GTM snippet (loader in `<head>`, noscript iframe after `<body>`).
- `scripts/inject-gtm.js` enforces this automatically at deploy time: `vercel.json` sets `"buildCommand": "node scripts/inject-gtm.js"` and `"outputDirectory": "."`, so any new `.html` page gets the snippet during the Vercel build.
- Still run `node scripts/inject-gtm.js` locally after adding a page and commit the result, so the repository files match what is served.
- Never remove the snippet. Do not add a second GTM or duplicate GA4/Clarity tags in page code (GA4, Microsoft Clarity and Search Console are configured inside GTM).
- Events pushed to the dataLayer (by `wp-content/plugins/elementor/assets/js/aim-track.js`): `apply_click`, `lead_submit`, `guide_download`, `buy_click`.

## Lead capture: Heffl CRM

Every valid form submission (`/wp-admin/admin-ajax.php` -> `api/lead.js`) is created as a lead in Heffl when `HEFFL_API_KEY` is set. Without the key the function only logs (or forwards to `LEAD_WEBHOOK_URL`), so deploying before the key exists is safe. The key is never in the repo, never logged and never sent anywhere except the `x-api-key` header to `api.heffl.com`.

Environment variables (Vercel > Settings > Environment Variables):

| Variable | Required | Purpose |
| --- | --- | --- |
| `HEFFL_API_KEY` | yes (Production and Preview, mark Sensitive) | Heffl API key |
| `HEFFL_LEAD_SOURCE_NAME` | no, default `Website` | Heffl lead source, found by name |
| `HEFFL_LEAD_STAGE_NAME` | no, default `New` | Heffl lead stage, found by name |
| `HEFFL_USE_CUSTOM_FIELDS` | no, default off | Set to `true` only after creating the four custom fields below |
| `LEAD_WEBHOOK_URL` | no | Fallback: receives leads Heffl could not store (Zapier, Make, Apps Script) |

How it works:

- Calls used (Heffl docs, checked 2026-11-03): `POST https://api.heffl.com/api/v1/leads` (name, mobile `+91<10 digits>`, email, sourceId, stageId), `GET /api/v1/leads/sources` and `GET /api/v1/leads/stages` (ids looked up by name, cached 1 h per warm instance; if the lookup fails the lead is created without them and Heffl uses its defaults), `POST /api/v2/tasks` (v2 is Beta). Rate limit 60 requests/min per key.
- Context the lead create call cannot hold (current situation = `form_fields[stage]`, form source, page URL without query, utm_* from the referer):
  - Default: a follow-up task linked to the lead (`entity: "leads"`, `entityId: "ld_..."`), type call, priority MEDIUM, due in 1 day, title `Follow up: <name> (<situation>, via <form source>)`, full context in the description.
  - Better, once the owner creates these Heffl custom fields (Settings > Custom fields, for leads) with exactly these labels, then sets `HEFFL_USE_CUSTOM_FIELDS=true`: `Current situation`, `Form source`, `Page URL`, `Campaign UTM`. The API keys are derived from the label (`cf_current_situation`, `cf_form_source`, `cf_page_url`, `cf_campaign_utm`; lowercase, spaces to underscores). Do not use a `/` in a label. If Heffl rejects the fields or does not echo them back, the function falls back to the task automatically.
  - Optional in Heffl itself: a "Lead Created" automation with a "Create Task" action (then the task from the API duplicates it; ask for the API task to be switched off if you do).
- The visitor never waits more than about 6 s for Heffl and never sees a Heffl error. On failure the function still answers success, logs one JSON line `{"event":"lead_crm_failed",...,"lead":{...}}` (personal data: Vercel runtime logs only) and posts the lead to `LEAD_WEBHOOK_URL` if set. 401/403 logs `check HEFFL_API_KEY permissions`; 429 is retried once if Heffl says to wait under 2 s; a duplicate (409 or a "duplicate" validation error) logs `duplicate_lead` and counts as success.
- Abuse protection: Origin/Referer must be aiinmarketing.in or www.aiinmarketing.in (localhost only outside production); at most 5 submissions per IP per 10 minutes (best effort, in memory per instance); the same email+phone within 60 s is acknowledged but not sent again.
- Failure task: when Heffl is reachable but rejects the lead (4xx other than 401/403/429, e.g. validation), the function creates one Heffl task (`POST /api/v2/tasks`) titled `Lead capture failed: <name>, <mobile>, <friendly form>` (type todo, priority HIGH, due today, no lead link; description holds email and all context) so the team adds it by hand. If Heffl is unreachable (timeout/network), returns 401/403/429/5xx, or the task call fails too, the old fallback applies: `lead_crm_failed` log line plus `LEAD_WEBHOOK_URL`. When the task was created, the log line is `lead_failure_task_created` instead and the webhook is not called.
- Abuse records: a submission that passes basic validity (name >= 2 chars, valid Indian mobile, valid email) but is flagged is created as a Heffl lead in the `Unqualified` stage (looked up by name, cached like source/stage; never `New`) with the type at the START of the lead `title`: `ABUSE: <type> | IP <ip>, <city>, <region>, <country> | <friendly form>`. No follow-up task. Types: `bad_origin` (response 400), `rate_limit` (429), `repeat_within_60s` (200 success), `bot_user_agent` (200 success; User-Agent matches HeadlessChrome, curl, python-requests, Go-http-client, node-fetch/undici/axios, wget, okhttp, scrapy, crawler/bot/spider etc.; a missing User-Agent is not flagged; the Playwright/mock QA runs never reach Heffl). No honeypot field exists, so there is no `honeypot` type. At most 20 abuse records per hour per warm instance (beyond that only an `abuse_record_skipped` log line); requests that fail basic validity create nothing. Heffl rejects duplicate contacts, so if the abuse lead is a duplicate it is retried once without email/mobile, with `<email> <mobile>` in the title. If the `Unqualified` stage does not exist in Heffl nothing is created (create the stage). User-facing responses are never changed by abuse handling.
- IP and location (server side only, never in any response): IP = `x-real-ip`, else the first `x-forwarded-for` entry (trimmed, must be a valid IPv4/IPv6 of at most 45 chars, else ignored), else the socket address; the same IP drives the rate limit. Location = `x-vercel-ip-country` (2 letters), `x-vercel-ip-country-region`, `x-vercel-ip-city` (URL-decoded). Recorded: in the follow-up task text (`IP address`, `Approximate location`) and the failure task; in Heffl custom fields when `HEFFL_USE_CUSTOM_FIELDS=true` (add four more lead custom fields: `IP address`, `Country`, `Region`, `City` -> `cf_ip_address`, `cf_country`, `cf_region`, `cf_city`; if missing, Heffl rejects the create and the function falls back to the task); in the abuse title; and in the logs (`lead_crm_failed`, `abuse_flagged`, `lead_failure_task_created` carry `ip`, `country`, `region`, `city`, `abuse`).
- Task text: submission time is shown in India time (`4 Nov 2026, 2:15 AM IST`; logs keep ISO UTC). Friendly form labels replace internal names in task titles and text (`Follow up: <name> (<situation>, via <friendly label>)`): `dm_by_adsmentor_apply` Apply form, `magnet_syllabus` Free guide: 12-week syllabus, `magnet_checklist` Free guide: 5-question course checklist, `magnet_ad_account` Free guide: ad account ownership checklist, `magnet_brochure` Brochure download, source `magnet-rtcros-prompt-guide` Free guide: RTCROS prompt guide, `magnet-meta-mcp-cli-sop` Free guide: Meta Ads MCP and CLI SOP; unknown names show the raw value. Add new forms to `FORM_LABELS` / `SOURCE_LABELS` in `api/lead.js`.
- Privacy: `privacy-policy.html` states the IP/location capture, the tracking and analytics tools (Clarity, Google Analytics, Tag Manager) and that form details are stored in Heffl. Update it whenever what is collected or who receives it changes.
- Tests: `node tools/test-lead.js` (mocked fetch, no network, no real leads). Run it after any change to `api/lead.js`.

Owner checklist:

1. Add the key: Vercel > project `aiinmarketing` > Settings > Environment Variables > add `HEFFL_API_KEY`, tick Production (and Preview), mark Sensitive, save, then redeploy (Deployments > latest > Redeploy; env changes apply to new deployments only).
2. Live test: open https://aiinmarketing.in, submit one form with an obviously labelled test (name `ZZ TEST - delete me`, your own phone/email). Check the lead appears in Heffl (stage New, source Website) together with its follow-up task or custom fields, and that Vercel > Logs shows no `lead_crm_failed`. Then delete the test lead (and its task) in Heffl. Heffl has "Allow duplicate leads" off, so repeat tests need a different email and phone.
3. Rotate the key: create a new key in Heffl (Settings > Developer), update `HEFFL_API_KEY` in Vercel, redeploy, submit one test lead, then delete the old key in Heffl.

## Authors

Every blog post is credited to both authors. Profile pages: `/author/kailasnathr` (Kailas Nath R) and `/author/kautilyaroshan` (Kautilya Roshan). The content desk must follow this for all future posts:

- Byline under the H1: `By <a href="/author/kailasnathr" rel="author">Kailas Nath R</a> and <a href="/author/kautilyaroshan" rel="author">Kautilya Roshan</a> &middot; <time ...>`.
- Exactly one `<section class="aimb-authors" aria-label="About the authors">` (H2 `id="about-the-authors"`), placed after the closing CTA aside and before the `aimb-more-posts` list. Copy the markup from any existing post (two `aimb-acard` cards with role pills, LinkedIn, GitHub for Kailas, Book on Amazon and Full profile pills). Do not add a second "About the authors" section.
- Article JSON-LD `author` is an array of both Persons (`name`, `url` = author page, `sameAs` = LinkedIn, plus GitHub for Kailas).
- New posts must also be added to the "Articles by" grid on both author pages, to `sitemap.xml` and to `llms.txt`.
- Use `aim-blog.css?ver=2.2.0` or later in posts and author pages. Author photos live in `wp-content/uploads/2026/11/authors/`.

## Program brochure

- `wp-content/uploads/2026/11/guides/aim-program-brochure.pdf` (gated on the home page, `#brochure`) is a PDF rebuilt from a script, not hand-edited. Rebuild it and its cover thumbnail whenever the price, guarantee, tracks, trainers or the fee comparison table change.
