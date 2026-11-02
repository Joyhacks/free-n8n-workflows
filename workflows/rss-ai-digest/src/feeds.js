// Feeds: one feed URL per line in Config.
const raw = String($('Config').first().json.feeds || '');
const urls = [...new Set(raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')))];
const bad = urls.filter((u) => !/^https?:\/\//i.test(u));
if (bad.length) throw new Error(`Config.feeds has invalid URLs: ${bad.join(', ')}`);
if (!urls.length) throw new Error('Config.feeds is empty. Add one RSS or Atom feed URL per line.');
return urls.map((url) => ({ json: { url } }));
