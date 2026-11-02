# free-n8n-workflows

Five n8n workflows for jobs most small teams need covered. Each one is a single `workflow.json` you can import.

| Workflow | What it does | Needs |
|---|---|---|
| [uptime-monitor](workflows/uptime-monitor) | Checks a list of URLs every 5 minutes, alerts when a site goes down and again when it recovers | Slack, Gmail |
| [broken-link-checker](workflows/broken-link-checker) | Weekly crawl of your sitemap, reports pages that return errors | Slack, Gmail |
| [lead-form-to-sheets](workflows/lead-form-to-sheets) | Website form submissions to a Google Sheet row and a Slack message | Google Sheets, Slack |
| [rss-ai-digest](workflows/rss-ai-digest) | Morning digest of your RSS feeds, filtered by an LLM against a topic you describe | OpenAI, Slack, Gmail |
| [error-alerts](workflows/error-alerts) | Error workflow for all your other workflows: Slack plus email with a link to the failed run | Slack, Gmail |

## Using one

Download the folder's `workflow.json`, then in n8n go to **Workflows > Import from File**. Every setting lives in the workflow's **Config** node, so fill that in, add the credentials n8n asks for, and activate. Each folder's README covers setup and behaviour in more detail.

Built for n8n 1.x, Cloud or self-hosted. Set up [error-alerts](workflows/error-alerts) first and point the others at it.

## Design notes

A few choices that apply across all five:

- Configuration is in one Set node per workflow, so nothing is hardcoded across several nodes.
- Bad configuration throws a clear error rather than running with defaults. Failures a workflow can recover from (a dead feed, a timeout on one URL, a failed sheet write) are handled in the workflow. Anything else reaches the error workflow.
- The uptime monitor and link checker only message you when something changes or is broken. The uptime monitor waits for consecutive failures before alerting.
- The lead form checks a shared secret, ignores honeypot submissions, and prefixes cell values starting with `=`, `+`, `-` or `@` so they can't run as spreadsheet formulas.
- Where Slack and email both send, Slack is set to continue on error so the email still goes out.
- The exported JSON has no credentials, pinned execution data or instance IDs.

## How the repo is built

The JavaScript in each workflow's Code nodes lives in `workflows/<name>/src/` and is unit tested against a mocked n8n runtime (`$`, `$input`, `$getWorkflowStaticData`). `build.py` generates every `workflow.json` and embeds those files unchanged, so the code you import is the code that was tested. A second test file checks the generated workflows: connections, node references, error outputs, and that every Config field the code reads exists.

```bash
node --test tests/*.test.mjs   # 56 tests
python3 build.py               # regenerate workflow.json files
```

CI runs the tests and fails if the committed `workflow.json` files don't match a fresh build.

## License

MIT. Written by [Adeola Ilori](https://github.com/Joyhacks). I build larger automations for businesses at [adeolaforgehq.com](https://adeolaforgehq.com).
