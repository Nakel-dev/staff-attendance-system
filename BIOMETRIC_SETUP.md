# Biometric providers (admin choice)

Admins pick the face provider under **Settings → Attendance Security → Face biometric provider**.

| Provider | Cost | Portal identity setup | Kiosk clock-in |
|----------|------|------------------------|----------------|
| **local** (default) | Free | Guided angles + motion liveness | PIN + photo |
| **aws** | Pay-as-you-go (~$0.001/compare) | Guided liveness + AWS CompareFaces | PIN + photo + AWS match |
| **didit** | Your Didit plan | Didit popup | PIN + Didit session |

Clock-in/out is always at the reception kiosk. Staff portal verification is identity setup only.

## AWS env (Vercel / `.env.local`)

```
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_REKOGNITION_SIMILARITY_THRESHOLD=90
```

IAM user needs `rekognition:CompareFaces`.

## Database

Run migration `supabase/migrations/013_biometric_provider.sql` in the Supabase SQL editor (adds `organizations.biometric_provider`).
