# AI News Digest

Every morning it reads your RSS feeds, keeps what's new, and has AI pick the stories that matter to you, with one line each on why. Delivered to Slack and email.

**Needs:** OpenAI API key (gpt-4o-mini, about a cent a day), Slack bot token, Gmail.

## Setup

1. Import `workflow.json`.
2. In **Config**:
   - `feeds`: one RSS or Atom URL per line. Most blogs and news sites have one (try `/feed`, `/rss` or `/rss.xml`).
   - `focus`: describe what you care about in a sentence. The more specific, the better the picks.
   - `slack_channel_id` and `alert_email`.
3. Connect OpenAI, Slack and Gmail. Only want one channel? Delete the other node.
4. Activate.

## Details

- Only articles from the last 26 hours (`lookback_hours`), newest first, up to 25 (`max_items`) sent to the AI.
- Never sends the same link twice, even across runs.
- A feed that's down is skipped. The rest still arrive.
- If the AI call fails, you get the plain headlines with links instead of nothing.
- The AI is told to use only what's in the articles, so it summarises rather than invents.
