# Pipeline Dashboard v31 — Director Approval Pipeline (Patch Notes)

**Date shipped:** May 23–24, 2026
**Baseline:** dealpipeline-main v8.0 (the build with the Sales/Quotes tab + Open Quotes metric)
**Files changed:** `index.html` only — 2,741 → 2,879 lines (+138, purely additive)
**Files untouched:** `dealsheet.html`, `netlify/functions/*`, `netlify.toml`
**No DB migrations in this patch.** The migration that introduced `phase=pending_director`, the 6 `director_*` deal columns, and the widened `phase`/`deal_status` CHECKs was shipped to the pipeline Supabase project (`hvmlmequwjxvrmgpltec`) in v31 Session 1.

---

## What this patch does

When a Purchase or Loan customer-decision is recorded in this dashboard, the deal no longer jumps straight to `phase=ops` — it now lands in `phase=pending_director, step=awaiting_review` so the rep's director can approve/reject it from the Deal Builder app's My Team queue. This dashboard surfaces those pending-approval deals in a new tab so the broader team can see what's queued, but the dashboard is **read-only** for director decisions — directors drive approve/reject from Deal Builder.

The catalog/Deal Builder app already handles the director-side workflow (My Team queue, approve/reject UI, "load rejected deal as draft" hydration). This dashboard patch just makes the in-flight pending_director deals visible alongside everything else.

---

## The 12 edits (top-down through `index.html`)

### 1. Constants — `PENDING_DIRECTOR_STEPS` and `PENDING_DIRECTOR_LABELS`
Added two new constants and merged them into `ALL_LABELS`:
- `PENDING_DIRECTOR_STEPS = ['awaiting_review']`
- `PENDING_DIRECTOR_LABELS = {awaiting_review:'Awaiting Director'}`

### 2. New "Director Review" tab
Inserted between **Sales / Quotes** and **In Financing** in the role-tab bar (`data-view="pending_director"`).

### 3. New "Awaiting Director" metric tile
Inserted between **Open Quotes** and **Total Active** in the metrics row. Amber color tokens (reuses existing `--amber-600` / `metric-val.amber` / `metric-sub.amber`). DOM IDs: `mPendingDirector` / `mPendingDirectorVal`.

### 4. CSS additions (all additive — no existing rules altered)
- `.dc-badge.pending_director` — amber card badge
- `.director-meta` + `.dir-dot` — small amber meta row under the card
- `.detail-header.phase-pending_director` — amber detail-header background (`#7a4a0a`, same warm brown as `phase-funded`)
- `.dh-badge.phase-pending_director` — amber badge variant for the detail header
- `.dh-badge.director-approved` / `.director-rejected` / `.director-pending` / `.director-retry` — colored decision pills in the detail-header badges row
- `.director-context` block (and its `.pending` / `.rejected` / `.approved` variants) — the prominent callout that sits between detail-header and info-grid. Includes `.dctx-icon`, `.dctx-title`, `.dctx-line`, `.dctx-note`, `.dctx-meta`, `.dctx-hint`.

### 5. `submitCustomerDecision` — Purchase/Loan routing
Changed:
```js
} else if (decision === 'purchase' || decision === 'loan') {
  nextPhase = 'ops';
  nextStep = 'customer_setup';
```
to:
```js
} else if (decision === 'purchase' || decision === 'loan') {
  // Purchase/Loan deals require director approval before entering Ops
  nextPhase = 'pending_director';
  nextStep = 'awaiting_review';
```
This is the only behavioral change in the decision flow. Lease/Finance still route to `phase=leasing, step=submitted`, declined still closes, everything else unchanged. The `deal_revisions` audit row already records the phase/step transition correctly because the diff is computed from `oldPhase`/`oldStep` after the patch is built.

### 6. After-decision auto-tab-switch — three-way
Was:
```js
currentView = nextPhase === 'ops' ? 'ops' : 'leasing';
```
Now:
```js
currentView = nextPhase === 'pending_director' ? 'pending_director' :
              nextPhase === 'ops' ? 'ops' : 'leasing';
```
So a rep who records "Purchase" or "Loan" gets dropped into the Director Review tab next to the just-submitted deal.

### 7. `getFilteredDeals` — new branch + leasing exclusion
Added a `pending_director` view branch. Also added an explicit `if (d.phase === 'pending_director') return false;` to the leasing branch so pending_director deals don't bleed into "In Financing" (they have no current_step matching `LEASING_STEPS` so they shouldn't anyway, but belt-and-suspenders).

### 8. `updateMetrics` — Awaiting Director tile
Computes `pendingDirector = active.filter(d => d.phase === 'pending_director')` and writes count + `fmtCurrency(sumCost(...))` to `mPendingDirector` / `mPendingDirectorVal`.

### 9. `viewLabels` includes `pending_director: 'Director Review'`
For the deal-list panel header.

### 10. Card renderer — pending_director awareness
- New `isPendingDirector` flag.
- Badge class: `pending_director` (uses the new amber `.dc-badge` rule).
- Badge label is state-aware: `"Awaiting Director"` / `"Approved — moving to ops"` / `"Rejected — needs revise"` based on `director_decision`.
- New `directorMeta` line renders under the existing `dc-meta` row for pending_director deals only: shows `deal_type`, `rep_director_email` (with red "⚠ no director assigned" fallback), and `retry N` if `director_retry_count > 0`.

### 11. Detail-header — phase awareness + decision pills + suppressed pipeline-track + suppressed advance buttons
- New `isPendingDirector` flag at the top of `renderDetail`.
- New locals: `directorDecision`, `directorDecisionNotes`, `directorDecidedBy`, `directorDecidedAt`, `directorRetryCount`, `repDirectorEmail`.
- `isLeasing` now requires `!isPendingDirector` — prevents pending_director deals from being treated as leasing just because their `step='awaiting_review'` isn't in `OPS_STEPS`.
- `canAdvance` and `canGoBack` both gated to `!isPendingDirector` — Advance/Previous buttons disappear from this dashboard for pending_director deals (directors approve/reject in Deal Builder, not here).
- Phase-label expression in the badges row updated to handle three cases: sales / pending_director / leasing|ops.
- New decision pills added to the badges row when `isPendingDirector`: ✓ Approved / ✕ Rejected / ⏱ Awaiting decision / `retry N`.
- Pipeline-track block now suppressed when `deal.phase === 'sales' || isPendingDirector` (was just sales).

### 12. Director-context callout
The big one. Conditional block injected after the (now suppressed) pipeline-track section, gated to `isPendingDirector`, with three visual states:

- **Pending** (no decision yet) — amber surround, ⏱ icon, "Awaiting director review" headline, explanatory line about where the director acts (Deal Builder → My Team), meta row with submitted-at + `rep_director_email` + retry count. If `rep_director_email` is null, shows red "⚠ No director assigned to rep".
- **Rejected** — red surround, ✕ icon, "Director rejected — rep needs to revise and resubmit" headline, prominent `director_decision_notes` quote box, meta row with rejected-by + decided-at + rep's director + retry count. Falls back to "No rejection note was left." if the notes field is empty.
- **Approved** — green surround, ✓ icon, brief "Director approved — moving to Operations" message with decided-by and decided-at. Approved deals will auto-advance to ops on next refresh (handled by Deal Builder's approval action), so this state is mostly transitional.

---

## Sanity checks performed

- **JS parses cleanly** — extracted the main `<script>` block (~109k chars / 2,282 lines) and ran it through `new Function()`; no syntax errors.
- **DOM tag balance** — `div`, `span`, `script`, `style`, `button` all match baseline open/close ratios exactly. (The +2 div delta visible in raw grep counts is pre-existing template-literal noise in JS, unchanged by this patch.)
- **Card-badge logic smoke test** — ran every state (sales / pending-awaiting / pending-rejected / pending-approved / ops-complete) through the new card-renderer logic in Node; all produce correct badge classes and labels.

---

## Known caveats carried over (not fixed in this patch)

- **Pipeline Supabase RLS is still permissive** (carried over from the v23 observation). The `deals`, `deal_revisions`, and `quote_number_counters` tables all have anon read/insert/update/delete policies returning `true`. Anyone with the bundle's anon key can query the pipeline DB directly. Quote tokens are 192-bit random and practically unguessable, so they're effective obfuscation but not a true security boundary. Tighten in a future session — restrict anon read on `deals` to `is_quote=true AND token-match` via a Postgres function, and lock down `deal_revisions` to authenticated roles.
- **Pre-v31 deals have `null` `rep_director_email`** (intentional — no backfill). Old Purchase/Loan deals that were submitted before this rollout won't show a director in the Director Review tab. They were already in `phase=ops` by the time this patch ships, so they're not affected by the new routing — but if any future event nudges them back to pending_director, the callout will show the "⚠ No director assigned" warning. Acceptable for now.
- **No edit-from-dashboard for pending_director deals.** The dashboard intentionally hides Advance/Previous buttons in this phase. Directors approve/reject from Deal Builder; reps revise rejected deals from Deal Builder ("load rejected deal as draft" hydration). The dashboard is read-only for this phase.

---

## Deploy steps

1. Replace `index.html` at the repo root of `github.com/Clovorn/ronnoco-deal-dashboard` with the patched file in this ZIP.
2. Commit and push to `main`.
3. Netlify auto-deploys to `ronnoco-deal-dashboard.netlify.app` in ~2 minutes.
4. No env-var changes. No DB migration in this patch (the v31 migration was applied in Session 1).
5. Hard-refresh the dashboard tab after deploy to clear cached HTML.

## Quick smoke test after deploy

1. Open the dashboard. Confirm the **Director Review** tab is visible between Sales/Quotes and In Financing.
2. Confirm the **Awaiting Director** metric tile renders amber and shows a count (likely 0 if no pending deals exist yet).
3. Open any active Lease/Finance deal — confirm Advance/Previous still work and the detail header still shows the leasing pipeline-track.
4. Find a quote deal and record a `Purchase` decision through the Customer Decision modal. Confirm:
   - The deal lands in the new Director Review tab (auto-switch).
   - The amber **director-context** callout appears with "Awaiting director review".
   - The card shows the rep's director email (if set on the user profile) and the deal_type.
   - Advance/Previous buttons are not shown on the detail header.
5. From Deal Builder, have the director reject that deal with a note. Refresh the dashboard and confirm the callout switches to the red "Rejected — needs revise" state with the note quoted.
