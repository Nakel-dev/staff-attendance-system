# Deployment Guide

## Live URLs

| Resource | URL |
|----------|-----|
| **Production app** | https://staff-attendance-system-tau.vercel.app |
| **Vercel dashboard** | https://vercel.com/maknjuolas-projects/staff-attendance-system |
| **GitHub repo** | https://github.com/Akinlekan/staff-attendance-system |

## Current status

- Next.js app is deployed to Vercel (production build passed)
- GitHub repository is connected for automatic deploys on push
- **Supabase is not configured yet** — the app returns 500 until env vars are added

## Finish setup (required)

### 1. Create a Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and sign in
2. Create a new project (e.g. `staff-attendance-system`)
3. Wait for the database to finish provisioning

### 2. Run the database schema

1. Open **SQL Editor** in Supabase
2. Paste and run the contents of `supabase/schema.sql`

### 3. Add environment variables to Vercel

From **Project Settings → Environment Variables** on Vercel, add:

| Variable | Where to find it |
|----------|------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role (secret) |

Or via CLI (replace values):

```powershell
cd C:\Users\Dell\Projects\staff-attendance-system

echo "YOUR_SUPABASE_URL" | vercel env add NEXT_PUBLIC_SUPABASE_URL production preview development --scope maknjuolas-projects
echo "YOUR_ANON_KEY" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production preview development --scope maknjuolas-projects
echo "YOUR_SERVICE_ROLE_KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY production preview development --scope maknjuolas-projects
```

### 4. Redeploy

```powershell
vercel deploy --prod --yes --scope maknjuolas-projects
```

### 5. Seed sample data

Create `.env.local` locally with the same three variables, then:

```powershell
npm run seed
```

### 6. Log in

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@school.com | Admin1234! |
| Staff | emily.chen@school.com | Staff1234! |

## Automatic deploys

Pushing to `master` on GitHub triggers a new Vercel deployment automatically.

## Troubleshooting

- **500 on all routes**: Missing or invalid Supabase env vars on Vercel
- **Login fails**: Run `npm run seed` after schema is applied
- **Middleware errors**: Ensure all three env vars are set for Production, Preview, and Development
