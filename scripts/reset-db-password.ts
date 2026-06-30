/**
 * Rotate the Supabase Postgres password using the current password in .env.local.
 * Usage: npx ts-node --transpile-only -r dotenv/config scripts/reset-db-password.ts NEW_PASSWORD
 */
import * as dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const currentPassword = process.env.SUPABASE_DB_PASSWORD;
const newPassword = process.argv[2];

if (!supabaseUrl || !currentPassword || !newPassword) {
  console.error(
    "Usage: npx ts-node --transpile-only -r dotenv/config scripts/reset-db-password.ts NEW_PASSWORD"
  );
  process.exit(1);
}

const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const connectionString =
  process.env.SUPABASE_DATABASE_URL ||
  `postgresql://postgres.${projectRef}:${encodeURIComponent(currentPassword)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

async function resetPassword() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    await client.query(`alter user postgres with password '${newPassword.replace(/'/g, "''")}'`);
    console.log("Database password updated successfully.");
    console.log("Update SUPABASE_DB_PASSWORD in .env.local with the new value.");
  } catch (err) {
    console.error("Password reset failed:", err);
    console.error(
      "If CLI connection fails, run this in Supabase SQL Editor instead:\n" +
        `alter user postgres with password '${newPassword.replace(/'/g, "''")}';`
    );
    process.exit(1);
  } finally {
    await client.end();
  }
}

resetPassword();
