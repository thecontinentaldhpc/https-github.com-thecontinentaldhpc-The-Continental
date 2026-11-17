# THE CONTINENTAL
**Independent Journalism. Informed World.**  
*Truth Without Fear. Facts Without Favour.*

Official Website Target: `https://thecontinental.dhpc.in`  
Official Publication Timezone: `Asia/Kolkata` (IST, UTC+05:30)  
First Newspaper Edition: `1 January 2027`  
First Monthly Magazine: `January 2027`

## Overview
THE CONTINENTAL is a full-stack digital newspaper and monthly magazine publishing platform featuring:
- A Hindu-inspired broadsheet front page and 12 dedicated editorial sections (`World`, `India`, `Regional`, `Politics`, `Business`, `Economy`, `Education`, `Science & Technology`, `Environment`, `Sports`, `Opinion`, `Editorial`).
- Automatic `Asia/Kolkata` (IST) calendar and midnight transitions, while preserving historical article and edition dates permanently.
- Public **Publish Your Writing** submission desk with unique Submission IDs (`TC-SUB-...`), anti-spam validation, and private editorial review notes.
- **THE CONTINENTAL MAGAZINE** monthly issue reader, category index, PDF preview/download, and Year/Month archive.
- **Digital Newspaper / E-Paper** with pre-launch 1 January 2027 notice, PDF upload/approval gates, and permanent edition archive.
- **Super Administrator CMS (`/admin`)** with first-administrator setup, scrypt password hashing, HMAC-SHA256 HttpOnly session cookies, rich-text article editor, IST scheduling, media library, newsletter/contact management, and audit logs.

## Local Installation & Running
```bash
npm install
npm run test      # Runs unit tests for IST calendar & editorial rules
npm run build     # Builds React/Vite client bundle into dist/
npm run dev       # Starts full-stack Express + Vite server on port 3000
```

## First Super Administrator Setup
No administrator credentials are hardcoded in the repository.
1. Open `/admin` on your running site.
2. Complete the **Create Super Administrator** form (minimum 10-character password).
3. Once initialized, public setup is permanently disabled and `/admin` requires sign-in.

## Project Structure
- `server.ts` — Express server, REST APIs, Multer uploads, dynamic `/sitemap.xml` & `/robots.txt`
- `src/server/` — SQLite relational database (`db.ts`), authentication & rate limiting (`auth.ts`), IST scheduler (`scheduler.ts`)
- `src/lib/` — Pure `Asia/Kolkata` date utilities (`dateIst.ts`), HTML sanitization & publishing gates (`editorialRules.ts`), API client (`api.ts`), and `node:test` unit tests
- `src/pages/` — All 23 public pages, article reader, and `/admin` console
- `src/components/` — Broadsheet masthead, ticker, rich-text editor, newsletter, footer, and admin modules
- `supabase/migrations/001_initial_schema.sql` — PostgreSQL + RLS migration schema
