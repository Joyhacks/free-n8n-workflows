# Uptime Monitor

Checks your sites every 5 minutes. Alerts on Slack and email when one goes down, and again when it recovers. Nothing in between.

**Needs:** Slack bot token, Gmail. No paid monitoring service.

## Setup

1. Import `workflow.json`.
2. In **Config**: list your URLs, one per line. Set `slack_channel_id` (open the channel, click its name, copy the ID from the About tab) and `alert_email`.
3. Connect Slack and Gmail. Invite your Slack app to the channel.
4. Activate. Alert state is only remembered on active workflows, so manual test runs always start fresh.

## How it decides

- A site counts as down on a timeout, DNS failure, SSL error or any status 400 and above. Redirects are followed, so 301 to a working page counts as up.
- It waits for `failures_before_alert` failures in a row (default 2) before alerting, so a single slow response doesn't page you.
- One alert when a site goes down. One when it recovers, with how long it was out. No repeats while it stays down.
- Remove a URL from Config and its state is cleaned up on the next run.

To check more often, change the schedule node. On n8n Cloud, mind the execution quota: every 5 minutes is about 8,600 runs a month.
