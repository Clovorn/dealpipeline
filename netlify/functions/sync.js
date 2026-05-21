const SB_URL = 'https://hvmlmequwjxvrmgpltec.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const FORM_IDS = ['260154983685872', '253445565512862'];

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
        // Name fields: {first, last}
        if (ans.first !== undefined || ans.last !== undefined) {
          return [ans.first, ans.middle, ans.last].filter(Boolean).join(' ').trim();
        }
        // Address fields: {addr_line1, city, state, postal}
        if (ans.addr_line1 !== undefined || ans.city !== undefined) {
          return [ans.addr_line1, ans.addr_line2, ans.city, ans.state, ans.postal]
            .filter(Boolean).join(', ').trim();
        }
        // Payment/product answer — extract prettyFormat or product array
        if (ans.paymentArray) {
          try {
            const pa = JSON.parse(ans.paymentArray);
            return JSON.stringify(pa);
          } catch(e) { return ans.paymentArray; }
        }
        if (Array.isArray(ans)) return ans.filter(Boolean).join(', ').trim();
        // Datetime fields: {year, month, day}
        if (ans.year && ans.month && ans.day) {
          return `${ans.month}/${ans.day}/${ans.year}`;
        }
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

// Extract equipment from Jotform product widget (handles both form structures)
function getEquipment(answers) {
  for (const [, v] of Object.entries(answers)) {
    if (!v || !v.text) continue;
    const label = v.text.toLowerCase();
    if (['please select equipment', 'select equipment', 'equipment needed', 'my products'].some(k => label.includes(k))) {
      const ans = v.answer;
      if (!ans) return '';
      // paymentArray contains the product summary JSON string
      if (typeof ans === 'object' && ans.paymentArray) {
        return ans.paymentArray;
      }
      if (typeof ans === 'string') return ans;
    }
  }
  return '';
}

// Map Jotform submission answers to deal fields
// Handles both Deal Sheet (260154983685872) and Distributor Lead (253445565512862)
function mapSubmission(sub) {
  const answers = sub.answers || {};

  // Contact name — try direct first/last fields first (Distributor form),
  // then fall back to full Contact Name field (Deal Sheet form)
  const firstName = getField(answers, 'first name');
  const lastName  = getField(answers, 'last name');
  const contactName = getField(answers, 'contact name');
  let first, last;
  if (firstName) {
    first = firstName;
    last  = lastName;
  } else {
    const parsed = parseName(contactName);
    first = parsed.first;
    last  = parsed.last;
  }

  // Sales rep — Distributor form uses "Ronnoco Sales Rep Assigned", Deal Sheet uses "Ronnoco Sales Rep"
  const salesRep = getField(answers, 'ronnoco sales rep assigned', 'ronnoco sales rep') || '';
  const salesRepEmail = getField(answers, 'ronnoco sales rep email');

  // Equipment — Distributor form uses "My Products", Deal Sheet uses "Select Equipment Needed"
  const equipment = getField(answers, 'my products', 'select equipment', 'equipment needed', 'please select equipment');

  // Deal type — Distributor form uses "Parts & Service Option", Deal Sheet uses "Pick which is applicable"
  const dealType = getField(answers, 'parts & service option', 'pick which is applicable', 'deal type');

  // ROM email — Distributor form has its own ROM Email field
  const romEmail = getField(answers, 'rom email');

  // Unique ID (Distributor form only)
  const uniqueId = getField(answers, 'unique id');

  // Address — combine street + city + state + zip if separate fields exist
  let address = getField(answers, 'street address');
  const city  = getField(answers, 'city');
  const state = getField(answers, 'state');
  const zip   = getField(answers, 'zip code', 'zip');
  if (city || state) {
    address = [address, city, state, zip].filter(Boolean).join(', ');
  }

  const deal = {
    jotform_submission_id: String(sub.id),
    first_name:            first,
    last_name:             last,
    email:                 getField(answers, 'contacts email', 'contact email', 'email'),
    phone:                 getField(answers, 'contact cell', 'cell phone', 'store phone'),
    store_name:            getField(answers, 'store name', 'store name (doing business as)', 'doing business as'),
    legal_business_name:   getField(answers, 'legal business name'),
    address,
    store_phone:           getField(answers, 'store phone'),
    customer_account:      getField(answers, 'customer account', 'account#', 'unique id'),
    chain_store:           getField(answers, 'chain store', 'multiple locations') || 'No',
    sales_rep:             salesRep,
    sales_rep_email:       salesRepEmail,
    rom:                   getField(answers, 'select the rom', 'rom'),
    rom_email:             romEmail,
    coffee_program:        getField(answers, 'which program', 'coffee program'),
    deal_type:             dealType,
    equipment_selection:   equipment,
    total_eq_cost:         getField(answers, 'total eq cost', 'total amount'),
    target_install_date:   getField(answers, 'target install date', 'install date'),
    need_by_date:          getField(answers, 'need by date'),
    emergency_install:     getField(answers, 'emergency install') || 'No',
    parent_distributor:    getField(answers, 'parent distributor', 'distributor name', 'distributor'),
    sub_group:             getField(answers, 'sub group', 'subgroup', 'customer type'),
    distributor_rep_email: getField(answers, 'distributor rep email', 'dist rep email'),
    graphics_package:      getField(answers, 'pick a graphics package', 'graphics package'),
    notes:                 getField(answers, 'additional note', 'equipment & service notes', 'notes'),
    is_new_customer:       getField(answers, 'current ronnoco customer').toLowerCase().includes('no'),
    jotform_answers:       answers,
    updated_at:            new Date().toISOString(),
  };

  return deal;
}

// Junk/test patterns — store names that look like test data
const JUNK_PATTERNS = [
  /^test/i, /^fda/, /^asdf/, /^qwer/, /^1234/,
  /^greg$/i, /^bobs?$/i, /^joes?\s/i, /^kens?$/i,
  /^bubbas?$/i, /^sparkys?$/i, /^dks?$/i, /^gp\s/i,
  /^bills?$/i, /^market$/i, /first\s*stop$/i, /this is great/i,
  /chuck.*store/i, /chuck.*great/i, /chucks great/i,
  /dueling organ/i, /^mish\s/i, /stucky.*doolittle/i,
  /abc\s*stor/i, /^shoprite$/i, /^steven urban$/i,
];

function isJunkName(name) {
  return JUNK_PATTERNS.some(p => p.test(name));
}

// A submission is valid if it has a real store name, contact name and sales rep
function isValidSubmission(sub) {
  const answers = sub.answers || {};
  const contactName = getField(answers, 'contact name');
  const firstName   = getField(answers, 'first name');
  const storeName   = getField(answers, 'store name', 'doing business as');
  const salesRep    = getField(answers, 'ronnoco sales rep assigned', 'ronnoco sales rep');

  console.log(`[isValid] id=${sub.id} store="${storeName}" contact="${contactName}" first="${firstName}" rep="${salesRep}"`);

  // Must have a store name
  if (!storeName) { console.log('[isValid] SKIP no store'); return false; }

  // Must have at least one identifier
  if (!contactName && !firstName && !salesRep) { console.log('[isValid] SKIP no contact/rep'); return false; }

  // Reject junk names
  if (isJunkName(storeName)) { console.log(`[isValid] SKIP junk: ${storeName}`); return false; }

  console.log(`[isValid] PASS: ${storeName}`);
  return true;
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

    let added = 0, updated = 0, skipped = 0;
    const limit = 100;

    for (const FORM_ID of FORM_IDS) {
    let offset = 0;
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

        // Also check by store name + first name as fallback for records with CSV-based IDs
        let matchedByName = null;
        if (!existing) {
          const nameCheck = await fetch(
            `${SB_URL}/rest/v1/deals?store_name=eq.${encodeURIComponent(fields.store_name)}&first_name=eq.${encodeURIComponent(fields.first_name)}&select=id,jotform_submission_id`,
            { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
          );
          const nameMatches = await nameCheck.json();
          if (nameMatches && nameMatches.length > 0) {
            matchedByName = nameMatches[0];
          }
        }

        if (existing || matchedByName) {
          const matchId = existing ? existing.id : matchedByName.id;
          // If matched by name, update the submission ID to the real Jotform ID
          const updateFields = { ...fields };
          if (matchedByName && (!matchedByName.jotform_submission_id || matchedByName.jotform_submission_id.startsWith('csv-'))) {
            updateFields.jotform_submission_id = subId;
            // Add to existingMap so we don't process again
            existingMap[subId] = { id: matchId };
          }
          // Update form data only — never overwrite pipeline position
          await fetch(`${SB_URL}/rest/v1/deals?id=eq.${matchId}`, {
            method: 'PATCH',
            headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(updateFields)
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
    } // end for each form

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: true, added, updated, skipped, total: added + updated })
    };

  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
