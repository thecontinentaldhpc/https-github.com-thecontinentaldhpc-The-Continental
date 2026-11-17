# Deployment Guide — THE CONTINENTAL (`thecontinental.dhpc.in`)

## 1. Environment Variables
Copy `.env.example` to `.env` and configure:
- `PORT=3000`
- `NODE_ENV=production`
- `APP_URL=https://thecontinental.dhpc.in`
- `SESSION_SECRET=<64-char random hex string>`

Generate a strong `SESSION_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 2. Production Build & Start
```bash
npm install
npm run build
npm run start
```
The Express server serves API routes, `/uploads/*` media/PDF files, `/sitemap.xml`, `/robots.txt`, and the built Vite client from `dist/`.
Persist the `data/` directory (`data/the_continental.db` and `data/uploads/`) across restarts using a persistent volume.

## 3. Optional External PostgreSQL / Supabase Setup
If migrating from embedded SQLite to managed PostgreSQL / Supabase:
1. Create a new Supabase project.
2. Apply `supabase/migrations/001_initial_schema.sql` via Supabase SQL Editor or `supabase db push`.
3. Create Storage buckets `media` (public read) and `editions` (public read for approved PDFs).
4. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (server-side only).

## 4. Custom Domain & HTTPS (`thecontinental.dhpc.in`)
1. Point an `A` or `CNAME` DNS record for `thecontinental.dhpc.in` to your hosting reverse proxy / Cloud Run / VPS endpoint.
2. Enable automatic TLS (Let's Encrypt / managed SSL) on port 443 forwarding to port `3000`.
3. Verify `/sitemap.xml`, `/robots.txt`, and `/admin` authentication over HTTPS before launching on 1 January 2027.
