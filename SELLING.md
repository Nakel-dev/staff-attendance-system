# Where to Sell AttendPro

AttendPro can be sold as **source code**, **self-hosted SaaS setup**, or a **Windows desktop installer (EXE)**. Below are proven marketplaces and how each fits.

## Best marketplaces for indie software

| Platform | Best for | Fees (approx.) | Link |
|----------|----------|----------------|------|
| **Gumroad** | Digital downloads, EXE + docs, quick launch | ~10% + payment fees | [gumroad.com](https://gumroad.com) |
| **Lemon Squeezy** | Software licenses, VAT/tax handling | ~5% + payment fees | [lemonsqueezy.com](https://lemonsqueezy.com) |
| **Paddle** | Global SaaS + desktop billing | ~5% + payment fees | [paddle.com](https://paddle.com) |
| **CodeCanyon (Envato)** | Web app source code templates | 37.5%–55% author share | [codecanyon.net](https://codecanyon.net) |
| **FastSpring** | B2B software storefront | Custom | [fastspring.com](https://fastspring.com) |
| **itch.io** | Indie tools, lifetime deals | 0% (you set price) or 10% | [itch.io](https://itch.io) |
| **Microsoft Store** | Packaged Windows desktop app | 15% (apps) | [partner.microsoft.com](https://partner.microsoft.com) |

## Recommended pricing strategy

| Product | Suggested price | What buyer gets |
|---------|-----------------|-----------------|
| **Starter license** | $49–$99 | Source code + setup guide |
| **Pro license** | $149–$299 | Source + desktop EXE build scripts + 6 months updates |
| **Agency license** | $499+ | Unlimited client deployments, white-label rights |

## What to include in every sale

1. **AttendPro source code** (this repository)
2. **Setup guide** — `COMMERCIAL.md` + `DEPLOYMENT.md`
3. **Demo credentials** — after running `npm run seed`
4. **Supabase setup SQL** — `supabase/schema.sql` + migrations
5. **License key policy** (optional) — Lemon Squeezy / Gumroad license keys
6. **Support terms** — e.g. 30 days email support

## Desktop EXE vs SaaS — what to tell buyers

| Model | Pros | Cons |
|-------|------|------|
| **SaaS (Vercel + Supabase)** | Easiest updates, multi-device | Monthly hosting cost |
| **Desktop EXE (Electron)** | Feels like native Windows software | Buyer still needs Supabase (cloud DB) unless you build offline edition |
| **Self-hosted (Docker/VPS)** | One-time sale to IT teams | You support their server |

> **Important:** The included desktop EXE bundles the Next.js app locally but still connects to **your Supabase project** via `.env.local`. For a fully offline product, you would need a local database edition (custom quote).

## Marketing checklist before listing

- [ ] Live demo URL (Vercel production)
- [ ] 2-minute screen recording (signup → check-in → leave → report)
- [ ] Screenshot pack (dashboard, mobile, reports)
- [ ] Feature list vs competitors (BambooHR, Deputy, Homebase)
- [ ] Clear refund policy on Gumroad/Lemon Squeezy
- [ ] Terms + Privacy pages (included at `/terms`, `/privacy`)

## Competitor feature parity (AttendPro v1.0)

| Feature | AttendPro | Typical HR apps |
|---------|-----------|-----------------|
| Multi-tenant organizations | ✅ | ✅ |
| Staff invite codes | ✅ | ✅ |
| Check-in / check-out | ✅ | ✅ |
| Bulk attendance (admin) | ✅ | ✅ |
| Leave balances + validation | ✅ | ✅ |
| Approve/reject/cancel leave | ✅ | ✅ |
| CSV reports + print | ✅ | ✅ |
| In-app notifications | ✅ | ✅ |
| Password reset | ✅ | ✅ |
| Org settings | ✅ | ✅ |
| Payroll integration | ❌ | Some |
| Biometric / GPS clock-in | ❌ | Some |
| Stripe billing built-in | ❌ | SaaS only |

## Next steps to launch

1. Deploy demo to Vercel + Supabase (see `DEPLOYMENT.md`)
2. Record demo video
3. Create Gumroad or Lemon Squeezy product
4. Upload `AttendPro-Setup-1.0.0.exe` from `npm run desktop:build` (optional tier)
5. Link demo + documentation in product page
