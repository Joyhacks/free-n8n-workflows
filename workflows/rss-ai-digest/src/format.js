// Format message: uses the AI digest when it worked, otherwise a plain list,
// so the briefing still arrives when the model is down.
const cfg = $('Config').first().json;
const src = $('New items').first().json;
const ai = $input.first().json;
const date = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const title = `${cfg.digest_title || 'Daily briefing'}, ${date}`;

const body = typeof ai.text === 'string' && ai.text.trim().length > 40
  ? ai.text.trim().slice(0, 3500)
  : `${src.fallback}\n\n_(AI summary unavailable today, showing headlines.)_`;

// Email version: Slack links <url|title> become "title: url", bold markers go.
const email = body.replace(/<(https?:[^|>]+)\|([^>]+)>/g, '$2: $1').replace(/(^|\s)\*([^*\n]+)\*/g, '$1$2').replace(/^_\((.*)\)_$/m, '($1)');
return [{ json: { title, text: `*${title}*\n\n${body}`, email: `${title}\n\n${email}` } }];
