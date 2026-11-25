---
description: After any progress on aiinmarketing.in (publish, schedule, fix, research), update the SEO Tracker sheet and the Content Schedule Log sheet
---

# Log progress (run after EVERY piece of progress)

Run this after each push, each scheduled post or article, each fix, each research finding. Two sheets, both made from the Sheets type and edited through the Claude Docs connector (`guide` topics `topic.sheets` first, then `read` and `update`).

## 1. SEO Tracker (everything that is done or found)
- Artifact: https://claude.ai/artifact/9SS2JRiuoadCS98CHVFPkc (id 44561fc7-f98a-47a2-ae1d-68b992c95d29), workbook node 5f54dcc5-5f27, sheet `Tracker`.
- `readSheets`, then read the header row and the last filled row. Append new rows BELOW the last row, matching the existing columns and wording style. Never overwrite or reorder existing rows.
- One row per piece of work: date, area (content, technical, off-page, research), what was done, the URL or commit, result or next step.

## 2. Content Schedule Log (every post, thread, article and blog)
- Artifact: https://claude.ai/artifact/WEr4EfZLQwJgS4KexScSvr (id ecc7ebfe-7f8a-4888-8cc4-393de767695f), workbook node 655ce467-a697, sheet `Schedule`.
- Columns: Date, Time (IST), Platform, Format, Topic or title, Goal, Tool, Status, Link or ID, Notes. Status is a dropdown: Planned, Scheduled, Published, Skipped.
- Add a row for anything newly planned or scheduled. Change the Status cell (do not add a duplicate row) when a planned item gets scheduled or a scheduled item publishes. Put the Buffer post id or the LinkedIn article id in `Link or ID`.
- Keep rows in date order. Dates as `YYYY-MM-DD`, times in IST.

## Rules
- Read the current revision before every write and pass it as `base`. If refused with `baseIsNotTheRevision`, read again and resend.
- Replace nothing a person typed without saying so. Say which cells you will overwrite before doing it.
- Content rules still apply: no links in LinkedIn or X bodies except the intro post or article, no dashes, no author mentions in company page posts, keep Adsmentor mentions alongside AIM.
- No keys, tokens, personal data or lead details in either sheet.
- Finish by telling the owner in one line what was added to each sheet.
