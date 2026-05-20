const SB_URL = 'https://hvmlmequwjxvrmgpltec.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const params = new URLSearchParams(event.body);
    const raw = params.get('rawRequest');
    if (!raw) return { statusCode: 400, body: 'No rawRequest' };
    const answers = JSON.parse(raw);
    const subId = params.get('submissionID') || answers.submissionID;

    const g = (keys) => {
      for (const k of keys) {
        for (const [, v] of Object.entries(answers)) {
          if (!v || !v.text) continue;
          const t = v.text.toLowerCase();
          if (keys.some(k2 => t.includes(k2.toLowerCase()))) {
            if (v.answer && typeof v.answer === 'object' && (v.answer.first || v.answer.last)) {
              return [v.answer.first, v.answer.last].filter(Boolean).join(' ');
            }
            return v.answer || '';
          }
        }
      }
      return '';
    };

    const deal = {
      jotform_submission_id: subId,
      first_name: g(['first name', 'customer first']),
      last_name: g(['last name', 'customer last']),
      email: g(['email']),
      phone: g(['phone', 'cell']),
      store_name: g(['store name', 'business name', 'dba']),
      address: g(['address', 'street']),
      sales_rep: g(['sales rep', 'rep name']),
      sales_rep_email: g(['rep email', 'sales rep email']),
      distributor_rep_email: g(['distributor rep email', 'dist rep email']),
      rom: g(['rom', 'region']),
      deal_type: g(['deal type', 'type of deal']),
      purchase_type: g(['purchase type', 'applicable']),
      total_eq_cost: g(['eq cost', 'equipment cost']),
      parent_distributor: g(['distributor', 'parent dist']),
      target_install_date: g(['install date', 'target install']),
      graphics_package: g(['graphics package', 'graphics']),
      emergency_install: g(['emergency']),
      coffee_program: g(['coffee program']),
      chain_store: g(['chain store']),
      customer_account: g(['account number', 'customer account']),
      sub_group: g(['sub group']),
      notes: g(['notes', 'additional']),
      is_new_customer: g(['new customer']).toLowerCase().includes('yes') || g(['new customer']).toLowerCase().includes('new'),
      current_step: 'submitted',
      phase: 'leasing',
      deal_status: 'active',
      jotform_answers: answers,
    };

    const check = await fetch(`${SB_URL}/rest/v1/deals?jotform_submission_id=eq.${subId}&select=id`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
    });
    const existing = await check.json();

    let dealId;
    if (existing && existing.length > 0) {
      dealId = existing[0].id;
      await fetch(`${SB_URL}/rest/v1/deals?id=eq.${dealId}`, {
        method: 'PATCH',
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ ...deal, updated_at: new Date().toISOString() })
      });
    } else {
      const ins = await fetch(`${SB_URL}/rest/v1/deals`, {
        method: 'POST',
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation,resolution=ignore-duplicates' },
        body: JSON.stringify(deal)
      });
      const inserted = await ins.json();
      dealId = inserted[0]?.id;
    }

    if (dealId) {
      await fetch(`${SB_URL}/rest/v1/deal_activity`, {
        method: 'POST',
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal_id: dealId, action: 'Deal created', detail: 'Submitted via Jotform', actor: deal.sales_rep || 'Jotform' })
      });
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
