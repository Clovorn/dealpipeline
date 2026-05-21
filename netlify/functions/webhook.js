const SB_URL = 'https://hvmlmequwjxvrmgpltec.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';

function getField(answers, ...keys) {
  for (const [, v] of Object.entries(answers)) {
    if (!v || !v.text) continue;
    const label = v.text.toLowerCase();
    if (keys.some(k => label.includes(k.toLowerCase()))) {
      const ans = v.answer;
      if (!ans) return '';
      if (typeof ans === 'string') return ans.trim();
      if (typeof ans === 'object') {
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

function parseName(fullName) {
  if (!fullName) return { first: 'Unknown', last: '' };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  try {
    const params = new URLSearchParams(event.body);
    const rawRequest = params.get('rawRequest');
    const subId = params.get('submissionID');

    if (!rawRequest || !subId) return { statusCode: 400, body: 'Missing data' };

    const answers = JSON.parse(rawRequest);

    // Validate — must have store name and contact name
    const storeName = getField(answers, 'store name');
    const contactName = getField(answers, 'contact name');
    const salesRep = getField(answers, 'ronnoco sales rep');

    if (!storeName || (!contactName && !salesRep)) {
      console.log('Skipping invalid submission:', subId);
      return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: true }) };
    }

    const { first, last } = parseName(contactName);

    // Handle both form structures
    const firstName = getField(answers, 'first name');
    const lastName  = getField(answers, 'last name');
    let first2, last2;
    if (firstName) { first2 = firstName; last2 = lastName; }
    else { const p = parseName(contactName); first2 = p.first; last2 = p.last; }

    let address = getField(answers, 'street address');
    const city  = getField(answers, 'city');
    const state = getField(answers, 'state');
    const zip   = getField(answers, 'zip code', 'zip');
    if (city || state) address = [address, city, state, zip].filter(Boolean).join(', ');

    const deal = {
      jotform_submission_id: String(subId),
      first_name:            first2,
      last_name:             last2,
      email:                 getField(answers, 'contacts email', 'contact email', 'email'),
      phone:                 getField(answers, 'contact cell', 'cell phone', 'store phone'),
      store_name:            getField(answers, 'store name', 'store name (doing business as)', 'doing business as') || storeName,
      legal_business_name:   getField(answers, 'legal business name'),
      address,
      store_phone:           getField(answers, 'store phone'),
      customer_account:      getField(answers, 'customer account', 'account#', 'unique id'),
      chain_store:           getField(answers, 'chain store', 'multiple locations') || 'No',
      sales_rep:             getField(answers, 'ronnoco sales rep assigned', 'ronnoco sales rep') || salesRep,
      sales_rep_email:       getField(answers, 'ronnoco sales rep email'),
      rom:                   getField(answers, 'select the rom', 'rom'),
      rom_email:             getField(answers, 'rom email'),
      coffee_program:        getField(answers, 'which program', 'coffee program'),
      deal_type:             getField(answers, 'parts & service option', 'pick which is applicable', 'deal type'),
      equipment_selection:   getField(answers, 'please select equipment', 'select equipment', 'equipment needed'),
      total_eq_cost:         getField(answers, 'total eq cost', 'total amount'),
      target_install_date:   getField(answers, 'target install date', 'install date', 'need by date'),
      emergency_install:     getField(answers, 'emergency install') || 'No',
      parent_distributor:    getField(answers, 'parent distributor', 'distributor name', 'distributor'),
      sub_group:             getField(answers, 'sub group', 'subgroup', 'customer type'),
      distributor_rep_email: getField(answers, 'distributor rep email', 'dist rep email'),
      graphics_package:      getField(answers, 'pick a graphics package', 'graphics package'),
      notes:                 getField(answers, 'additional note', 'equipment & service notes', 'notes'),
      is_new_customer:       getField(answers, 'current ronnoco customer').toLowerCase().includes('no'),
      jotform_answers:       answers,
      current_step:          'submitted',
      phase:                 'leasing',
      deal_status:           'active',
    };

    // Check for existing submission
    const checkRes = await fetch(`${SB_URL}/rest/v1/deals?jotform_submission_id=eq.${subId}&select=id`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
    });
    const existing = await checkRes.json();

    let dealId;
    if (existing && existing.length > 0) {
      dealId = existing[0].id;
      await fetch(`${SB_URL}/rest/v1/deals?id=eq.${dealId}`, {
        method: 'PATCH',
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...deal, updated_at: new Date().toISOString() })
      });
    } else {
      const ins = await fetch(`${SB_URL}/rest/v1/deals`, {
        method: 'POST',
        headers: {
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation,resolution=ignore-duplicates'
        },
        body: JSON.stringify(deal)
      });
      const inserted = await ins.json();
      dealId = inserted[0]?.id;
    }

    if (dealId) {
      await fetch(`${SB_URL}/rest/v1/deal_activity`, {
        method: 'POST',
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal_id: dealId, action: 'Deal created', detail: 'Submitted via Jotform webhook', actor: salesRep || 'Jotform' })
      });
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, dealId }) };
  } catch (err) {
    console.error('Webhook error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
