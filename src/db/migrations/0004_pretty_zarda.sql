ALTER TABLE "task" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "task" ALTER COLUMN "status" SET DEFAULT 'assigned'::text;--> statement-breakpoint
UPDATE "task" SET "status" = 'assigned' WHERE "status" IN ('new', 'accepted');--> statement-breakpoint
DROP TYPE "public"."task_status";--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('assigned', 'in_progress', 'blocked', 'done', 'verified', 'cancelled');--> statement-breakpoint
ALTER TABLE "task" ALTER COLUMN "status" SET DEFAULT 'assigned'::"public"."task_status";--> statement-breakpoint
ALTER TABLE "task" ALTER COLUMN "status" SET DATA TYPE "public"."task_status" USING "status"::"public"."task_status";