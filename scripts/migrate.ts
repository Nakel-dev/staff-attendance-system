/**
 * Apply multi-tenant migration to Supabase via direct Postgres connection.
 * Requires SUPABASE_DB_PASSWORD in .env.local (Database password from Supabase dashboard).
 * Run: npm run migrate
 */
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { Client } from "pg";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

if (!supabaseUrl) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL in .env.local");
  process.exit(1);
}

if (!dbPassword) {
  console.error(
    "Missing SUPABASE_DB_PASSWORD in .env.local.\n" +
      "Add your Supabase database password from:\n" +
      "Project Settings → Database → Database password\n" +
      "Or run supabase/migrations/002_multi_tenant.sql in the Supabase SQL Editor."
  );
  process.exit(1);
}

const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const connectionString = `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

async function migrate() {
  const migrationsDir = path.join(__dirname, "..", "supabase", "migrations");
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log("Connected. Applying migrations...");
    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      console.log(`Applying ${file}...`);
      await client.query(sql);
    }
    console.log("All migrations applied successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
