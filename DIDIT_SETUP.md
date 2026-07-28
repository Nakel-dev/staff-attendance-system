# Didit face verification setup

AttendPro uses Didit in two places:

### Staff portal (identity setup — not clock-in)
1. Staff signs in → **Profile**
2. Upload a clear **profile photo**
3. Click **Verify with Didit** (liveness + face match to that photo)
4. On Approved, identity is marked verified for kiosk matching

### Reception kiosk (daily clock-in/out)
1. Select staff name  
2. Enter 4-digit PIN  
3. Didit popup: live face + liveness + match to profile photo  
4. Auto clock-in/out if Approved  

If `DIDIT_API_KEY` / `DIDIT_WORKFLOW_ID` are missing, the kiosk falls back to PIN + local photo.

## Didit console steps

1. Create a Didit account at https://didit.me  
2. Create a **Biometric Authentication** workflow with:
   - **Liveness** (Passive recommended)
   - **Face Match**
3. Copy the **API key** and **Workflow ID**
4. Add to `.env.local` (and Vercel env vars):

```
DIDIT_API_KEY=...
DIDIT_WORKFLOW_ID=...
NEXT_PUBLIC_APP_URL=https://your-deployment-url
```

5. Redeploy / restart the app  
6. Staff upload profile photo + Didit-verify on `/profile`  
7. Set each staff **kiosk PIN**  
8. Test clock-in at `/kiosk`

## Free tier note

Didit offers free monthly verification quota. High staff volume may exceed the free allowance — monitor usage in the Didit console.
