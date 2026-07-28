# Cognito Identity Pool for AWS Face Liveness (browser)

AttendPro uses **Amazon Rekognition Face Liveness** when `NEXT_PUBLIC_AWS_COGNITO_IDENTITY_POOL_ID` is set. Without it, staff still get **motion liveness** (3-second live clip) before CompareFaces.

## 1. Create identity pool

1. **Amazon Cognito → Identity pools → Create identity pool**
2. Enable **Guest access** (unauthenticated identities)
3. Create pool and note the **Identity pool ID** (e.g. `us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

## 2. Attach role to unauthenticated identities

Edit the **Unauthenticated role** and attach this inline policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["rekognition:StartFaceLivenessSession"],
      "Resource": "*"
    }
  ]
}
```

## 3. Environment variables

Add to `.env.local` and **Vercel** (Production):

```env
NEXT_PUBLIC_AWS_COGNITO_IDENTITY_POOL_ID=us-east-1:your-pool-id
NEXT_PUBLIC_AWS_REGION=us-east-1
AWS_FACE_LIVENESS_CONFIDENCE_THRESHOLD=80
```

Server IAM user also needs `CreateFaceLivenessSession` and `GetFaceLivenessSessionResults` (see `docs/aws-rekognition-iam-policy.json`).

Redeploy after saving env vars.

## 4. Verify

Admin **Settings → Face verification** should show **Face Liveness enabled** when the pool ID is set.
