// Validate: checks the shared secret, drops bots, requires an email and maps
// common form field names to one row.
const cfg = $('Config').first().json;
const req = $('Form webhook').first().json;
const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
const reject = (status, http_code, response) => [{ json: { status, http_code, response } }];

const secret = String(cfg.intake_secret || '');
if (secret.length < 16 || secret.startsWith('CHANGE_ME')) return reject('misconfigured', 503, { ok: false, error: 'Form intake is not configured yet.' });
const given = String((req.headers || {})['x-webhook-secret'] || (req.query || {}).key || '');
if (given !== secret) return reject('unauthorized', 401, { ok: false, error: 'Unauthorized.' });

const pick = (...keys) => {
  for (const k of keys) {
    const v = body[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
};
if (pick('website_url', '_gotcha', 'hp_field')) return reject('spam', 200, { ok: true });

const email = pick('email', 'Email', 'email_address', 'emailAddress').toLowerCase().slice(0, 254);
if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return reject('invalid', 422, { ok: false, errors: ['A valid email address is required.'] });

// Spreadsheet apps run cells starting with = + - @ as formulas. Neutralise them.
const cell = (s, n) => {
  const v = String(s).slice(0, n);
  return /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
};
const name = pick('name', 'full_name', 'fullName', 'Name') || [pick('first_name', 'firstName'), pick('last_name', 'lastName')].filter(Boolean).join(' ');

return [{
  json: {
    status: 'new',
    http_code: 200,
    response: { ok: true },
    row: {
      Received: new Date().toISOString(),
      Name: cell(name, 120),
      Email: cell(email, 254),
      Phone: cell(pick('phone', 'phone_number', 'phoneNumber', 'tel'), 40),
      Company: cell(pick('company', 'company_name', 'companyName'), 200),
      Message: cell(pick('message', 'Message', 'details', 'enquiry', 'inquiry', 'comments'), 2000),
      Source: cell(pick('source', 'utm_source', 'page') || 'website', 120),
    },
  },
}];
