import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/env";
import * as schema from "./schema";

declare global {
  var __dsxPool: Pool | undefined;
}

// Reuse the pool across HMR reloads in dev.
const pool =
  global.__dsxPool ??
  new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") global.__dsxPool = pool;

export const db = drizzle(pool, { schema, casing: "snake_case" });
export { schema };
export type Db = typeof db;
