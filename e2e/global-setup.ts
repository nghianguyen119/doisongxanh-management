import "dotenv/config";
import { Client } from "pg";

export default async function globalSetup() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(`delete from task where title like 'E2E %'`);
  await client.query(`delete from employee where phone like '0999%'`);
  await client.query(`delete from employee where name like 'E2E %'`);
  await client.query(
    `delete from zalo_message_log where zalo_user_id like 'e2e-zalo-%'`
  );
  await client.query(
    `delete from zalo_conversation where zalo_user_id like 'e2e-zalo-%'`
  );
  await client.end();
}
