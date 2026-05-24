# Dashboard v8.1 — "Send note to rep" (Companion patch to Deal Builder v32)

**Date:** May 24, 2026
**Companion to:** Deal Builder v32 ("Rep Visibility + Notifications + PWA")

## What changed

Single small addition to `index.html`. The Notes section of every deal
detail panel now has two buttons instead of one:

- **📣 Notify rep** — *new in v8.1.* Takes whatever's in the note textarea
  and sends it to the rep as an in-app notification (kind=`note`). Also
  records the note in `deal_notes` with a `[Sent to rep]` prefix so the
  dashboard audit trail captures it.
- **Add note** — unchanged. Records the note in `deal_notes` only.
  Doesn't notify the rep.

This is the manual ad-hoc channel for ops-to-rep communication. Automatic
notifications (decisions, phase changes, status changes, customer
decisions) fire from a Postgres trigger on the pipeline DB
(`notify_rep_on_deal_change`) and don't need any dashboard involvement.

The Notify button is automatically disabled on legacy Jotform deals
that have no `sales_rep_email` populated — there's no one to notify.

## What's NOT in this patch

- No tab additions, metric tiles, or filter changes.
- No DB migrations — `notifications` table was created by the Deal
  Builder v32 release.
- No changes to email sending. Email opt-out is honored on the
  email-sending side (per-rep flag in `team_members.email_notifications_enabled`,
  added by Deal Builder v32). The in-app notification path doesn't
  involve email at all.

## Deploying

1. Replace `index.html` at the repo root of `Clovorn/dealpipeline`.
2. Commit + push to `main`. Netlify auto-deploys in ~2 minutes (no
   build step — it just serves the HTML).
3. No DB changes, no env-var changes.

## State-of-union corrections noted while pulling this repo

- The state-of-union doc lists the dashboard repo as
  `Clovorn/ronnoco-deal-dashboard`. The actual repo name is
  `Clovorn/dealpipeline`. (The `ronnoco-deal-dashboard` Netlify site
  URL is correct.) Worth updating the master doc.
- The state-of-union says the v31 patch is "still pending push to repo."
  It's already on `main` as v8.0. Open item #2 was already resolved at
  some point between the doc being written and this session.

## Verification after deploy

1. Open any deal in the dashboard.
2. The Notes section should show two buttons: "📣 Notify rep" and "Add note".
3. Click Notify rep with text in the textarea → toast confirms the email
   it was sent to.
4. Sign in to the Deal Builder as that rep → bell shows badge → click →
   the note is in the dropdown with the kind=note styling (amber speech
   bubble icon).
5. Back on the dashboard, the same note appears in the Notes list with
   a `[Sent to rep]` prefix and in the Activity log as "Notified rep".
