# BUhostels

Hostel finder for Busitema University students. Visitors browse, search, sort and filter hostels, then contact owners on WhatsApp or by phone. Owners manage their own listings. The admin sees everything happening on the site.

```
HOSTEL_SURF/
├── backend/    Express API + Supabase (auth, database, photo storage)
│   ├── sql/schema.sql        run once in Supabase
│   ├── scripts/create-admin.js
│   └── server.js             also serves ../frontend
└── frontend/   Plain HTML/CSS/JS (no build step)
```

## Run it locally (Windows, macOS, Linux)

1. Install [Node.js](https://nodejs.org/en/download) 18 or newer.
2. Create a free project at [supabase.com](https://supabase.com/dashboard).
3. In Supabase open **SQL Editor → New query**, paste all of `backend/sql/schema.sql`, press **Run**. This creates the tables, reports and the public `hostel-images` photo bucket.
4. In Supabase open **Project Settings → API** and copy the Project URL, the `anon` key and the `service_role` key.
5. In `backend/`, copy `.env.example` to `.env` and paste those three values in.
6. In a terminal inside `backend/`:

```bash
npm install
npm run create-admin -- you@example.com "a-strong-password" "Your Name"
npm start
```

7. Open http://localhost:4000. Sign in at `/login.html` with the admin email and you land on the admin dashboard.

**Recommended in Supabase:** Authentication → Sign In / Providers → turn **off** "Allow new users to sign up". All accounts are created by the backend, so this just closes the side door.

## Roles

| Role | How they get in | What they can do |
| --- | --- | --- |
| Visitor | nothing needed | browse, search, filter, sort, view photos and prices, WhatsApp / call owners |
| Owner | signs up at `/login.html#register` (asked first whether they own a hostel; "No" sends them back to browse), gives business name, campus, area and logo, then **admin approves** | add and edit their hostels, rooms and prices, photos; see their own views and contact taps |
| Admin | `npm run create-admin` | live activity feed, traffic charts, top hostels and searches, approve / suspend / delete owners, reset passwords, hide / feature / delete any hostel |

Until an owner is approved they can sign in and look around but cannot post. The admin can also add an owner directly (already approved) from **Owners → Add owner**.

## What the admin dashboard tracks

Visits, unique visitors, hostel page views, WhatsApp and call taps, searches, plus owner sign-ups, new hostels, room and photo changes. Everything lands in the `events` table and shows up on **Live activity** within a few seconds. Owners and the admin viewing their own pages are not counted as visitors.

## Deploy (free: Cloudflare Pages + Render)

**Before anything:** if your Supabase already has the old schema, run `backend/sql/002_owner_profile.sql` once in the SQL Editor (paste the contents, not the path). New projects just run `schema.sql`.

**1. Backend on [Render](https://render.com)** (free web service)
- New + → Web Service → connect this GitHub repo. Render reads `render.yaml`, or set by hand: root directory `backend`, build `npm install --omit=dev`, start `npm start`.
- Environment: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET=hostel-images`, and `CORS_ORIGIN=https://YOUR-SITE.pages.dev,https://*.pages.dev` (comma separated; add your own domain later).
- Your API URL looks like `https://buhostels-api.onrender.com`. Check `/api/health`.
- Free services sleep after ~15 min idle (first request takes ~30 s). The site pings the API as soon as a page opens, and public lists are cached for 30 s. To keep it awake, add a free [UptimeRobot](https://uptimerobot.com) monitor on `/api/health` every 5 min.

**2. Frontend on [Cloudflare Pages](https://pages.cloudflare.com)**
- Workers & Pages → Create → Pages → connect the repo. Framework preset: none. Build command: empty. Build output directory: `frontend`.
- Edit `PRODUCTION_API` in `frontend/js/config.js` to your Render URL, commit and push. Localhost keeps working untouched.

**3. Admin account:** run `npm run create-admin -- you@example.com "password" "Your Name"` locally with your `.env` (it talks to the same Supabase).

`frontend/_headers` adds security and cache headers on Cloudflare. The backend can also serve the frontend by itself (set `SERVE_FRONTEND=false` to turn that off when using Pages).

## Notes

- Prices are stored in UGX per semester. Phone numbers are normalised to international digits (`2567…`) so WhatsApp links work.
- Photos are shrunk in the browser to 1600 px before upload to save owners' mobile data.
- The service-role key lives only in `backend/.env`. Never put it in `frontend/`.
