// Build report: pairs each checked page with its result and lists the broken ones.
const cfg = $('Config').first().json;
const pages = $('Pages to check').all().map((i) => i.json.url);
const results = $input.all().map((i) => i.json);

const broken = [];
pages.forEach((url, i) => {
  const r = results[i] || { error: { message: 'no result' } };
  const code = Number(r.statusCode);
  if (r.error) broken.push({ url, why: String(r.error.message || r.error.description || r.error).slice(0, 120) });
  else if (!(code >= 200 && code < 400)) broken.push({ url, why: `HTTP ${code}` });
});

if (!broken.length && cfg.report_when_clean !== true) return [];

const site = (() => { try { return new URL(cfg.sitemap_url).host; } catch { return cfg.sitemap_url; } })();
const lines = broken.slice(0, 50).map((b) => `- ${b.why}  ${b.url}`);
if (broken.length > 50) lines.push(`...and ${broken.length - 50} more`);
const headline = broken.length
  ? `${broken.length} broken page(s) on ${site}, out of ${pages.length} checked`
  : `All ${pages.length} pages on ${site} are healthy`;

return [{
  json: {
    broken_count: broken.length,
    checked: pages.length,
    subject: headline,
    text: `${broken.length ? ':warning:' : ':white_check_mark:'} *${headline}*${lines.length ? '\n' + lines.join('\n') : ''}`,
    email: `${headline}\n\n${lines.join('\n')}\n\nBroken pages hurt rankings and lose visitors. Fix or redirect each one, then update the sitemap.`,
  },
}];
