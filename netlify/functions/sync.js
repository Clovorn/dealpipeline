const SB_URL = 'https://hvmlmequwjxvrmgpltec.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const FORM_ID = '260154983685872';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  'Content-Type': 'application/json'
};

// Extract answer value from Jotform answers object by matching question text keywords
function getField(answers, ...keys) {
  for (const [, v] of Object.entries(answers)) {
    if (!v || !v.text) continue;
    const label = v.text.toLowerCase();
    if (keys.some(k => label.includes(k.toLowerCase()))) {
      const ans = v.answer;
      if (!ans) return '';
      if (typeof ans === 'string') return ans.trim();
      if (typeof ans === 'object') {
        // Name fields: {first, last} or {first, middle, last}
        if (ans.first !== undefined || ans.last !== undefined) {
          return [ans.first, ans.middle, ans.last].filter(Boolean).join(' ').trim();
        }
        if (Array.isArray(ans)) return ans.filter(Boolean).join(', ').trim();
        return Object.values(ans).filter(Boolean).join(' ').trim();
      }
    }
  }
  return '';
}

// Parse a full "First Last" contact name into parts
function parseName(fullName) {
  if (!fullName) return { first: 'Unknown', last: '' };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

// Map Jotform submission answers to deal fields
function mapSubmission(sub) {
  const answers = sub.answers || {};

  // Contact name — Jotform stores as "Contact Name" full text field
  const contactName = getField(answers, 'contact name');
  const { first, last } = parseName(contactName);

  // Sales rep — stored as "Ronnoco Sales Rep" with first/last subfields
  const salesRepFirst = getField(answers, 'ronnoco sales rep');
  const salesRep = salesRepFirst || '';

  const deal = {
    jotform_submission_id: String(sub.id),
    first_name:            first,
    last_name:             last,
    email:                 getField(answers, 'contacts email', 'contact email', 'email'),
    phone:                 getField(answers, 'contact cell', 'cell phone', 'store phone'),
    store_name:            getField(answers, 'store name'),
    legal_business_name:   getField(answers, 'legal business name'),
    address:               getField(answers, 'street address'),
    store_phone:           getField(answers, 'store phone'),
    customer_account:      getField(answers, 'customer account', 'account#'),
    chain_store:           getField(answers, 'chain store') || 'No',
    sales_rep:             salesRep,
    sales_rep_email:       getField(answers, 'ronnoco sales rep email', 'sales rep email'),
    rom:                   getField(answers, 'select the rom', 'rom'),
    coffee_program:        getField(answers, 'coffee program'),
    deal_type:             getField(answers, 'pick which is applicable', 'deal type', 'type'),
    equipment_selection:   getField(answers, 'select equipment', 'equipment needed'),
    total_eq_cost:         getField(answers, 'total eq cost', 'total amount'),
    target_install_date:   getField(answers, 'target install date', 'install date'),
    emergency_install:     getField(answers, 'emergency install') || 'No',
    parent_distributor:    getField(answers, 'parent distributor', 'distributor name'),
    sub_group:             getField(answers, 'sub group', 'subgroup'),
    distributor_rep_email: getField(answers, 'distributor rep email', 'dist rep email'),
    graphics_package:      getField(answers, 'pick a graphics package', 'graphics package'),
    notes:                 getField(answers, 'additional note', 'equipment & service notes', 'notes'),
    is_new_customer:       getField(answers, 'current ronnoco customer').toLowerCase().includes('no'),
    jotform_answers:       answers,
    updated_at:            new Date().toISOString(),
  };

  return deal;
}

// A submission is valid if it has at minimum a store name or a contact name
function isValidSubmission(sub) {
  const answers = sub.answers || {};
  const contactName = getField(answers, 'contact name');
  const storeName = getField(answers, 'store name');
  const salesRep = getField(answers, 'ronnoco sales rep');
  // Must have at least a store name AND either a contact name or sales rep
  return storeName.length > 0 && (contactName.length > 0 || salesRep.length > 0);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };

  const apiKey = event.headers['x-api-key'] || (event.body ? JSON.parse(event.body).apiKey : null);
  if (!apiKey) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing Jotform API key' }) };
  if (!SB_KEY) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'SUPABASE_SERVICE_KEY not configured' }) };

  try {
    // Load all existing submission IDs into memory first
    const existingRes = await fetch(`${SB_URL}/rest/v1/deals?select=id,jotform_submission_id,current_step,phase,deal_status&limit=10000`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
    });
    const existingDeals = await existingRes.json();
    const existingMap = {};
    for (const d of (existingDeals || [])) {
      if (d.jotform_submission_id) existingMap[d.jotform_submission_id] = d;
    }

    // Load blocklist — these submission IDs are permanently skipped
    const blocklistRes = await fetch(`${SB_URL}/rest/v1/jotform_blocklist?select=jotform_submission_id`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
    });
    const blocklistData = await blocklistRes.json();
    const blocklist = new Set((blocklistData || []).map(b => b.jotform_submission_id));

    let offset = 0;
    const limit = 100;
    let added = 0, updated = 0, skipped = 0;
    let hasMore = true;

    while (hasMore) {
      const url = `https://ronnoco.jotform.com/API/form/${FORM_ID}/submissions?apiKey=${apiKey}&limit=${limit}&offset=${offset}&orderby=created_at,DESC`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.responseCode !== 200) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: data.message || 'Jotform API error', code: data.responseCode }) };
      }

      const submissions = data.content || [];
      if (submissions.length === 0) { hasMore = false; break; }

      for (const sub of submissions) {
        const subId = String(sub.id);

        // Skip blocklisted submissions permanently
        if (blocklist.has(subId)) {
          skipped++;
          continue;
        }

        // Skip invalid/incomplete submissions (test entries, blanks)
        if (!isValidSubmission(sub)) {
          skipped++;
          continue;
        }

        const fields = mapSubmission(sub);
        const existing = existingMap[subId];

        if (existing) {
          // Update form data only — never overwrite pipeline position
          await fetch(`${SB_URL}/rest/v1/deals?id=eq.${existing.id}`, {
            method: 'PATCH',
            headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(fields)
          });
          updated++;
        } else {
          // New deal — insert at submitted
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
              existingMap[subId] = { id: dealId };
              await fetch(`${SB_URL}/rest/v1/deal_activity`, {
                method: 'POST',
                headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ deal_id: dealId, action: 'Deal created', detail: 'Imported via Jotform sync', actor: fields.sales_rep || 'Sync' })
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
      body: JSON.stringify({ ok: true, added, updated, skipped, total: added + updated })
    };

  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
