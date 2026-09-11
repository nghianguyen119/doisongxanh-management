-- Backfill before the unique index: old rows may hold invalid or duplicated
-- phones, either of which would make the index creation fail. Invalid values
-- become NULL, and when a phone is shared only the oldest row keeps it.
UPDATE "employee" SET "phone" = NULL
WHERE "phone" IS NOT NULL AND "phone" !~ '^0[0-9]{9,10}$';--> statement-breakpoint
UPDATE "employee" SET "phone" = NULL
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id",
           row_number() OVER (PARTITION BY "phone" ORDER BY "created_at", "id") AS rn
    FROM "employee"
    WHERE "phone" IS NOT NULL
  ) ranked
  WHERE ranked.rn > 1
);--> statement-breakpoint
CREATE UNIQUE INDEX "employee_phone_unique" ON "employee" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "employee_invite_employee_idx" ON "employee_invite" USING btree ("employee_id");