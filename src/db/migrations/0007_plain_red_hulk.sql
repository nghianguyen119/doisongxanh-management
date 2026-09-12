ALTER TABLE "task" ADD COLUMN "ref_no" serial NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "task_ref_no_unique" ON "task" USING btree ("ref_no");