# Deal Pipeline Dashboard

A real-time deal pipeline dashboard for managing leasing and operations workflows, built with vanilla HTML/JS and Supabase.

## Features

- **13-step workflow** across two phases: Leasing (7 steps) and Operations (7 steps)
- **4 roles**: Admin, Sales (read-only), Leasing, Operations
- **Real-time sync** via Supabase — all users see changes instantly
- **Email drafting** at every step with pre-written, editable templates
- **Jotform integration** — sync form submissions directly into the pipeline
- **Activity log** per deal — every action is timestamped and stored

## Stack

- Frontend: Vanilla HTML, CSS, JavaScript (single file, no build step)
- Backend: [Supabase](https://supabase.com) (Postgres + Realtime)
- Hosting: [Netlify](https://netlify.com)

## Deployment

This project is a single `index.html` file — no build step required.

1. Fork or clone this repo
2. Connect to Netlify (New site → Import from GitHub → select this repo)
3. Netlify publish directory: `/` (root)
4. No build command needed
5. Deploy!

## Supabase Schema

Three tables are used:

| Table | Purpose |
|---|---|
| `deals` | One row per customer deal, tracks current pipeline step |
| `activity_log` | Every step advance and action, timestamped |
| `email_log` | Every email drafted from the dashboard |

## Environment

Supabase URL and anon key are baked into `index.html`. To use your own Supabase project, replace the `SB_URL` and `SB_KEY` constants at the top of the `<script>` block in `index.html`.

## Workflow Steps

### Leasing Phase
1. Submitted
2. Credit App Sent
3. Credit App Received
4. Credit Approved
5. Paperwork Sent
6. Paperwork Received
7. Funded ✓

### Operations Phase
8. Customer Setup
9. Equipment Ordered
10. Equipment Received
11. Installation Scheduled
12. Distributor Notified
13. Installation
14. Complete ✓
