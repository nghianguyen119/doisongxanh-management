import "dotenv/config";
import { Client } from "pg";

/**
 * Deletes every test task assigned to one employee (by Zalo id) together with
 * its timeline, attachments, invites, and that Zalo user's message logs and
 * conversation state. The employee row itself is kept so the Zalo link keeps
 * working.
 *
 * Safe by default: prints a dry-run summary and deletes nothing. Pass --yes to
 * execute. Runs in a single transaction, so a failure rolls back everything.
 *
 *   pnpm db:clean-test 7835813795861213745
 *   pnpm db:clean-test 7835813795861213745 --yes
 */

const ZALO_USER_ID = process.argv[2];
const CONFIRM = process.argv.includes("--yes");

interface Counts {
  tasks: number;
  events: number;
  attachments: number;
  invites: number;
  messages: number;
  conversations: number;
}

async function countsFor(db: Client, employeeId: string | null): Promise<Counts> {
  const { rows } = await db.query<Counts>(
    `select
       (select count(*) from task
          where assignee_id = $1)::int as tasks,
       (select count(*) from task_event
          where task_id in (select id from task where assignee_id = $1))::int as events,
       (select count(*) from task_attachment
          where task_id in (select id from task where assignee_id = $1))::int as attachments,
       (select count(*) from employee_invite
          where employee_id = $1)::int as invites,
       (select count(*) from zalo_message_log
          where zalo_user_id = $2)::int as messages,
       (select count(*) from zalo_conversation
          where zalo_user_id = $2)::int as conversations`,
    [employeeId, ZALO_USER_ID],
  );
  return rows[0]!;
}

async function main() {
  if (!ZALO_USER_ID) {
    console.error("Usage: pnpm db:clean-test <zaloUserId> [--yes]");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    const emp = await db.query<{ id: string; name: string }>(
      `select id, name from employee where zalo_user_id = $1`,
      [ZALO_USER_ID],
    );
    const employee = emp.rows[0];
    const employeeId = employee?.id ?? null;

    const counts = await countsFor(db, employeeId);
    console.log(`Database: ${describeDb(process.env.DATABASE_URL)}`);
    console.log(
      `Employee: ${employee ? `${employee.name} (${employee.id})` : "NOT FOUND — only Zalo logs will be cleaned"}`,
    );
    console.log(`Zalo user: ${ZALO_USER_ID}`);
    console.log("Will delete:");
    console.log(`  tasks:         ${counts.tasks}`);
    console.log(`  task events:   ${counts.events}`);
    console.log(`  attachments:   ${counts.attachments}`);
    console.log(`  invites:       ${counts.invites}`);
    console.log(`  zalo messages: ${counts.messages}`);
    console.log(`  conversations: ${counts.conversations}`);

    if (!CONFIRM) {
      console.log("\nDry run — nothing deleted. Re-run with --yes to execute.");
      return;
    }

    await db.query("begin");
    try {
      if (employeeId) {
        await db.query(
          `delete from task_attachment
             where task_id in (select id from task where assignee_id = $1)`,
          [employeeId],
        );
        await db.query(
          `delete from task_event
             where task_id in (select id from task where assignee_id = $1)`,
          [employeeId],
        );
        await db.query(`delete from task where assignee_id = $1`, [employeeId]);
        await db.query(`delete from employee_invite where employee_id = $1`, [
          employeeId,
        ]);
      }
      await db.query(`delete from zalo_message_log where zalo_user_id = $1`, [
        ZALO_USER_ID,
      ]);
      await db.query(`delete from zalo_conversation where zalo_user_id = $1`, [
        ZALO_USER_ID,
      ]);
      await db.query("commit");
      console.log("\nDone. Test data deleted.");
    } catch (err) {
      await db.query("rollback");
      throw err;
    }
  } finally {
    await db.end();
  }
}

/** Host/database only — never print the credentials. */
function describeDb(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port || "5432"}${parsed.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
