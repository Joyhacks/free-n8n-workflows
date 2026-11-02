// Read child sitemaps: collects page URLs from every child sitemap of an index.
const cfg = $('Config').first().json;
const max = Math.max(1, Number(cfg.max_pages) || 200);
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
const pages = new Set();
for (const item of $input.all()) {
  const r = item.json;
  if (!r.statusCode || r.statusCode >= 400) continue;
  for (const m of String(r.body || '').matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/gi)) {
    const u = decode(m[1].trim());
    if (/^https?:\/\//i.test(u)) pages.add(u);
    if (pages.size >= max) break;
  }
  if (pages.size >= max) break;
}
if (!pages.size) throw new Error('The sitemap index had no readable child sitemaps.');
return [...pages].map((url) => ({ json: { url, kind: 'page' } }));
