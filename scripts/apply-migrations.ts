/**
 * Apply specific Supabase migration files via direct Postgres connection.
 * Usage: npx ts-node --transpile-only -r dotenv/config scripts/apply-migrations.ts 005 006
 */
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { Client } from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;
const requested = process.argv.slice(2);

if (!supabaseUrl) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL in .env.local");
  process.exit(1);
}

if (!dbPassword) {
  console.error("Missing SUPABASE_DB_PASSWORD in .env.local");
  process.exit(1);
}

const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const connectionString =
  process.env.SUPABASE_DATABASE_URL ||
  `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

async function applyMigrations() {
  const migrationsDir = path.join(__dirname, "..", "supabase", "migrations");
  const allFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const migrationFiles =
    requested.length > 0
      ? allFiles.filter((file) => requested.some((prefix) => file.startsWith(prefix)))
      : allFiles;

  if (migrationFiles.length === 0) {
    console.error("No migration files matched.");
    process.exit(1);
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log("Connected. Applying migrations...");
    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      console.log(`Applying ${file}...`);
      await client.query(sql);
      console.log(`Applied ${file}`);
    }
    console.log("Done.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigrations();
