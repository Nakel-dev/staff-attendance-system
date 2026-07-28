# AWS Rekognition — one-time setup (AttendPro)

AttendPro uses **Amazon Rekognition CompareFaces** for staff signup verification and kiosk/phone clock-in. Set this up once on AWS + Vercel; all organizations default to **aws**.

## 1. Create IAM user (AWS Console)

1. **IAM → Users → Create user** (e.g. `attendpro-rekognition`)
2. **Attach policy** → Create inline policy → JSON → paste from [`docs/aws-rekognition-iam-policy.json`](docs/aws-rekognition-iam-policy.json)
3. Create **access key** (Application running outside AWS)
4. Save **Access key ID** and **Secret access key**

Required permission: `rekognition:CompareFaces` only.

**Region:** use a Rekognition-supported region (recommended `us-east-1`).

## 2. Environment variables

Add to **`.env.local`** (dev) and **Vercel → Project → Settings → Environment Variables** (Production + Preview):

```env
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_REKOGNITION_SIMILARITY_THRESHOLD=90
```

| Variable | Purpose |
|----------|---------|
| `AWS_ACCESS_KEY_ID` | IAM access key |
| `AWS_SECRET_ACCESS_KEY` | IAM secret |
| `AWS_REGION` | e.g. `us-east-1` |
| `AWS_REKOGNITION_SIMILARITY_THRESHOLD` | Match % (50–99, default **90**) |

Redeploy Vercel after saving env vars.

## 3. Verify locally

```bash
npm run verify:aws
```

Expected: `OK: AWS credentials and CompareFaces permission OK...`

## 4. Supabase migrations

Run in **Supabase SQL Editor** (if not already):

1. `supabase/migrations/013_biometric_provider.sql`
2. `supabase/migrations/015_default_aws_biometric.sql` — sets all orgs to **aws**

## 5. Confirm in admin UI

1. **Settings → Face verification method** — should show **AWS Rekognition**
2. Or call **`GET /api/admin/aws/status`** while logged in as admin — `ok: true`

## How face match works

| Step | AWS usage |
|------|-----------|
| Staff signup | Camera reference photo → guided liveness → **CompareFaces** vs reference |
| Kiosk / phone QR clock | Live selfie → **CompareFaces** vs signup reference photo |

Cost: about **$0.001 per compare** (Rekognition pricing).

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Settings shows AWS “not configured on server” | Add env vars on **Vercel** and redeploy |
| `Access denied` on verify | Attach IAM policy with `rekognition:CompareFaces` |
| Face did not match (low %) | Retake with lighting; lower threshold only if needed (min 50) |
| Still on Local after deploy | Run migration **015** in Supabase |

## Other providers

- **local** — free on-device (no AWS bill)
- **didit** — optional; requires `DIDIT_API_KEY` / `DIDIT_WORKFLOW_ID`

Change provider in **Settings → Face verification method** if needed.
