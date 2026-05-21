const SB_URL = 'https://hvmlmequwjxvrmgpltec.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const SENDGRID_KEY = process.env.SENDGRID_API_KEY || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@ronnoco.com';
const DASHBOARD_URL = 'https://ronnoco-deal-dashboard.netlify.app';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

const STAGE_LABELS = {
  submitted:         'New Deal Submitted',
  notify_lender:     'Lender Notified',
  credit_approved:   'Credit Approved',
  credit_denied:     'Credit Denied',
  funded:            'Deal Funded',
  equip_ordered:     'Equipment Ordered',
  install_scheduled: 'Installation Scheduled',
  weekly_digest:     'Weekly Pipeline Digest',
};

const STAGE_COLORS = {
  submitted:         '#1a3a6b',
  notify_lender:     '#1a3a6b',
  credit_approved:   '#2d6a1f',
  credit_denied:     '#a32d2d',
  funded:            '#854f0b',
  equip_ordered:     '#534ab7',
  install_scheduled: '#0f6e56',
  weekly_digest:     '#1a3a6b',
};

const FIELD_LABELS = {
  customer:              'Customer',
  store:                 'Store',
  address:               'Address',
  deal_type:             'Deal Type',
  total_eq_cost:         'Equipment Cost',
  sales_rep:             'Sales Rep',
  sales_rep_email:       'Sales Rep Email',
  distributor:           'Distributor',
  distributor_rep_email: 'Distributor Rep Email',
  target_install_date:   'Target Install Date',
  equipment_selection:   'Equipment',
  rom:                   'ROM',
  denied_reason:         'Decline Reason',
  coffee_program:        'Coffee Program',
  graphics_package:      'Graphics Package',
  emergency_install:     'Emergency Install',
  notes:                 'Notes',
};

function getDealValue(deal, field) {
  const map = {
    customer:              [deal.first_name, deal.last_name].filter(Boolean).join(' '),
    store:                 deal.store_name,
    address:               deal.address,
    deal_type:             deal.deal_type || deal.purchase_type,
    total_eq_cost:         deal.total_eq_cost,
    sales_rep:             deal.sales_rep,
    sales_rep_email:       deal.sales_rep_email,
    distributor:           deal.parent_distributor,
    distributor_rep_email: deal.distributor_rep_email,
    target_install_date:   deal.target_install_date,
    equipment_selection:   deal.equipment_selection,
    rom:                   deal.rom,
    denied_reason:         deal.denied_reason,
    coffee_program:        deal.coffee_program,
    graphics_package:      deal.graphics_package,
    emergency_install:     deal.emergency_install,
    notes:                 deal.notes,
  };
  return map[field] || '';
}

function buildEmail(stage, deal, fields, extra) {
  const color = STAGE_COLORS[stage] || '#1a3a6b';
  const stageLabel = STAGE_LABELS[stage] || stage;
  const customerName = deal ? [deal.first_name, deal.last_name].filter(Boolean).join(' ') : '';
  const storeName = deal?.store_name || '';

  // Build compact field rows — only fields with values
  const fieldRows = fields
    .filter(f => f !== 'pipeline_summary')
    .map(f => {
      const val = getDealValue(deal, f);
      if (!val) return '';
      return `<tr>
        <td style="padding:5px 0;color:#8a9ab0;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;white-space:nowrap;padding-right:16px;vertical-align:top">${FIELD_LABELS[f] || f}</td>
        <td style="padding:5px 0;color:#1e2d42;font-size:13px;vertical-align:top">${val}</td>
      </tr>`;
    }).filter(Boolean).join('');

  const extraHtml = extra ? `<p style="font-size:13px;color:#5a6a7e;margin:0 0 14px;padding:10px 12px;background:#f7f9fc;border-left:3px solid ${color};border-radius:0 4px 4px 0">${extra}</p>` : '';

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif">
<div style="max-width:520px;margin:24px auto;padding:0 16px">

  <!-- Header -->
  <div style="background:${color};border-radius:10px 10px 0 0;padding:14px 20px;display:flex;align-items:center;gap:10px">
    <div style="background:rgba(255,255,255,0.15);border-radius:5px;padding:3px 8px;font-size:11px;font-weight:700;color:#fff;letter-spacing:0.5px">RONNOCO</div>
    <div style="color:rgba(255,255,255,0.9);font-size:13px;font-weight:600">${stageLabel}</div>
  </div>

  <!-- Body -->
  <div style="background:#ffffff;border:1px solid #e2e6ed;border-top:none;border-radius:0 0 10px 10px;padding:20px 24px">

    ${customerName || storeName ? `
    <div style="margin-bottom:14px">
      ${customerName ? `<div style="font-size:18px;font-weight:700;color:#1e2d42;margin-bottom:2px">${customerName}</div>` : ''}
      ${storeName ? `<div style="font-size:13px;color:#5a6a7e">${storeName}</div>` : ''}
    </div>` : ''}

    ${extraHtml}

    ${fieldRows ? `
    <table style="width:100%;border-collapse:collapse;margin-bottom:18px">
      ${fieldRows}
    </table>` : ''}

    <!-- CTA -->
    <div style="text-align:center;padding:14px 0 4px;border-top:1px solid #f0f2f5">
      <a href="${DASHBOARD_URL}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 24px;border-radius:6px;letter-spacing:-0.1px">View Deal in Dashboard →</a>
      <p style="margin:10px 0 0;font-size:11px;color:#8a9ab0">Add notes, upload documents, and track progress in the Ronnoco Deal Dashboard.</p>
    </div>

    <p style="font-size:10px;color:#c0c8d4;margin:14px 0 0;text-align:center">
      Ronnoco Beverage Solutions · Deal Dashboard · ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}
    </p>
  </div>
</div>
</body></html>`;
}

async function sendEmail(to, subject, html) {
  if (!SENDGRID_KEY) {
    console.log('No SendGrid key — simulating send to:', to);
    return true;
  }
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${SENDGRID_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: Array.isArray(to) ? to.map(e => ({ email: e })) : [{ email: to }] }],
      from: { email: FROM_EMAIL, name: 'Ronnoco Deal Dashboard' },
      subject,
      content: [{ type: 'text/html', value: html }],
    })
  });
  return res.ok;
}

async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', ...opts.headers },
    ...opts
  });
  if (res.status === 204) return null;
  return res.json();
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method not allowed' };

  try {
    const { stage, deal_id, extra } = JSON.parse(event.body || '{}');
    if (!stage) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing stage' }) };

    // Load rule
    const rules = await sbFetch(`notification_rules?stage=eq.${stage}&select=*`);
    const rule = rules?.[0];
    if (!rule || !rule.enabled) return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, skipped: 'disabled' }) };

    const recipientIds = rule.recipient_ids || [];
    const fields = rule.include_fields || [];

    // Load recipients
    let recipients = [];
    if (recipientIds.length > 0) {
      const idFilter = recipientIds.map(id => `id.eq.${id}`).join(',');
      const members = await sbFetch(`team_members?or=(${idFilter})&active=eq.true&select=name,email`);
      recipients = (members || []).map(m => m.email).filter(Boolean);
    }

    if (!recipients.length) return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, skipped: 'no recipients configured' }) };

    // Load deal
    let deal = null;
    if (deal_id) {
      const deals = await sbFetch(`deals?id=eq.${deal_id}&select=*`);
      deal = deals?.[0] || null;
    }

    // Add ROM email for equipment ordered and install scheduled
    if (['equip_ordered', 'install_scheduled'].includes(stage) && deal?.rom_email) {
      if (!recipients.includes(deal.rom_email)) recipients.push(deal.rom_email);
    }

    const stageLabel = STAGE_LABELS[stage] || stage;
    const customerName = deal ? [deal.first_name, deal.last_name].filter(Boolean).join(' ') : '';
    const storeName = deal?.store_name || '';
    const subject = `${stageLabel}${customerName ? ` — ${customerName}` : ''}${storeName ? ` / ${storeName}` : ''}`;

    const html = buildEmail(stage, deal, fields, extra || '');
    await sendEmail(recipients, subject, html);

    // Log activity on deal
    if (deal_id) {
      await sbFetch('deal_activity', {
        method: 'POST',
        body: JSON.stringify({
          deal_id,
          action: 'Notification sent',
          detail: `${stageLabel} · ${recipients.join(', ')}`,
          actor: 'System'
        })
      });
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, sent_to: recipients }) };
  } catch (err) {
    console.error('Notify error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
