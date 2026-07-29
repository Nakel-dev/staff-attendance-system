# Face++ setup (AttendPro)

Face++ compares the **staff profile photo** to a **kiosk snapshot** taken during the 3-second verification clip (portal QR clock flow).

## 1. Get API keys

1. Register at [Face++ Console](https://console.faceplusplus.com/)
2. Create an application
3. Copy **API Key** and **API Secret**

Use `https://api-us.faceplusplus.com` (US) or `https://api-cn.faceplusplus.com` (China).

## 2. Environment variables

Add to `.env.local` and **Vercel**:

```env
FACEPP_API_KEY=your_api_key
FACEPP_API_SECRET=your_api_secret
FACEPP_API_BASE=https://api-us.faceplusplus.com
FACEPP_COMPARE_CONFIDENCE_THRESHOLD=70
```

| Variable | Purpose |
|----------|---------|
| `FACEPP_API_KEY` | API key from console |
| `FACEPP_API_SECRET` | API secret |
| `FACEPP_API_BASE` | Regional API host (optional) |
| `FACEPP_COMPARE_CONFIDENCE_THRESHOLD` | Min confidence % to pass (default **70**) |

## 3. Verify locally

```bash
npm run verify:facepp
```

Expected: `OK: Face++ API keys valid...`

## 4. Staff requirements

- Staff must have a **profile photo** uploaded (admin or staff on `/profile`)
- Kiosk portal QR flow captures **video + snapshot** automatically
- Admin **Review queue** shows Face++ confidence % and video

## Cost

Face++ bills per API call on your console plan. Compare is one call per kiosk clock.
