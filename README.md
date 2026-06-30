# AttendPro

**Professional staff attendance & leave management** — multi-tenant, responsive, ready to deploy as SaaS or Windows desktop software.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)

## Live demo

- **App:** https://staff-attendance-system-tau.vercel.app/auth
- **Docs for buyers:** [COMMERCIAL.md](./COMMERCIAL.md)
- **Where to sell:** [SELLING.md](./SELLING.md)

## Features

### Admin
- Real-time dashboard with charts and KPIs
- Staff management (create, edit, activate/deactivate, delete)
- Bulk daily attendance marking
- Team leave approval workflow
- Monthly reports with CSV export and print
- Organization settings (name, invite code)
- In-app notifications

### Staff
- One-click check-in and check-out
- Personal attendance calendar and history
- Leave requests with balance tracking
- Cancel pending leave requests
- Profile and notifications

### Platform
- Multi-tenant organizations with invite codes
- Unified auth (`/auth`) — sign in, register org, join as staff
- Password reset flow
- Mobile-responsive UI with bottom navigation
- Role-based middleware protection
- Terms & Privacy pages

## Tech stack

- **Frontend:** Next.js 14, TypeScript, Tailwind, shadcn/ui
- **Backend:** Supabase (Auth + PostgreSQL + RLS)
- **Desktop:** Electron (optional Windows EXE)
- **Deploy:** Vercel (recommended)

## Quick start

```bash
npm install
cp .env.local.example .env.local
# Add Supabase credentials to .env.local
# Run supabase/schema.sql + migrations in Supabase SQL Editor
npm run seed
npm run dev
```

Open http://localhost:3000

### Demo login (production & after seed)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@school.com | Admin1234! |
| Staff | emily.chen@school.com | Staff1234! |

After local seed, demo accounts use `@demo.com` emails (e.g. `admin@demo.com` / `Admin1234!`).

Staff invite code: **DEMO2026**

**Project report for submission:** [PROJECT_REPORT.md](./PROJECT_REPORT.md)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run seed` | Seed demo organization + staff |
| `npm run migrate:secure` | Apply secure check-in migrations 005–007 |
| `npm run desktop:dev` | Run as desktop app (dev) |
| `npm run desktop:build` | Build Windows EXE installer |

## Project structure

```
src/app/
  (admin)/     Admin routes
  (staff)/     Staff routes
  (auth)/      Login & registration
  my-leaves/   Personal leave (all roles)
  profile/     User profile
  terms/       Terms of service
  privacy/     Privacy policy
desktop/       Electron main process
supabase/      Schema + migrations
scripts/       Seed, migrate, standalone prep
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Vercel + Supabase production setup.

## Selling this product

See [SELLING.md](./SELLING.md) for marketplace recommendations (Gumroad, Lemon Squeezy, CodeCanyon, etc.) and pricing guidance.

See [COMMERCIAL.md](./COMMERCIAL.md) for buyer setup instructions.

## License

Commercial license — see [LICENSE](./LICENSE). Purchase grants single production use unless otherwise agreed.
