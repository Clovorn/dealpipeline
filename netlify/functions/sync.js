const SB_URL = 'https://hvmlmequwjxvrmgpltec.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const FORM_ID = '260154983685872';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };

  const apiKey = event.headers['x-api-key'] || (event.body ? JSON.parse(event.body).apiKey : null);
  if (!apiKey) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing Jotform API key' }) };
  if (!SB_KEY) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'SUPABASE_SERVICE_KEY not configured in Netlify environment variables' }) };

  try {
    // Fetch all existing jotform_submission_ids from DB in one query
    const existingRes = await fetch(`${SB_URL}/rest/v1/deals?select=id,jotform_submission_id,current_step,phase,deal_status&limit=10000`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
    });
    const existingDeals = await existingRes.json();

    // Build a map: submission_id -> {id, current_step, phase, deal_status}
    const existingMap = {};
    for (const d of (existingDeals || [])) {
      if (d.jotform_submission_id) existingMap[d.jotform_submission_id] = d;
    }

    let offset = 0;
    const limit = 100;
    let added = 0, updated = 0;
    let hasMore = true;

    while (hasMore) {
      // Pull newest first (DESC by created_at)
      const url = `https://ronnoco.jotform.com/API/form/${FORM_ID}/submissions?apiKey=${apiKey}&limit=${limit}&offset=${offset}&orderby=created_at,DESC`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.responseCode !== 200) {
        return {
          statusCode: 400, headers: CORS,
          body: JSON.stringify({ error: data.message || 'Jotform API error', code: data.responseCode })
        };
      }

      const submissions = data.content || [];
      if (submissions.length === 0) { hasMore = false; break; }

      for (const sub of submissions) {
        const subId = String(sub.id);
        const answers = sub.answers || {};

        // Field extractor — matches question text to known keywords
        const g = (...keys) => {
          for (const [, v] of Object.entries(answers)) {
            if (!v || !v.text) continue;
            const label = v.text.toLowerCase();
            if (keys.some(k => label.includes(k.toLowerCase()))) {
              const ans = v.answer;
              if (!ans) return '';
              if (typeof ans === 'string') return ans.trim();
              if (typeof ans === 'object') {
                if (ans.first || ans.last) return [ans.first, ans.last].filter(Boolean).join(' ').trim();
                if (Array.isArray(ans)) return ans.filter(Boolean).join(', ').trim();
                return Object.values(ans).filter(Boolean).join(' ').trim();
              }
            }
          }
          return '';
        };

        const newCust = g('new customer');
        const fields = {
          jotform_submission_id: subId,
          first_name:            g('first name', 'customer first') || 'Unknown',
          last_name:             g('last name', 'customer last'),
          email:                 g('email'),
          phone:                 g('phone', 'cell', 'mobile'),
          store_name:            g('store name', 'business name', 'dba', 'store'),
          address:               g('address', 'street', 'location'),
          sales_rep:             g('sales rep', 'rep name', 'salesperson'),
          sales_rep_email:       g('rep email', 'sales rep email'),
          distributor_rep_email: g('distributor rep email', 'dist rep email'),
          rom:                   g('rom', 'region', 'regional'),
          deal_type:             g('deal type', 'type of deal'),
          purchase_type:         g('purchase type', 'applicable'),
          total_eq_cost:         g('eq cost', 'equipment cost', 'total cost'),
          parent_distributor:    g('parent distributor', 'distributor name', 'distributor'),
          target_install_date:   g('install date', 'target install', 'installation date'),
          graphics_package:      g('graphics package', 'graphics'),
          emergency_install:     g('emergency'),
          coffee_program:        g('coffee program', 'program'),
          chain_store:           g('chain store', 'chain'),
          customer_account:      g('account number', 'customer account', 'account'),
          sub_group:             g('sub group', 'subgroup'),
          notes:                 g('notes', 'additional', 'comments'),
          is_new_customer:       newCust.toLowerCase().includes('yes') || newCust.toLowerCase().includes('new'),
          jotform_answers:       answers,
          updated_at:            new Date().toISOString(),
        };

        const existing = existingMap[subId];

        if (existing) {
          // Update contact/form data only — never overwrite pipeline position
          await fetch(`${SB_URL}/rest/v1/deals?id=eq.${existing.id}`, {
            method: 'PATCH',
            headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(fields)
          });
          updated++;
        } else {
          // New submission — use upsert with ON CONFLICT DO NOTHING as safety net
          const insertRes = await fetch(`${SB_URL}/rest/v1/deals`, {
            method: 'POST',
            headers: {
              apikey: SB_KEY,
              Authorization: `Bearer ${SB_KEY}`,
              'Content-Type': 'application/json',
              Prefer: 'return=representation,resolution=ignore-duplicates'
            },
            body: JSON.stringify({
              ...fields,
              current_step: 'submitted',
              phase: 'leasing',
              deal_status: 'active',
            })
          });

          if (insertRes.ok) {
            const inserted = await insertRes.json();
            const dealId = inserted[0]?.id;
            if (dealId) {
              // Add to our local map so subsequent pages don't re-insert
              existingMap[subId] = { id: dealId, current_step: 'submitted', phase: 'leasing', deal_status: 'active' };
              // Log activity
              await fetch(`${SB_URL}/rest/v1/deal_activity`, {
                method: 'POST',
                headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  deal_id: dealId,
                  action: 'Deal created',
                  detail: 'Imported via Jotform sync',
                  actor: fields.sales_rep || 'Sync'
                })
              });
              added++;
            }
          }
        }
      }

      offset += submissions.length;
      if (submissions.length < limit) hasMore = false;
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: true, added, updated, total: added + updated })
    };

  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
