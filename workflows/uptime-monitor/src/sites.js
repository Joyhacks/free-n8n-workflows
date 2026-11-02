// Sites to check: one URL per line in Config. Blank lines and # comments are skipped.
const raw = String($('Config').first().json.sites || '');
const urls = [...new Set(
  raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')),
)];
const bad = urls.filter((u) => !/^https?:\/\/[^\s/]+/i.test(u));
if (bad.length) throw new Error(`Config.sites has invalid URLs: ${bad.join(', ')}`);
if (!urls.length) throw new Error('Config.sites is empty. Add one URL per line.');
return urls.map((url) => ({ json: { url } }));
