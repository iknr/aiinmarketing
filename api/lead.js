/**
 * Form endpoint, mounted at /wp-admin/admin-ajax.php (see vercel.json).
 * Mirrors the response shape Elementor Pro's form handler returns.
 *
 * Set LEAD_WEBHOOK_URL (Zapier / Make / Google Apps Script / CRM) to forward submissions.
 * Without it, submissions are only written to the Vercel function logs.
 */
const FIELDS = ['name', 'phone', 'email', 'stage', 'plan', 'source'];

function json(res, status, payload) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(payload);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { success: false, data: { message: 'Method not allowed.' } });

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const lead = {};
  for (const key of FIELDS) {
    const v = body[`form_fields[${key}]`];
    if (typeof v === 'string') lead[key] = v.trim().slice(0, 200);
  }

  const phone = (lead.phone || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  const valid =
    (lead.name || '').length >= 2 &&
    /^[6-9]\d{9}$/.test(phone) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email || '');
  if (!valid) return json(res, 400, { success: false, data: { message: 'Please check your details and try again.' } });

  const record = {
    ...lead,
    phone,
    form: String(body.form_name || '').slice(0, 80),
    page: String(body.referer || '').slice(0, 300),
    receivedAt: new Date().toISOString(),
  };

  const hook = process.env.LEAD_WEBHOOK_URL;
  if (hook) {
    try {
      const r = await fetch(hook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      });
      if (!r.ok) throw new Error(`webhook responded ${r.status}`);
    } catch (err) {
      console.error('lead webhook failed', err.message, record);
      return json(res, 502, { success: false, data: { message: 'Server error.' } });
    }
  } else {
    console.log('lead (no LEAD_WEBHOOK_URL set)', JSON.stringify(record));
  }

  return json(res, 200, { success: true, data: { message: 'Your submission was successful.' } });
};
