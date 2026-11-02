// New items: keeps recent articles not sent before, newest first.
// Feeds that failed to load arrive as items with an "error" field and are skipped.
const cfg = $('Config').first().json;
const store = $getWorkflowStaticData('global');
store.sent = store.sent || {};
const now = Date.now();
const windowMs = Math.max(1, Number(cfg.lookback_hours) || 26) * 3600 * 1000;
for (const [k, t] of Object.entries(store.sent)) if (now - t > 14 * 24 * 3600 * 1000) delete store.sent[k];

const clean = (s, n) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const items = [];
const seen = new Set();
for (const { json: it } of $input.all()) {
  if (it.error || !it.link || !it.title) continue;
  const t = Date.parse(it.isoDate || it.pubDate || '');
  if (!Number.isFinite(t) || now - t > windowMs || t - now > 3600 * 1000) continue;
  const link = String(it.link).split('#')[0];
  if (seen.has(link) || store.sent[link]) continue;
  seen.add(link);
  let source = '';
  try { source = new URL(link).hostname.replace(/^www\./, ''); } catch { /* keep blank */ }
  items.push({ t, title: clean(it.title, 200), link, source, snippet: clean(it.contentSnippet || it.content || it.summary, 400) });
}
if (!items.length) return [];

items.sort((a, b) => b.t - a.t);
const picked = items.slice(0, Math.max(1, Number(cfg.max_items) || 25));
for (const i of picked) store.sent[i.link] = now;

const list = picked.map((i, n) => `${n + 1}. ${i.title} (${i.source})\n${i.snippet}\n${i.link}`).join('\n\n');
return [{
  json: {
    count: picked.length,
    list,
    fallback: picked.map((i) => `- <${i.link}|${i.title.replace(/[<>|]/g, '')}> (${i.source})`).join('\n'),
  },
}];
