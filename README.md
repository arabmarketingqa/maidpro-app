# CleanPro Maid Booking System

Full-stack booking management system with a static frontend on Vercel and a Node.js/Express backend on Railway.

---

## Architecture

```
Browser
  ├── Frontend (Vercel) — public/index.html, public/admin-panel.html
  └── Backend  (Railway) — server.js + Supabase (PostgreSQL)
```

All API calls (`/api/*`) go directly from the browser to the Railway backend.

---

## Environment Variables

Both services need these secrets. **Never commit `.env` to git.**

| Variable | Where | Value |
|---|---|---|
| `SUPABASE_URL` | Railway | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Railway | Your Supabase anon/public key |
| `PORT` | Railway | Set automatically by Railway |

---

## 1. Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `supabase-schema.sql` to create all tables
3. Copy your **Project URL** and **anon public key** from Settings → API

---

## 2. Deploy Backend to Railway

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **New Project → Deploy from GitHub repo**
3. Select this repository
4. In the project settings, add environment variables:
   - `SUPABASE_URL` = your Supabase project URL
   - `SUPABASE_ANON_KEY` = your Supabase anon key
5. Railway auto-detects the `Procfile` and runs `node server.js`
6. Once deployed, copy your Railway public URL (e.g. `https://maid-booking-production.up.railway.app`)

---

## 3. Update the Frontend API URL

After getting your Railway URL, update **both** HTML files:

**`public/index.html`** (line ~633):
```js
const API = 'https://YOUR-APP.up.railway.app';
// change to:
const API = 'https://maid-booking-production.up.railway.app';
```

**`public/admin-panel.html`** (line ~1574):
```js
const API = 'https://YOUR-APP.up.railway.app';
// change to:
const API = 'https://maid-booking-production.up.railway.app';
```

Commit and push — Vercel redeploys automatically.

---

## 4. Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) and import this GitHub repo
2. Vercel reads `vercel.json` and serves `public/` as a static site
3. No environment variables needed on Vercel (the browser calls Railway directly)
4. Your live URLs:
   - Booking page: `https://your-project.vercel.app/`
   - Admin panel:  `https://your-project.vercel.app/admin-panel.html`

---

## Local Development

```bash
# Install dependencies
npm install

# Create .env with your Supabase credentials
cp .env.example .env
# edit .env and add SUPABASE_URL and SUPABASE_ANON_KEY

# Run the backend (serves both API and frontend)
npm start
# → http://localhost:3000          (booking page)
# → http://localhost:3000/admin-panel.html  (admin panel)
```

For local dev, change `const API` back to `''` in both HTML files so
the browser calls localhost instead of Railway.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/bookings` | List all bookings |
| POST | `/api/bookings` | Create booking |
| PATCH | `/api/bookings/:ref/status` | Update status |
| PATCH | `/api/bookings/:ref/complete` | Mark complete + payment |
| GET | `/api/staff` | List staff |
| POST | `/api/staff` | Add staff member |
| PUT | `/api/staff/:id` | Update staff member |
| DELETE | `/api/staff/:id` | Delete staff member |
| GET | `/api/customers` | List customers |
| GET | `/api/settings` | Get admin settings |
| POST | `/api/settings` | Save admin settings |
| GET | `/api/availability` | Check available time slots |
