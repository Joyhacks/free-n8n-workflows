# Lead Form to Google Sheets and Slack

Point any website form here. Every lead lands as a row in Google Sheets and a message in Slack.

**Needs:** Google Sheets, Slack bot token.

## Setup

1. Make a Google Sheet with a tab called `Leads` and this header row:
   `Received | Name | Email | Phone | Company | Message | Source`
2. Import `workflow.json`.
3. In **Config**: set `intake_secret` to a long random string (`openssl rand -hex 24`), `sheet_id` (the long ID in the sheet's URL) and `slack_channel_id`.
4. Connect Google Sheets and Slack.
5. Point your form at the **production** webhook URL, sending the secret as header `x-webhook-secret`, or as `?key=YOUR_SECRET` if your form tool can't set headers.
6. Activate.

Test it:

```bash
curl -X POST "https://YOUR-N8N/webhook/lead-form" \
  -H "Content-Type: application/json" -H "x-webhook-secret: YOUR_SECRET" \
  -d '{"name":"Test Lead","email":"test@example.com","message":"Hello"}'
```

## What it protects against

- **No secret, no entry.** Wrong secret gets 401. If you never set one, it stays closed (503).
- **Bots.** Add a hidden field named `website_url` to your form. Bots fill it and get a silent OK. People never see it.
- **Spreadsheet formula injection.** A "name" like `=HYPERLINK(...)` is stored as text, not run as a formula.
- **Lost leads.** If the sheet write fails, the full lead goes to Slack instead.

Field names it understands: `name` (or `first_name` and `last_name`), `email`, `phone`, `company`, `message`, `source`.

## Want more than a spreadsheet?

The **Speed-to-Lead Engine** replies to every lead in under a minute, scores them with AI, syncs HubSpot and alerts you only for the hot ones. [adeolaforgehq.com](https://adeolaforgehq.com)
