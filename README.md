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
   Set `SITE_URL` to the canonical public website origin (for example, `https://your-domain.example`).
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
| Owner | signs up at `/login.html#register`, **admin approves** | add and edit their hostels, rooms and prices, photos; see their own views and contact taps |
| Admin | `npm run create-admin` | live activity feed, traffic charts, top hostels and searches, approve / suspend / delete owners, reset passwords, hide / feature / delete any hostel |

Until an owner is approved they can sign in and look around but cannot post. The admin can also add an owner directly (already approved) from **Owners → Add owner**.

## What the admin dashboard tracks

Visits, unique visitors, hostel page views, WhatsApp and call taps, searches, plus owner sign-ups, new hostels, room and photo changes. Everything lands in the `events` table and shows up on **Live activity** within a few seconds. Owners and the admin viewing their own pages are not counted as visitors.

## Deploy

Matches a Cloudflare Pages + Render setup:

- **Backend on [Render](https://render.com)**: root directory `backend`, build `npm install`, start `npm start`. Add the same variables as `.env`, and set `CORS_ORIGIN` to your frontend URL.
- **Frontend on [Cloudflare Pages](https://pages.cloudflare.com)**: output directory `frontend`, no build command. Then set `API_BASE` in `frontend/js/config.js` to your Render URL.
- Or deploy only the backend: it serves the frontend folder too, so one Render service is enough (leave `API_BASE` empty).
- Replace the `https://buhostels.example` placeholder in public canonical metadata, `robots.txt`, `sitemap.xml`, and `llms.txt` with the real frontend domain. The backend generates `/sitemap.xml` dynamically, including approved published hostels and cover-photo metadata; set `SITE_URL` to the frontend's canonical origin. If frontend and backend use separate hosts, configure the frontend host to proxy `/sitemap.xml` to the backend endpoint, or submit the backend sitemap in Google Search Console.

## Public information and discovery

- `/documentation.html` explains the visitor, owner, and administrator flows.
- `/terms.html` and `/privacy.html` describe platform use and data handling. These are project templates; review them for your actual operating arrangements and applicable law before launch.
- Owner registration requires agreement to the Terms of Use and acknowledgement of the Privacy Policy. The backend enforces this and records the policy version and acceptance timestamps. If the Supabase schema was already installed, rerun `backend/sql/schema.sql` to add the new nullable acceptance columns.
- Public pages include descriptive metadata, and hostel details add structured lodging data and dynamic page metadata. `/robots.txt`, `/sitemap.xml`, and `/llms.txt` help search engines and AI crawlers discover public information. Search engines decide independently what to index; keyword metadata does not guarantee rankings.

## Notes

- Prices are stored in UGX per semester. Phone numbers are normalised to international digits (`2567…`) so WhatsApp links work.
- Photos are shrunk in the browser to 1600 px before upload to save owners' mobile data.
- The service-role key lives only in `backend/.env`. Never put it in `frontend/`.
