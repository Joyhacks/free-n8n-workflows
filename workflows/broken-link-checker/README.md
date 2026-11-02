# Broken Link Checker

Every Monday at 7am it reads your sitemap, opens every page and sends you the broken ones on Slack and email.

Broken pages cost rankings and visitors, and nobody notices them until a customer does. This makes someone notice on Monday morning.

**Needs:** Slack bot token, Gmail.

## Setup

1. Import `workflow.json`.
2. In **Config**: set `sitemap_url` (usually `https://yoursite.com/sitemap.xml`), `slack_channel_id` and `alert_email`.
3. Connect Slack and Gmail, then activate.

## Details

- Works with normal sitemaps and sitemap indexes (WordPress with Yoast or Rank Math, Next.js, Shopify, Webflow and most builders).
- Checks 5 pages at a time with a one-second pause between batches, so your server barely notices.
- `max_pages` caps the crawl (default 200).
- Quiet when all pages are healthy. Set `report_when_clean` to `true` for a weekly all-clear.
- A page counts as broken on a timeout, connection error or status 400 and above.
- If the sitemap itself is missing or empty, the run fails loudly. Pair it with the [error alerts](../error-alerts) workflow so you hear about that too.
