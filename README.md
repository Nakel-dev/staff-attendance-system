# Staff Attendance Management System

A full-stack staff attendance and leave management web application built with Next.js 14, Supabase, and shadcn/ui.

## Features

- **Admin Dashboard** — Real-time stats, charts, and recent activity
- **Staff Management** — Create, edit, activate/deactivate staff accounts
- **Attendance Marking** — Bulk daily attendance with check-in/out times
- **Leave Management** — Apply, approve, and reject leave requests
- **Reports** — Monthly attendance reports with CSV export and print view
- **Notifications** — In-app notifications for leave and attendance events
- **Role-based Access** — Separate admin and staff portals with middleware protection

## Tech Stack

- Next.js 14 (App Router, TypeScript)
- Supabase (PostgreSQL + Auth)
- Tailwind CSS + shadcn/ui
- date-fns, recharts, sonner

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.local.example` to `.env.local` and add your Supabase credentials:

```bash
cp .env.local.example .env.local
```

### 3. Set up the database

Run the SQL schema in your Supabase SQL Editor:

```
supabase/schema.sql
```

### 4. Seed sample data

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed.ts
```

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Default Login Credentials

| Role  | Email              | Password    |
|-------|--------------------|-------------|
| Admin | admin@school.com   | Admin1234!  |
| Staff | emily.chen@school.com | Staff1234! |

All seeded staff use password `Staff1234!`

## Project Structure

```
src/
├── app/
│   ├── (auth)/login/       # Login page
│   ├── (admin)/            # Admin routes (dashboard, staff, attendance, leaves, reports)
│   ├── (staff)/            # Staff routes (my-attendance, my-leaves)
│   └── profile/            # Shared profile page
├── components/             # UI and feature components
├── lib/                    # Supabase clients, actions, hooks, utils
└── constants/              # App constants
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed.ts` | Seed database |
