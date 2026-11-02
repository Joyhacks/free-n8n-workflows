# Error Alerts for n8n

One error workflow for all of your workflows. When any of them fails you get a Slack message and an email with the workflow name, the node that failed, the error, and a link straight to the failed run.

n8n doesn't alert you on failures by default. Most people find out a workflow was broken when a client tells them.

**Needs:** Slack bot token, Gmail.

## Setup

1. Import `workflow.json`.
2. In **Config**: set `slack_channel_id` and `alert_email`. Connect Slack and Gmail.
3. In every workflow you care about: **Settings > Error workflow > Error Alerts for n8n**.

You don't need to activate this one. n8n runs error workflows on its own.

## Details

- Slack goes first, email always follows. If Slack is the thing that's broken, the email still arrives.
- Handles trigger failures too (for example an expired Gmail credential on a polling trigger), which have no saved run to link to.
- Error messages are trimmed to 500 characters so a giant stack trace doesn't flood the channel.
