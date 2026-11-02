// Read sitemap: handles a normal sitemap (<urlset>) or a sitemap index
// (<sitemapindex>), returning pages or child sitemaps to fetch.
const cfg = $('Config').first().json;
const res = $input.first().json;
if (!res.statusCode || res.statusCode >= 400) {
  throw new Error(`Sitemap ${cfg.sitemap_url} returned HTTP ${res.statusCode || 'error'}`);
}
const xml = String(res.body || '');
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
const locs = [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) => decode(m[1].trim()));
const urls = [...new Set(locs.filter((u) => /^https?:\/\//i.test(u)))];
if (!urls.length) throw new Error(`No URLs found in ${cfg.sitemap_url}. Is it a valid sitemap?`);

const isIndex = /<sitemapindex[\s>]/i.test(xml);
const max = Math.max(1, Number(cfg.max_pages) || 200);
return (isIndex ? urls.slice(0, 50) : urls.slice(0, max)).map((url) => ({ json: { url, kind: isIndex ? 'sitemap' : 'page' } }));
