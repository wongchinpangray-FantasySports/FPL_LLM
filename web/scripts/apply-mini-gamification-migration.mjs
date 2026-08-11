/**
 * Apply Mini 5 gamification migration when DATABASE_URL / SUPABASE_DB_URL is set.
 * Usage (from repo root):
 *   set DATABASE_URL=postgresql://...
 *   node web/scripts/apply-mini-gamification-migration.mjs
 *
 * Or paste supabase/migrations/0028_mini_gamification.sql into the Supabase SQL editor.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = resolve(__dirname, "../../supabase/migrations/0028_mini_gamification.sql");
const sql = readFileSync(sqlPath, "utf8");
const dbUrl =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.POSTGRES_URL;

if (!dbUrl) {
  console.error("Missing DATABASE_URL / SUPABASE_DB_URL / POSTGRES_URL");
  console.error("Paste this SQL into Supabase → SQL Editor instead:\n");
  console.log(sql);
  process.exit(1);
}

const { default: pg } = await import("pg").catch(() => ({ default: null }));
if (!pg) {
  console.error("Install pg first: npm i pg");
  process.exit(1);
}

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(sql);
  console.log("Applied 0028_mini_gamification.sql");
} finally {
  await client.end();
}
