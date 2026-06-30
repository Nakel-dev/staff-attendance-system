# Database password rotation

If the Postgres password was exposed, rotate it in Supabase:

1. Open [Database settings](https://supabase.com/dashboard/project/osrojmqhmonsxgbbyghg/settings/database) → **Reset database password**, **or** run in [SQL Editor](https://supabase.com/dashboard/project/osrojmqhmonsxgbbyghg/sql/new):

   ```sql
   alter user postgres with password 'YOUR_NEW_STRONG_PASSWORD';
   ```

2. Update `.env.local`:

   ```
   SUPABASE_DB_PASSWORD=YOUR_NEW_STRONG_PASSWORD
   ```

3. Optional CLI helper (requires a working pooler connection string in `SUPABASE_DATABASE_URL`):

   ```bash
   npx ts-node --transpile-only -r dotenv/config scripts/reset-db-password.ts YOUR_NEW_STRONG_PASSWORD
   ```

Never commit database passwords to Git.
