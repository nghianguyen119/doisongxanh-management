import "dotenv/config";
import { Pool } from "pg";

/**
 * Drops everything so `pnpm db:reset` gives a clean database.
 *
 * Note the `drizzle` schema: that is where drizzle-kit keeps its migration
 * journal. Dropping only `public` leaves the journal behind, and the next
 * `db:migrate` reports "applied successfully" while creating nothing.
 */
async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to reset the database in production.");
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const pool = new Pool({ connectionString: url });
  await pool.query(`
    DROP SCHEMA IF EXISTS drizzle CASCADE;
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
  `);
  await pool.end();

  console.log(`• dropped and recreated schemas on ${new URL(url).pathname.slice(1)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
