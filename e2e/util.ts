import "dotenv/config";
import { Client } from "pg";

let client: Client | null = null;

/** Shared lazy pg client for assertions and cleanup. */
export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  if (!client) {
    client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
  }
  const result = await client.query(text, params);
  return result.rows as T[];
}

let seq = 0;

/** Short unique suffix for names/titles. */
export function uniq() {
  seq += 1;
  return `${Date.now().toString(36)}${seq}`.slice(-8);
}

/** Valid 10-digit VN phone starting with the E2E prefix 0999. */
export function e2ePhone() {
  seq += 1;
  const n = (Date.now() + seq) % 1_000_000;
  return `0999${String(n).padStart(6, "0")}`;
}

export function e2eName(tag: string) {
  return `E2E ${tag} ${uniq()}`;
}

export function e2eTitle(tag: string) {
  return `E2E ${tag} ${uniq()}`;
}

/** Removes every row the suite creates; safe to call before and after a run. */
export async function cleanupE2E() {
  await sql(`delete from task where title like 'E2E %'`);
  await sql(`delete from employee where phone like '0999%'`);
  await sql(`delete from employee where name like 'E2E %'`);
  await sql(`delete from zalo_message_log where zalo_user_id like 'e2e-zalo-%'`);
  await sql(`delete from zalo_conversation where zalo_user_id like 'e2e-zalo-%'`);
}

export async function employeeIdByPhone(phone: string) {
  const rows = await sql<{ id: string }>(
    "select id from employee where phone = $1",
    [phone]
  );
  return rows[0]?.id;
}

export async function taskRow(id: string) {
  const rows = await sql<{
    status: string;
    completed_at: string | null;
    assignee_id: string | null;
  }>(
    "select status, completed_at, assignee_id from task where id = $1",
    [id]
  );
  return rows[0];
}
