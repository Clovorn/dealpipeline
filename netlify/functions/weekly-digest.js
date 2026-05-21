const SB_URL = 'https://hvmlmequwjxvrmgpltec.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const SENDGRID_KEY = process.env.SENDGRID_API_KEY || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@ronnoco.com';

async function sbFetch(path) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
  });
  return res.json();
}

async function sendEmail(to, subject, html) {
  if (!SENDGRID_KEY) { console.log('Would send digest to:', to); return; }
  await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${SENDGRID_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: Array.isArray(to) ? to.map(e => ({ email: e })) : [{ email: to }] }],
      from: { email: FROM_EMAIL, name: 'Ronnoco Deal Dashboard' },
      subject,
      content: [{ type: 'text/html', value: html }],
    })
  });
}

exports.handler = async () => {
  try {
    const [deals, rules, members] = await Promise.all([
      sbFetch('deals?select=*&deal_status=eq.active'),
      sbFetch('notification_rules?stage=eq.weekly_digest&select=*'),
      sbFetch('team_members?active=eq.true&select=name,email,id'),
    ]);

    const rule = rules?.[0];
    if (!rule || !rule.enabled) return { statusCode: 200, body: 'Digest disabled' };

    const recipientIds = rule.recipient_ids || [];
    const memberMap = {};
    (members || []).forEach(m => { memberMap[m.id] = m; });
    const recipients = recipientIds.map(id => memberMap[id]?.email).filter(Boolean);
    if (!recipients.length) return { statusCode: 200, body: 'No recipients' };

    const active = deals || [];
    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const newThisWeek = active.filter(d => new Date(d.created_at) >= weekAgo);
    const fundedThisWeek = active.filter(d => d.current_step === 'funded' && new Date(d.updated_at) >= weekAgo);
    const installsThisWeek = active.filter(d => d.current_step === 'install_scheduled' && new Date(d.updated_at) >= weekAgo);

    const stageCounts = {
      'In Financing': active.filter(d => d.phase === 'leasing' && d.current_step !== 'funded').length,
      'Credit Stage': active.filter(d => ['credit_sent','credit_received'].includes(d.current_step)).length,
      'Funded': active.filter(d => d.current_step === 'funded' || d.phase === 'ops').length,
      'In Ops': active.filter(d => d.phase === 'ops' && d.current_step !== 'complete').length,
      'Complete': active.filter(d => d.current_step === 'complete').length,
    };

    const stageRows = Object.entries(stageCounts).map(([label, count]) =>
      `<tr><td style="padding:6px 10px;color:#5a6a7e;font-size:13px;border-bottom:1px solid #f0f0f0">${label}</td>
       <td style="padding:6px 10px;font-weight:700;font-size:14px;color:#1a3a6b;border-bottom:1px solid #f0f0f0">${count}</td></tr>`
    ).join('');

    const dealRows = (arr, emptyMsg) => arr.length === 0
    ? `<p style="color:#8a9ab0;font-size:12px;font-style:italic;margin:4px 0">${emptyMsg}</p>`
    : arr.map(d => {
        const name = [d.first_name, d.last_name].filter(Boolean).join(' ');
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f0f2f5;font-size:12px">
          <div><strong style="color:#1e2d42">${name}</strong> <span style="color:#8a9ab0">· ${d.store_name || ''}</span></div>
          <div style="color:#5a6a7e;font-size:11px">${d.sales_rep || ''}</div>
        </div>`;
      }).join('');

    const weekStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<div style="max-width:520px;margin:24px auto;padding:0 16px">
  <div style="background:#1a3a6b;border-radius:10px 10px 0 0;padding:14px 20px">
    <div style="color:#fff;font-size:16px;font-weight:700">Ronnoco Weekly Pipeline Digest</div>
    <div style="color:rgba(255,255,255,0.6);font-size:12px">Week of \${weekStr}</div>
  </div>
  <div style="background:#fff;border:1px solid #e2e6ed;border-top:none;border-radius:0 0 10px 10px;padding:20px 24px">

    <p style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#8a9ab0;margin:0 0 8px">Pipeline Summary</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      \${stageRows}
      <tr style="border-top:2px solid #e2e6ed">
        <td style="padding:8px 0;font-weight:700;color:#1e2d42;font-size:13px">Total Active</td>
        <td style="padding:8px 0;font-weight:700;font-size:16px;color:#1a3a6b">\${active.length}</td>
      </tr>
    </table>

    <p style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#8a9ab0;margin:0 0 8px">New This Week (\${newThisWeek.length})</p>
    <div style="margin-bottom:18px">\${dealRows(newThisWeek, 'No new deals this week')}</div>

    <p style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#8a9ab0;margin:0 0 8px">Funded This Week (\${fundedThisWeek.length})</p>
    <div style="margin-bottom:18px">\${dealRows(fundedThisWeek, 'No deals funded this week')}</div>

    <p style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#8a9ab0;margin:0 0 8px">Installs Scheduled This Week (\${installsThisWeek.length})</p>
    <div style="margin-bottom:18px">\${dealRows(installsThisWeek, 'No installs scheduled this week')}</div>

    <div style="text-align:center;padding:14px 0 4px;border-top:1px solid #f0f2f5">
      <a href="https://ronnoco-deal-dashboard.netlify.app" style="display:inline-block;background:#1a3a6b;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 24px;border-radius:6px">Open Deal Dashboard →</a>
      <p style="margin:10px 0 0;font-size:11px;color:#8a9ab0">Review deals, add notes, and track progress in the dashboard.</p>
    </div>

    <p style="font-size:10px;color:#c0c8d4;margin:14px 0 0;text-align:center">Ronnoco Deal Dashboard · Automated weekly digest</p>
  </div>
</div>
</body></html>`;

    await sendEmail(recipients, `Ronnoco Pipeline Digest — Week of ${weekStr}`, html);
    return { statusCode: 200, body: JSON.stringify({ ok: true, sent_to: recipients }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
