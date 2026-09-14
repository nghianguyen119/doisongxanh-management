CREATE TYPE "public"."mobile_notification_kind" AS ENUM('message', 'task', 'alert');--> statement-breakpoint
CREATE TYPE "public"."mobile_platform" AS ENUM('android', 'ios');--> statement-breakpoint
ALTER TYPE "public"."task_event_type" ADD VALUE 'nudge_sent';--> statement-breakpoint
CREATE TABLE "mobile_device" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"device_name" text,
	"platform" "mobile_platform" DEFAULT 'android' NOT NULL,
	"push_token" text,
	"push_token_updated_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mobile_notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"kind" "mobile_notification_kind" DEFAULT 'task' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"task_id" uuid,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mobile_pair_code" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mobile_pair_code_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "acknowledged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "acknowledged_by" uuid;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "escalation_level" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "alert_delivery_id" text;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "alert_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "last_alert_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mobile_device" ADD CONSTRAINT "mobile_device_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_notification" ADD CONSTRAINT "mobile_notification_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_notification" ADD CONSTRAINT "mobile_notification_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_pair_code" ADD CONSTRAINT "mobile_pair_code_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_pair_code" ADD CONSTRAINT "mobile_pair_code_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mobile_device_token_hash_unique" ON "mobile_device" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "mobile_device_employee_idx" ON "mobile_device" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "mobile_notification_employee_idx" ON "mobile_notification" USING btree ("employee_id","created_at");--> statement-breakpoint
CREATE INDEX "mobile_pair_code_employee_idx" ON "mobile_pair_code" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "mobile_pair_code_code_idx" ON "mobile_pair_code" USING btree ("code");--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_acknowledged_by_employee_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."employee"("id") ON DELETE set null ON UPDATE no action;