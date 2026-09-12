ALTER TABLE "zalo_conversation" ALTER COLUMN "state" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "zalo_conversation" ALTER COLUMN "state" SET DEFAULT 'idle'::text;--> statement-breakpoint
UPDATE "zalo_conversation" SET "state" = 'idle' WHERE "state" IN ('awaiting_done_note', 'awaiting_done_photo');--> statement-breakpoint
DROP TYPE "public"."conversation_state";--> statement-breakpoint
CREATE TYPE "public"."conversation_state" AS ENUM('idle', 'awaiting_link_code', 'awaiting_issue_text', 'awaiting_task_pick');--> statement-breakpoint
ALTER TABLE "zalo_conversation" ALTER COLUMN "state" SET DEFAULT 'idle'::"public"."conversation_state";--> statement-breakpoint
ALTER TABLE "zalo_conversation" ALTER COLUMN "state" SET DATA TYPE "public"."conversation_state" USING "state"::"public"."conversation_state";