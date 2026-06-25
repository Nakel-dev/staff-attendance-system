# Deployment Guide — AttendPro v1.0

## Live URLs

| Resource | URL |
|----------|-----|
| **Production app** | https://staff-attendance-system-tau.vercel.app |
| **Auth** | https://staff-attendance-system-tau.vercel.app/auth |
| **GitHub** | https://github.com/Akinlekan/staff-attendance-system |

## Required environment variables (Vercel)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (server only) |
| `NEXT_PUBLIC_APP_URL` | `https://staff-attendance-system-tau.vercel.app` |

## Database migrations

Run in Supabase SQL Editor (in order):

1. `supabase/schema.sql`
2. `supabase/migrations/003_fix_profile_rls.sql`
3. `supabase/migrations/004_security_hardening.sql`

## Supabase auth redirect

Add to **Authentication → URL Configuration**:

```
https://staff-attendance-system-tau.vercel.app/auth/reset-password
```

## Redeploy

Push to `master` triggers Vercel auto-deploy, or:

```bash
npm run build
```

## Demo credentials (after seed)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@demo.com | Admin1234! |
| Staff | emily.chen@demo.com | Staff1234! |

Invite code: **DEMO2026**

## Desktop EXE

See [COMMERCIAL.md](./COMMERCIAL.md) for `npm run desktop:build`.

## Selling

See [SELLING.md](./SELLING.md) for marketplace list and pricing guidance.
