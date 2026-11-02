"""Generates every workflow.json from the tested sources in workflows/*/src.

    python3 build.py

Code nodes are embedded byte-for-byte from the .js files, so what ships is
what the tests ran. Edit the sources, run the tests, rebuild.
"""
import json, uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent / 'workflows'
NS = uuid.UUID('3b7e0c52-1f6a-4d2b-8f0e-0a0b0c0d0e0f')
STICKY = 'n8n-nodes-base.stickyNote'


class WF:
    def __init__(self, slug, name):
        self.slug, self.name, self.nodes, self.conns = slug, name, [], {}

    def uid(self, s):
        return str(uuid.uuid5(NS, f'{self.slug}:{s}'))

    def node(self, name, type_, version, pos, params, **extra):
        n = {'parameters': params, 'id': self.uid(name), 'name': name, 'type': type_, 'typeVersion': version, 'position': list(pos)}
        n.update(extra)
        self.nodes.append(n)
        return name

    def code(self, name, pos, file):
        return self.node(name, 'n8n-nodes-base.code', 2, pos, {'jsCode': (ROOT / self.slug / 'src' / file).read_text()})

    def config(self, pos, fields, name='Config'):
        a = [{'id': self.uid('cfg-' + k), 'name': k, 'type': 'boolean' if isinstance(v, bool) else 'number' if isinstance(v, (int, float)) else 'string', 'value': v}
             for k, v in fields.items()]
        return self.node(name, 'n8n-nodes-base.set', 3.4, pos, {'assignments': {'assignments': a}, 'options': {}})

    def slack(self, name, pos, text, channel_expr="={{ $('Config').first().json.slack_channel_id }}", **extra):
        return self.node(name, 'n8n-nodes-base.slack', 2.2, pos, {
            'select': 'channel', 'channelId': {'__rl': True, 'mode': 'id', 'value': channel_expr},
            'text': text, 'otherOptions': {'includeLinkToWorkflow': False}}, **extra)

    def gmail(self, name, pos, to, subject, message, **extra):
        return self.node(name, 'n8n-nodes-base.gmail', 2.1, pos, {
            'sendTo': to, 'subject': subject, 'message': message, 'emailType': 'text',
            'options': {'appendAttribution': False}}, webhookId=self.uid(name + '-hook'), **extra)

    def http(self, name, pos, url, timeout, batching=None, **extra):
        opts = {'timeout': timeout, 'response': {'response': {'fullResponse': True, 'neverError': True, 'responseFormat': 'text'}}}
        if batching:
            opts['batching'] = {'batch': {'batchSize': batching[0], 'batchInterval': batching[1]}}
        return self.node(name, 'n8n-nodes-base.httpRequest', 4.2, pos, {'url': url, 'options': opts}, **extra)

    def if_(self, name, pos, left, op_type, operation, right=None, single=False):
        c = {'id': self.uid(name + 'cond'), 'leftValue': left, 'operator': {'type': op_type, 'operation': operation}}
        if single:
            c['operator']['singleValue'] = True
        if right is not None:
            c['rightValue'] = right
        return self.node(name, 'n8n-nodes-base.if', 2.2, pos, {'conditions': {
            'options': {'version': 2, 'leftValue': '', 'caseSensitive': True, 'typeValidation': 'strict'},
            'combinator': 'and', 'conditions': [c]}, 'options': {}})

    def link(self, src, dst, out=0, kind='main'):
        outs = self.conns.setdefault(src, {}).setdefault(kind, [])
        while len(outs) <= out:
            outs.append([])
        outs[out].append({'node': dst, 'type': kind, 'index': 0})

    def chain(self, *names):
        for a, b in zip(names, names[1:]):
            self.link(a, b)

    def note(self, pos, w, h, content, color=None):
        p = {'content': content, 'height': h, 'width': w}
        if color:
            p['color'] = color
        self.nodes.append({'parameters': p, 'id': self.uid(content[:40]), 'name': f'Note {len(self.nodes)}', 'type': STICKY, 'typeVersion': 1, 'position': list(pos)})

    def write(self):
        wf = {'name': self.name, 'nodes': self.nodes, 'connections': self.conns, 'active': False, 'settings': {'executionOrder': 'v1'}}
        (ROOT / self.slug / 'workflow.json').write_text(json.dumps(wf, indent=2, ensure_ascii=False) + '\n')
        print('built', self.slug)


def schedule(w, name, pos, interval):
    return w.node(name, 'n8n-nodes-base.scheduleTrigger', 1.2, pos, {'rule': {'interval': [interval]}})


# ---------------------------------------------------------------- uptime
w = WF('uptime-monitor', 'Uptime Monitor')
schedule(w, 'Every 5 minutes', (0, 300), {'field': 'minutes', 'minutesInterval': 5})
w.config((220, 300), {
    'sites': 'https://example.com\nhttps://example.com/pricing',
    'failures_before_alert': 2,
    'timeout_ms': 10000,
    'slack_channel_id': 'C0000000000',
    'alert_email': 'you@yourcompany.com',
})
w.code('Sites to check', (440, 300), 'sites.js')
w.http('Check site', (660, 300), '={{ $json.url }}', "={{ $('Config').first().json.timeout_ms }}", onError='continueRegularOutput')
w.code('Detect changes', (880, 300), 'detect.js')
w.slack('Slack: alert', (1100, 300), '={{ $json.text }}', onError='continueRegularOutput')
w.gmail('Gmail: alert', (1320, 300), "={{ $('Config').first().json.alert_email }}",
        "={{ $('Detect changes').first().json.subject }}", "={{ $('Detect changes').first().json.email }}")
w.chain('Every 5 minutes', 'Config', 'Sites to check', 'Check site', 'Detect changes', 'Slack: alert', 'Gmail: alert')
w.note((-40, -120), 740, 380, """## Uptime Monitor
Checks your sites every 5 minutes and alerts on Slack and email when one goes down or comes back.

- Alerts only on change, so no spam while a site stays down.
- Waits for 2 failures in a row by default, so a single blip doesn't wake you.
- Timeouts, DNS failures, SSL errors and any HTTP status of 400 or above count as down.

**Setup:** list your URLs in **Config** (one per line), set the Slack channel ID and email, connect Slack and Gmail, then activate. State only persists on active workflows.""", 7)
w.write()

# ---------------------------------------------------------------- broken links
w = WF('broken-link-checker', 'Broken Link Checker')
schedule(w, 'Every Monday 7am', (0, 300), {'field': 'weeks', 'triggerAtDay': [1], 'triggerAtHour': 7})
w.config((220, 300), {
    'sitemap_url': 'https://example.com/sitemap.xml',
    'max_pages': 200,
    'report_when_clean': False,
    'slack_channel_id': 'C0000000000',
    'alert_email': 'you@yourcompany.com',
})
w.http('Fetch sitemap', (440, 300), "={{ $('Config').first().json.sitemap_url }}", 20000)
w.code('Read sitemap', (660, 300), 'read-sitemap.js')
w.if_('Sitemap index?', (880, 300), '={{ $json.kind }}', 'string', 'equals', 'sitemap')
w.http('Fetch child sitemaps', (1100, 160), '={{ $json.url }}', 20000)
w.code('Read child sitemaps', (1320, 160), 'read-child-sitemaps.js')
w.node('Pages to check', 'n8n-nodes-base.code', 2, (1540, 300), {'jsCode': '// Joins both paths so the report can pair pages with results.\nreturn $input.all();\n'})
w.http('Check page', (1760, 300), '={{ $json.url }}', 15000, batching=(5, 1000), onError='continueRegularOutput')
w.code('Build report', (1980, 300), 'report.js')
w.slack('Slack: report', (2200, 300), '={{ $json.text }}', onError='continueRegularOutput')
w.gmail('Gmail: report', (2420, 300), "={{ $('Config').first().json.alert_email }}",
        "={{ $('Build report').first().json.subject }}", "={{ $('Build report').first().json.email }}")
w.chain('Every Monday 7am', 'Config', 'Fetch sitemap', 'Read sitemap', 'Sitemap index?')
w.link('Sitemap index?', 'Fetch child sitemaps', 0)
w.link('Sitemap index?', 'Pages to check', 1)
w.chain('Fetch child sitemaps', 'Read child sitemaps', 'Pages to check', 'Check page', 'Build report', 'Slack: report', 'Gmail: report')
w.note((-40, -140), 760, 400, """## Broken Link Checker
Every Monday it reads your sitemap, opens every page and reports anything broken to Slack and email.

- Handles normal sitemaps and sitemap indexes (Yoast, Rank Math, Next.js, most site builders).
- Checks 5 pages at a time with a pause between batches, so it never hammers your server.
- Quiet when everything is fine. Set `report_when_clean` to true for a weekly all-clear.

**Setup:** set `sitemap_url` in **Config**, the Slack channel ID and email, connect Slack and Gmail, activate.""", 7)
w.write()

# ---------------------------------------------------------------- lead form
w = WF('lead-form-to-sheets', 'Lead Form to Google Sheets and Slack')
w.node('Form webhook', 'n8n-nodes-base.webhook', 2, (0, 300), {
    'httpMethod': 'POST', 'path': 'lead-form', 'responseMode': 'responseNode', 'options': {}}, webhookId=w.uid('hook'))
w.config((220, 300), {
    'intake_secret': 'CHANGE_ME_to_a_long_random_string',
    'sheet_id': 'YOUR_GOOGLE_SHEET_ID',
    'sheet_name': 'Leads',
    'slack_channel_id': 'C0000000000',
})
w.code('Validate', (440, 300), 'validate.js')
w.if_('Valid lead?', (660, 300), '={{ $json.status }}', 'string', 'equals', 'new')
w.node('Respond: ok', 'n8n-nodes-base.respondToWebhook', 1.1, (880, 200), {
    'respondWith': 'json', 'responseBody': '={{ JSON.stringify($json.response) }}', 'options': {'responseCode': 200}})
w.node('Respond: rejected', 'n8n-nodes-base.respondToWebhook', 1.1, (880, 420), {
    'respondWith': 'json', 'responseBody': '={{ JSON.stringify($json.response) }}', 'options': {'responseCode': '={{ $json.http_code }}'}})
cols = ['Received', 'Name', 'Email', 'Phone', 'Company', 'Message', 'Source']
w.node('Google Sheets: add row', 'n8n-nodes-base.googleSheets', 4.5, (1100, 200), {
    'operation': 'append',
    'documentId': {'__rl': True, 'mode': 'id', 'value': "={{ $('Config').first().json.sheet_id }}"},
    'sheetName': {'__rl': True, 'mode': 'name', 'value': "={{ $('Config').first().json.sheet_name }}"},
    'columns': {'mappingMode': 'defineBelow', 'value': {c: '={{ $json.row.%s }}' % c for c in cols}},
    'options': {}}, onError='continueErrorOutput', retryOnFail=True, maxTries=3, waitBetweenTries=3000)
LEAD = "$('Validate').first().json.row"
w.slack('Slack: new lead', (1320, 120),
        "=:incoming_envelope: *New lead*: {{ %s.Name || %s.Email }}\n*Email:* {{ %s.Email }}{{ %s.Phone ? '\\n*Phone:* ' + %s.Phone : '' }}{{ %s.Company ? '\\n*Company:* ' + %s.Company : '' }}\n>{{ (%s.Message || '(no message)').slice(0, 500) }}" % ((LEAD,) * 8))
w.slack('Slack: sheet failed', (1320, 300),
        "=:warning: *Lead not saved to the sheet*. Add it by hand: {{ %s.Name }} {{ %s.Email }} {{ %s.Phone }}\n>{{ %s.Message.slice(0, 500) }}\n*Error:* {{ ($json.error && ($json.error.message || $json.error)) || 'see the execution' }}" % ((LEAD,) * 4))
w.chain('Form webhook', 'Config', 'Validate', 'Valid lead?')
w.link('Valid lead?', 'Respond: ok', 0)
w.link('Valid lead?', 'Respond: rejected', 1)
w.link('Respond: ok', 'Google Sheets: add row')
w.link('Google Sheets: add row', 'Slack: new lead', 0)
w.link('Google Sheets: add row', 'Slack: sheet failed', 1)
w.note((-40, -180), 780, 440, """## Lead Form to Google Sheets and Slack
Any website form posts here. Each lead lands in a Google Sheet and pings your Slack.

- Requests need your secret (header `x-webhook-secret`, or `?key=` for form tools without headers). Unset secret = closed.
- Bots that fill the hidden honeypot field get a silent OK.
- Cells starting with = + - @ are escaped, so nobody can inject spreadsheet formulas.
- If the sheet write fails, the lead goes to Slack so it isn't lost.

**Setup:** make a sheet with a `Leads` tab and headers Received, Name, Email, Phone, Company, Message, Source. Fill **Config**, connect Google Sheets and Slack, point your form at the production URL.""", 7)
w.write()

# ---------------------------------------------------------------- rss digest
w = WF('rss-ai-digest', 'AI News Digest')
schedule(w, 'Every morning', (0, 300), {'field': 'days', 'triggerAtHour': 8, 'triggerAtMinute': 0})
w.config((220, 300), {
    'feeds': 'https://hnrss.org/frontpage\nhttps://www.theverge.com/rss/index.xml',
    'focus': 'AI tools, automation and anything useful for running a small software studio',
    'digest_title': 'Daily briefing',
    'lookback_hours': 26,
    'max_items': 25,
    'slack_channel_id': 'C0000000000',
    'alert_email': 'you@yourcompany.com',
})
w.code('Feeds', (440, 300), 'feeds.js')
w.node('Read feed', 'n8n-nodes-base.rssFeedRead', 1.1, (660, 300), {'url': '={{ $json.url }}', 'options': {'ignoreSSL': False}}, onError='continueRegularOutput')
w.code('New items', (880, 300), 'new-items.js')
w.node('AI: write digest', '@n8n/n8n-nodes-langchain.chainLlm', 1.5, (1100, 300), {
    'promptType': 'define',
    'text': '={{ $json.list }}',
    'messages': {'messageValues': [{'message': (
        "=You write a short morning briefing for one busy reader. Their focus: {{ $('Config').first().json.focus }}.\n\n"
        "From the numbered articles, pick up to 7 that matter most to that focus. Skip the rest.\n"
        "For each pick, write one line: what happened and why it matters to this reader, then the link in Slack format <url|short title>.\n"
        "Plain, specific language. No intro, no sign-off, no hype words. Use only facts present in the articles.")}]},
}, onError='continueErrorOutput')
w.node('OpenAI model', '@n8n/n8n-nodes-langchain.lmChatOpenAi', 1.2, (1040, 520), {
    'model': {'__rl': True, 'mode': 'list', 'value': 'gpt-4o-mini', 'cachedResultName': 'gpt-4o-mini'}, 'options': {'temperature': 0.2}})
w.code('Format message', (1320, 300), 'format.js')
w.slack('Slack: digest', (1540, 300), '={{ $json.text }}', onError='continueRegularOutput')
w.gmail('Gmail: digest', (1760, 300), "={{ $('Config').first().json.alert_email }}",
        "={{ $('Format message').first().json.title }}", "={{ $('Format message').first().json.email }}")
w.chain('Every morning', 'Config', 'Feeds', 'Read feed', 'New items', 'AI: write digest')
w.link('OpenAI model', 'AI: write digest', kind='ai_languageModel')
w.link('AI: write digest', 'Format message', 0)
w.link('AI: write digest', 'Format message', 1)
w.chain('Format message', 'Slack: digest', 'Gmail: digest')
w.note((-40, -160), 760, 420, """## AI News Digest
Every morning it reads your RSS feeds, keeps what's new since yesterday, and has AI pick the 7 stories that matter to *you*, with one line each on why.

- Never sends the same article twice.
- A broken feed is skipped, not fatal.
- If the AI call fails, you still get the headlines.
- About 1 cent a day on gpt-4o-mini.

**Setup:** add feed URLs and describe your `focus` in **Config**, connect OpenAI, Slack and Gmail (delete either alert node if you only want one), activate.""", 7)
w.write()

# ---------------------------------------------------------------- error alerts
w = WF('error-alerts', 'Error Alerts for n8n')
w.node('On workflow error', 'n8n-nodes-base.errorTrigger', 1, (0, 300), {})
w.config((220, 300), {'slack_channel_id': 'C0000000000', 'alert_email': 'you@yourcompany.com'})
w.code('Format alert', (440, 300), 'format.js')
w.slack('Slack: alert', (660, 300), '={{ $json.slack }}', onError='continueRegularOutput')
w.gmail('Gmail: alert', (880, 300), "={{ $('Config').first().json.alert_email }}",
        "={{ $('Format alert').first().json.subject }}", "={{ $('Format alert').first().json.email }}",
        retryOnFail=True, maxTries=3, waitBetweenTries=5000)
w.chain('On workflow error', 'Config', 'Format alert', 'Slack: alert', 'Gmail: alert')
w.note((-40, -140), 680, 400, """## Error Alerts for n8n
One error workflow for all your workflows. When any of them fails you get a Slack message and an email with the workflow, the failed node, the error and a link to the run.

Slack runs first. Email always follows, so a Slack outage can't hide a failure.

**Setup:** fill **Config**, connect Slack and Gmail. Then in each workflow you care about: Settings > Error workflow > *Error Alerts for n8n*. No need to activate this one.""", 7)
w.write()
