# Free n8n Workflows

Five n8n workflows that do one job each and do it properly. Free, MIT licensed, ready to import.

| Workflow | What it does | Needs |
|---|---|---|
| [Uptime Monitor](workflows/uptime-monitor) | Checks your sites every 5 minutes. Alerts once when one goes down, once when it's back | Slack, Gmail |
| [Broken Link Checker](workflows/broken-link-checker) | Crawls your sitemap every Monday and reports broken pages | Slack, Gmail |
| [Lead Form to Sheets](workflows/lead-form-to-sheets) | Any website form to a Google Sheet row plus a Slack ping | Google Sheets, Slack |
| [AI News Digest](workflows/rss-ai-digest) | Your RSS feeds, filtered by AI to what matters to you, every morning | OpenAI, Slack, Gmail |
| [Error Alerts for n8n](workflows/error-alerts) | Slack and email the moment any of your workflows fails | Slack, Gmail |

## Why these and not the other 8,000 templates

Most free n8n templates are demos. They work once on the author's machine and break on yours. These were built for production:

- **They fail loudly, not silently.** Bad config throws a clear error. Broken feeds, timeouts and failed sheet writes are handled on purpose, and anything that can't be handled reaches the error alert workflow.
- **They don't spam you.** The uptime monitor alerts on change only, with a failure threshold. The link checker is quiet when everything's fine.
- **They're safe to point at the internet.** The form workflow needs a secret, ignores bots and blocks spreadsheet formula injection.
- **They're tested.** The logic in every Code node lives in `workflows/*/src` and is covered by automated tests. `build.py` embeds those exact files into the workflow JSON, so what you import is what was tested.
- **No credentials, no pinned test data, no leftover IDs** in any file.

## Use one

1. Download the `workflow.json` from its folder.
2. In n8n: **Workflows > Import from File**.
3. Fill in the **Config** node (every setting lives there), connect the credentials n8n asks for, activate.

Each folder's README has the full setup and the details of how it behaves. Works on n8n Cloud and self-hosted n8n 1.x.

Start with [Error Alerts](workflows/error-alerts). It makes every other workflow you run safer.

## For developers

```bash
node --test tests/*.test.mjs   # 56 tests: Code node logic and workflow structure
python3 build.py               # regenerate workflow.json files from src/
```

## Need something bigger?

These are free because they're the easy 20%. If you need lead handling that replies to every enquiry in under a minute, AI scoring, CRM sync, or an automation built around how your business actually runs, that's what I do at [adeolaforgehq.com](https://adeolaforgehq.com).

MIT licensed. Built by [Adeola Ilori](https://github.com/Joyhacks).
