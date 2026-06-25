# AttendPro — Commercial Setup Guide

This guide is for **buyers and licensees** deploying AttendPro for production or desktop resale.

## Product overview

**AttendPro v1.0** — Multi-tenant staff attendance & leave management

- Admin portal: dashboard, staff, attendance, team leaves, reports, settings
- Staff portal: check-in/out, my leaves, profile
- Unified auth: `/auth` (sign in, register org, join with invite code)
- Desktop: Windows EXE via Electron (optional)

## Quick start (15 minutes)

### 1. Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works for demos)
- (Optional) [Vercel](https://vercel.com) account for cloud hosting

### 2. Clone and install

```bash
git clone <your-repo-url>
cd staff-attendance-system
npm install
cp .env.local.example .env.local
```

### 3. Configure environment

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For production, set `NEXT_PUBLIC_APP_URL` to your live domain (required for password reset emails).

### 4. Database setup

In Supabase **SQL Editor**, run in order:

1. `supabase/schema.sql` (full schema)
2. `supabase/migrations/002_multi_tenant.sql` (if not in schema)
3. `supabase/migrations/003_fix_profile_rls.sql`
4. `supabase/migrations/004_security_hardening.sql`

Or run all migrations:

```bash
# Requires SUPABASE_DB_PASSWORD in .env.local
npm run migrate
```

In Supabase **Authentication → URL Configuration**, add redirect URL:

```
https://YOUR_DOMAIN/auth/reset-password
http://localhost:3000/auth/reset-password
```

### 5. Seed demo data

```bash
npm run seed
```

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@demo.com | Admin1234! |
| Staff | emily.chen@demo.com | Staff1234! |

Invite code: **DEMO2026**

### 6. Run

```bash
npm run dev
```

Open http://localhost:3000

## Desktop EXE (Windows)

Build a Windows installer for customers who want a desktop icon:

```bash
npm run desktop:build
```

Output: `dist/desktop/AttendPro-Setup-1.0.0.exe`

**Desktop env file:** After install, place `.env.local` in:

```
%APPDATA%/AttendPro/.env.local
```

(Same three Supabase variables as above.)

Test locally before packaging:

```bash
npm run desktop:dev
```

## Cloud deployment (SaaS)

See `DEPLOYMENT.md` for Vercel + Supabase production setup.

Live demo: https://staff-attendance-system-tau.vercel.app

## Security notes (v1.0)

- Row Level Security (RLS) enforces organization isolation
- Migration `004_security_hardening.sql` blocks privilege escalation on profile updates
- Admin server actions verify organization scope
- Leave requests validate remaining balance for annual/sick leave

## Support scope suggestion for sellers

Include in your product listing:

- Installation documentation (this file)
- 30 days email support
- Updates for 6 months (Pro tier)

## Legal

- Terms: `/terms`
- Privacy: `/privacy`
- License: see `LICENSE`
