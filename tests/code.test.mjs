// Runs every Code node source against a mocked n8n runtime.
// node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (wf, file) => readFileSync(new URL(`../workflows/${wf}/src/${file}`, import.meta.url), 'utf8');
const items = (arr) => arr.map((json) => ({ json }));

function run(code, { input = [], nodes = {}, store = {} }) {
  const $ = (name) => {
    if (!(name in nodes)) throw new Error(`unknown node "${name}"`);
    const v = nodes[name];
    const list = Array.isArray(v) ? v : [v];
    return { first: () => ({ json: list[0] }), all: () => items(list) };
  };
  const $input = { first: () => ({ json: input[0] }), all: () => items(input) };
  return new Function('$', '$input', '$getWorkflowStaticData', code)($, $input, () => store).map((i) => i.json);
}

// ------------------------------------------------------------ uptime
test('uptime: parses site list, rejects bad config', () => {
  const sites = src('uptime-monitor', 'sites.js');
  const out = run(sites, { nodes: { Config: { sites: 'https://a.com\n\n# comment\nhttps://b.com/x\nhttps://a.com' } } });
  assert.deepEqual(out.map((o) => o.url), ['https://a.com', 'https://b.com/x']);
  assert.throws(() => run(sites, { nodes: { Config: { sites: '' } } }), /empty/);
  assert.throws(() => run(sites, { nodes: { Config: { sites: 'a.com' } } }), /invalid/);
});

test('uptime: alerts once on down after threshold, once on recovery', () => {
  const detect = src('uptime-monitor', 'detect.js');
  const store = {};
  const tick = (results) => run(detect, { input: results, nodes: { Config: { failures_before_alert: 2 }, 'Sites to check': [{ url: 'https://a.com' }, { url: 'https://b.com' }] }, store });
  const ok = { statusCode: 200 };
  assert.deepEqual(tick([ok, ok]), [], 'all up, nothing sent');
  assert.deepEqual(tick([{ statusCode: 503 }, ok]), [], 'first failure is not an alert');
  const down = tick([{ statusCode: 503 }, ok]);
  assert.equal(down.length, 1);
  assert.match(down[0].text, /Down\* https:\/\/a\.com \(HTTP 503, 2 failed/);
  assert.equal(down[0].subject, '1 site(s) down');
  assert.deepEqual(tick([{ statusCode: 503 }, ok]), [], 'still down: no repeat alert');
  const up = tick([ok, ok]);
  assert.match(up[0].text, /Recovered\* https:\/\/a\.com \(was down 0 min\)/);
  assert.equal(up[0].subject, '1 site(s) recovered');
  assert.ok(!/[*:]/.test(up[0].email.replace('https:', '')), 'email has no Slack markup');
});

test('uptime: network errors count as down, 3xx is up, removed sites are forgotten', () => {
  const detect = src('uptime-monitor', 'detect.js');
  const store = {};
  const run1 = (results, sites) => run(detect, { input: results, nodes: { Config: { failures_before_alert: 1 }, 'Sites to check': sites.map((url) => ({ url })) }, store });
  const out = run1([{ error: { message: 'getaddrinfo ENOTFOUND a.com' } }, { statusCode: 301 }], ['https://a.com', 'https://b.com']);
  assert.match(out[0].text, /ENOTFOUND/);
  assert.equal(out[0].events.length, 1);
  run1([{ statusCode: 200 }], ['https://b.com']);
  assert.deepEqual(Object.keys(store.sites), ['https://b.com']);
});

test('uptime: URLs with underscores survive into the email', () => {
  const detect = src('uptime-monitor', 'detect.js');
  const out = run(detect, { input: [{ statusCode: 500 }], nodes: { Config: { failures_before_alert: 1 }, 'Sites to check': [{ url: 'https://a.com/my_page' }] } });
  assert.match(out[0].email, /https:\/\/a\.com\/my_page/);
});

// ------------------------------------------------------------ broken links
const SITEMAP = `<?xml version="1.0"?><urlset><url><loc>https://s.com/</loc></url><url><loc> https://s.com/a?x=1&amp;y=2 </loc></url><url><loc><![CDATA[https://s.com/b]]></loc></url><url><loc>https://s.com/</loc></url></urlset>`;
const INDEX = `<sitemapindex><sitemap><loc>https://s.com/post-sitemap.xml</loc></sitemap><sitemap><loc>https://s.com/page-sitemap.xml</loc></sitemap></sitemapindex>`;
const CFG_SITE = { sitemap_url: 'https://s.com/sitemap.xml', max_pages: 200 };

test('links: reads a sitemap, decodes entities and CDATA, dedupes', () => {
  const out = run(src('broken-link-checker', 'read-sitemap.js'), { input: [{ statusCode: 200, body: SITEMAP }], nodes: { Config: CFG_SITE } });
  assert.deepEqual(out.map((o) => o.url), ['https://s.com/', 'https://s.com/a?x=1&y=2', 'https://s.com/b']);
  assert.ok(out.every((o) => o.kind === 'page'));
});

test('links: sitemap index returns child sitemaps', () => {
  const out = run(src('broken-link-checker', 'read-sitemap.js'), { input: [{ statusCode: 200, body: INDEX }], nodes: { Config: CFG_SITE } });
  assert.deepEqual(out.map((o) => o.kind), ['sitemap', 'sitemap']);
});

test('links: bad sitemap fails loudly', () => {
  const read = src('broken-link-checker', 'read-sitemap.js');
  assert.throws(() => run(read, { input: [{ statusCode: 404, body: '' }], nodes: { Config: CFG_SITE } }), /HTTP 404/);
  assert.throws(() => run(read, { input: [{ statusCode: 200, body: '<html>hi</html>' }], nodes: { Config: CFG_SITE } }), /No URLs/);
});

test('links: child sitemaps are merged and capped', () => {
  const child = src('broken-link-checker', 'read-child-sitemaps.js');
  const out = run(child, { input: [{ statusCode: 200, body: SITEMAP }, { statusCode: 500, body: '' }, { statusCode: 200, body: '<loc>https://s.com/c</loc>' }], nodes: { Config: CFG_SITE } });
  assert.equal(out.length, 4);
  assert.equal(run(child, { input: [{ statusCode: 200, body: SITEMAP }], nodes: { Config: { ...CFG_SITE, max_pages: 2 } } }).length, 2);
  assert.throws(() => run(child, { input: [{ statusCode: 500 }], nodes: { Config: CFG_SITE } }), /no readable/);
});

test('links: report lists only broken pages, quiet when clean', () => {
  const report = src('broken-link-checker', 'report.js');
  const pages = [{ url: 'https://s.com/' }, { url: 'https://s.com/old' }, { url: 'https://s.com/down' }, { url: 'https://s.com/moved' }];
  const out = run(report, { input: [{ statusCode: 200 }, { statusCode: 404 }, { error: { message: 'timeout of 15000ms exceeded' } }, { statusCode: 301 }], nodes: { Config: CFG_SITE, 'Pages to check': pages } });
  assert.equal(out[0].broken_count, 2);
  assert.match(out[0].text, /HTTP 404  https:\/\/s\.com\/old/);
  assert.match(out[0].text, /timeout/);
  assert.match(out[0].subject, /2 broken page\(s\) on s\.com, out of 4 checked/);
  const clean = { input: [{ statusCode: 200 }], nodes: { Config: CFG_SITE, 'Pages to check': [{ url: 'https://s.com/' }] } };
  assert.deepEqual(run(report, clean), []);
  clean.nodes.Config = { ...CFG_SITE, report_when_clean: true };
  assert.match(run(report, clean)[0].subject, /All 1 pages/);
});

// ------------------------------------------------------------ lead form
const SECRET = 'a-long-test-secret-123456';
const lead = (body, headers = { 'x-webhook-secret': SECRET }, query = {}) =>
  run(src('lead-form-to-sheets', 'validate.js'), { nodes: { Config: { intake_secret: SECRET }, 'Form webhook': { body, headers, query } } })[0];

test('lead form: good lead becomes a row', () => {
  const r = lead({ name: 'Ann Lee', email: ' Ann@Shop.IO', phone: '+44 7700 900123', message: 'Need a quote' });
  assert.equal(r.status, 'new');
  assert.equal(r.row.Email, 'ann@shop.io');
  assert.equal(r.row.Name, 'Ann Lee');
  assert.equal(r.row.Source, 'website');
  assert.match(r.row.Received, /^\d{4}-\d\d-\d\dT/);
});

test('lead form: auth, honeypot and validation', () => {
  assert.equal(lead({ email: 'a@b.co' }, {}).http_code, 401);
  assert.equal(lead({ email: 'a@b.co' }, {}, { key: SECRET }).status, 'new');
  assert.equal(lead({ email: 'a@b.co', _gotcha: 'x' }).http_code, 200);
  assert.equal(lead({ email: 'a@b.co', _gotcha: 'x' }).status, 'spam');
  assert.equal(lead({ name: 'no email' }).http_code, 422);
  const unset = run(src('lead-form-to-sheets', 'validate.js'), { nodes: { Config: { intake_secret: 'CHANGE_ME_to_a_long_random_string' }, 'Form webhook': { body: { email: 'a@b.co' }, headers: {} } } })[0];
  assert.equal(unset.http_code, 503);
});

test('lead form: spreadsheet formula injection is neutralised', () => {
  const r = lead({ email: 'a@b.co', name: '=HYPERLINK("http://evil","click")', company: '+1+1', message: '@SUM(A1)', phone: '-2' });
  for (const k of ['Name', 'Company', 'Message', 'Phone']) assert.ok(r.row[k].startsWith("'"), k);
});

test('lead form: first/last name fallback', () => {
  assert.equal(lead({ email: 'a@b.co', first_name: 'Ann', last_name: 'Lee' }).row.Name, 'Ann Lee');
});

// ------------------------------------------------------------ rss digest
test('rss: feed list parsing', () => {
  const feeds = src('rss-ai-digest', 'feeds.js');
  assert.equal(run(feeds, { nodes: { Config: { feeds: 'https://a.com/rss\nhttps://a.com/rss\n# x' } } }).length, 1);
  assert.throws(() => run(feeds, { nodes: { Config: { feeds: '' } } }), /empty/);
});

test('rss: keeps recent unseen items, skips failed feeds, never resends', () => {
  const code = src('rss-ai-digest', 'new-items.js');
  const now = Date.now();
  const iso = (h) => new Date(now - h * 3600e3).toISOString();
  const input = [
    { title: 'Fresh', link: 'https://www.news.com/1#top', isoDate: iso(1), contentSnippet: '<p>Body</p>' },
    { title: 'Older', link: 'https://news.com/2', isoDate: iso(30) },
    { title: 'Dupe', link: 'https://www.news.com/1', isoDate: iso(2) },
    { error: { message: 'feed 500' } },
    { title: 'No date', link: 'https://news.com/3' },
    { title: 'Mid', link: 'https://blog.dev/4', pubDate: new Date(now - 5 * 3600e3).toUTCString() },
  ];
  const store = {};
  const [out] = run(code, { input, nodes: { Config: { lookback_hours: 26, max_items: 25 } }, store });
  assert.equal(out.count, 2);
  assert.match(out.list, /^1\. Fresh \(news\.com\)\nBody\nhttps:\/\/www\.news\.com\/1\n\n2\. Mid/);
  assert.deepEqual(run(code, { input, nodes: { Config: {} }, store }), [], 'second run sends nothing new');
});

test('rss: digest falls back to headlines when AI fails, email has no Slack markup', () => {
  const fmt = src('rss-ai-digest', 'format.js');
  const nodes = { Config: { digest_title: 'Brief' }, 'New items': { fallback: '- <https://a.com/x_y|Title> (a.com)' } };
  const failed = run(fmt, { input: [{ error: 'timeout' }], nodes })[0];
  assert.match(failed.text, /AI summary unavailable/);
  assert.match(failed.email, /Title: https:\/\/a\.com\/x_y \(a\.com\)/);
  const ai = run(fmt, { input: [{ text: '*Big news*: something happened that matters a lot <https://a.com/z|Read>' }], nodes })[0];
  assert.match(ai.text, /^\*Brief, /);
  assert.ok(!ai.email.includes('<https'), 'links converted');
  assert.ok(!/\*Big news\*/.test(ai.email), 'bold removed');
});

// ------------------------------------------------------------ error alerts
test('error alerts: execution error', () => {
  const [out] = run(src('error-alerts', 'format.js'), { nodes: { 'On workflow error': {
    execution: { id: '231', url: 'https://n8n.x/execution/231', error: { message: 'Request failed with status code 401' }, lastNodeExecuted: 'HubSpot', mode: 'trigger' },
    workflow: { id: '1', name: 'Speed-to-Lead' },
  } } });
  assert.equal(out.subject, 'n8n failure: Speed-to-Lead');
  assert.match(out.slack, /\*Speed-to-Lead\* failed at \*HubSpot\* \(trigger\)\n>Request failed/);
  assert.match(out.email, /Open the run: https:\/\/n8n\.x\/execution\/231/);
});

test('error alerts: trigger error without an execution', () => {
  const [out] = run(src('error-alerts', 'format.js'), { nodes: { 'On workflow error': { trigger: { error: { message: 'Bad credentials' } }, workflow: { name: 'Gmail poller' } } } });
  assert.match(out.slack, /failed at \*trigger\*/);
  assert.match(out.email, /no saved run/);
});

test('nothing a person reads contains an em dash', () => {
  for (const [wf, f] of [['uptime-monitor', 'detect.js'], ['broken-link-checker', 'report.js'], ['rss-ai-digest', 'format.js'], ['error-alerts', 'format.js'], ['lead-form-to-sheets', 'validate.js']]) {
    assert.ok(!src(wf, f).includes('\u2014'), `${wf}/${f}`);
  }
});
