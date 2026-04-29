# Deal Pipeline Dashboard

Real-time deal pipeline for leasing and operations workflows.

## Stack
- Frontend: Vanilla HTML/CSS/JS (single file, no build step)
- Backend: Supabase (Postgres + Realtime)
- API Proxy: Netlify Functions (fixes Jotform CORS)
- Hosting: Netlify

## Setup
1. Deploy to Netlify connected to this GitHub repo
2. Open the live site → click **⚙ Settings** in the top right
3. Default password: `pipeline2024` (change it after first login)
4. Paste your Jotform API key → Test & save → Select form → Sync

## File Structure
```
/
├── index.html              # Full dashboard (single file)
├── netlify.toml            # Netlify build + functions config
├── netlify/
│   └── functions/
│       └── jotform.js      # Serverless proxy for Jotform API
└── README.md
```

## Roles
| Role | Access |
|---|---|
| Admin | Full access — all deals, all steps |
| Sales | Read-only — track status only |
| Leasing | Leasing phase deals only |
| Operations | Ops phase deals only |

## Default Settings Password
`pipeline2024` — change this in Settings after first login.
