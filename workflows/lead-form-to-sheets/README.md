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

## Behaviour

Requests without the right secret get a 401. If `intake_secret` is still the default, every request gets a 503, so a half-configured workflow never accepts data.

Add a hidden field named `website_url` to your form as a honeypot. Bots fill it and get a 200 with nothing saved.

Values starting with `=`, `+`, `-` or `@` are prefixed with `'` so the sheet stores them as text instead of running them as formulas.

If the sheet write fails after three tries, the full lead is posted to Slack so it isn't lost.

Field names it understands: `name` (or `first_name` and `last_name`), `email`, `phone`, `company`, `message`, `source`.
