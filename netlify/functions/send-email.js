exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  const { to, subject, body, type } = JSON.parse(event.body || '{}');
  if (!to || !subject || !body) return { statusCode: 400, body: JSON.stringify({ error: 'Missing fields' }) };

  const SENDGRID_KEY = process.env.SENDGRID_API_KEY;
  const FROM_EMAIL = process.env.FROM_EMAIL || 'donotreply@ronnoco.com';

  if (!SENDGRID_KEY) {
    console.log('Email would send to:', to, '| Subject:', subject);
    return { statusCode: 200, body: JSON.stringify({ ok: true, simulated: true }) };
  }

  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${SENDGRID_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: Array.isArray(to) ? to.map(e => ({ email: e })) : [{ email: to }] }],
        from: { email: FROM_EMAIL, name: 'Ronnoco Deal Dashboard' },
        subject,
        content: [{ type: 'text/html', value: body }],
      })
    });
    if (res.ok) return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    const err = await res.text();
    return { statusCode: 500, body: JSON.stringify({ error: err }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
