# AttendPro Desktop — Softcopy Submission Guide

## Installer location (built on this machine)

```
C:\Users\Dell\Projects\staff-attendance-system\dist\desktop\AttendPro-Setup-1.0.0.exe
```

Size: ~151 MB. This file is **not** stored in GitHub (too large). Copy it into your softcopy ZIP for your lecturer.

## What to put in your softcopy package

Suggested ZIP name: `AttendPro-Softcopy.zip`

| Item | Why |
|------|-----|
| `AttendPro-Setup-1.0.0.exe` | Windows desktop installer |
| This file (`DESKTOP_SUBMISSION.md`) | How to install and run |
| Project report PDF (if you have one) | Written documentation |
| Optional: GitHub link | Source code |

**Do not include** `.env.local` (contains secrets). Lecturers can use the live web demo instead, or you can provide a separate demo env sheet privately if required.

## Live web demo (recommended backup)

- URL: https://staff-attendance-system-tau.vercel.app/auth
- Admin: `admin@school.com` / `Admin1234!`
- Staff: `emily.chen@school.com` / `Staff1234!`

The desktop app uses the **same backend** (Supabase online). Internet is required.

## How to install the desktop app

1. Run `AttendPro-Setup-1.0.0.exe`
2. Follow the installer (choose install folder if asked)
3. After install, create this file:

```
%APPDATA%\AttendPro\.env.local
```

Full example path:

```
C:\Users\<YourWindowsUser>\AppData\Roaming\AttendPro\.env.local
```

4. Put these three lines (use your project's Supabase values):

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

5. Start **AttendPro** from the Start Menu or desktop shortcut
6. Sign up / sign in the same way as the website

## Rebuild the installer later

From the project folder:

```bash
npm run desktop:build
```

Output: `dist/desktop/AttendPro-Setup-1.0.0.exe`

## Sign-up on desktop

Unchanged from the web app:

1. Open AttendPro
2. Register an organization **or** join with an invite code
3. Admin sets staff kiosk PIN + profile photo
4. Reception kiosk: open `/kiosk` inside the app, enter device API key

## Notes for lecturers

- Desktop wrapper: Electron
- Core product: Next.js web app packaged for Windows
- Data & auth: cloud (Supabase) — requires internet
- Kiosk clock-in: name → 4-digit PIN → photo (manual admin review when needed)
