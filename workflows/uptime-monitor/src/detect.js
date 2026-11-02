// Detect changes: compares each check with the last known state and only
// emits an alert when a site goes down (after N failures in a row) or recovers.
// State lives in workflow static data, which n8n persists for active workflows.
const cfg = $('Config').first().json;
const sites = $('Sites to check').all().map((i) => i.json.url);
const results = $input.all().map((i) => i.json);
const threshold = Math.max(1, Number(cfg.failures_before_alert) || 2);
const store = $getWorkflowStaticData('global');
store.sites = store.sites || {};
const now = Date.now();

const mins = (ms) => {
  const m = Math.round(ms / 60000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};

const events = [];
sites.forEach((url, i) => {
  const r = results[i] || { error: { message: 'no result' } };
  const code = Number(r.statusCode);
  const up = !r.error && code >= 200 && code < 400;
  const reason = r.error ? String(r.error.message || r.error.description || r.error).slice(0, 160) : `HTTP ${code}`;
  const s = store.sites[url] || { status: 'up', fails: 0, since: now };

  if (up) {
    if (s.status === 'down') events.push({ type: 'recovered', url, text: `:large_green_circle: *Recovered* ${url} (was down ${mins(now - s.since)})`, plain: `RECOVERED  ${url}  (was down ${mins(now - s.since)})` });
    store.sites[url] = { status: 'up', fails: 0, since: s.status === 'down' ? now : s.since };
  } else {
    s.fails += 1;
    if (s.status === 'up' && s.fails >= threshold) {
      s.status = 'down';
      s.since = now;
      events.push({ type: 'down', url, text: `:red_circle: *Down* ${url} (${reason}, ${s.fails} failed checks in a row)`, plain: `DOWN  ${url}  (${reason}, ${s.fails} failed checks in a row)` });
    }
    store.sites[url] = s;
  }
});

// Forget sites removed from Config.
for (const url of Object.keys(store.sites)) if (!sites.includes(url)) delete store.sites[url];

if (!events.length) return [];
const down = events.filter((e) => e.type === 'down').length;
return [{
  json: {
    events,
    text: events.map((e) => e.text).join('\n'),
    email: events.map((e) => e.plain).join('\n'),
    subject: down ? `${down} site(s) down` : `${events.length} site(s) recovered`,
  },
}];
