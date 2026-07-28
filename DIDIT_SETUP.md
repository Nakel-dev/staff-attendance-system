# Didit face clock-in setup

AttendPro kiosk flow when Didit is configured:

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
6. Ensure every staff member has a **profile photo** (used as Didit portrait reference)  
7. Set each staff **kiosk PIN**  
8. Test at `/kiosk`

## Free tier note

Didit offers free monthly verification quota. High staff volume may exceed the free allowance — monitor usage in the Didit console.
