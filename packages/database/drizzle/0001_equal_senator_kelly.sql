CREATE TYPE "public"."capacity_request_status" AS ENUM('NONE', 'PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('DRAFT', 'WAITING_ORIGIN_APPROVAL', 'SUBMITTED', 'NEED_INFO', 'REJECTED', 'ACCEPTED', 'IN_PROGRESS', 'DELIVERED', 'REVISION', 'CONFIRMED');--> statement-breakpoint
CREATE TABLE "assignment_overrides" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"assignee_id" text NOT NULL,
	"utilization_at_assign" integer NOT NULL,
	"overridden_by_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_capacities" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"week_start" date NOT NULL,
	"capacity_sp" integer DEFAULT 10 NOT NULL,
	"note" text,
	"updated_by_id" text,
	"requested_sp" integer,
	"request_status" "capacity_request_status" DEFAULT 'NONE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_sp_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"old_sp" integer,
	"new_sp" integer NOT NULL,
	"changed_by_id" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_events" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"from_status" "request_status",
	"to_status" "request_status" NOT NULL,
	"actor_id" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"division_id" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"fields" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"id" text PRIMARY KEY NOT NULL,
	"from_division_id" text NOT NULL,
	"to_division_id" text NOT NULL,
	"requester_id" text NOT NULL,
	"template_id" text,
	"title" varchar(255) NOT NULL,
	"brief" jsonb NOT NULL,
	"deadline" timestamp with time zone,
	"status" "request_status" DEFAULT 'DRAFT' NOT NULL,
	"reason" text,
	"delivery_notes" text,
	"delivery_attachments" jsonb,
	"linked_story_id" text,
	"source_task_id" text,
	"source_story_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "story_points" integer;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "sp_locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "assignment_overrides" ADD CONSTRAINT "assignment_overrides_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_overrides" ADD CONSTRAINT "assignment_overrides_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_overrides" ADD CONSTRAINT "assignment_overrides_overridden_by_id_users_id_fk" FOREIGN KEY ("overridden_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_capacities" ADD CONSTRAINT "member_capacities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_capacities" ADD CONSTRAINT "member_capacities_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_sp_logs" ADD CONSTRAINT "task_sp_logs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_sp_logs" ADD CONSTRAINT "task_sp_logs_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_events" ADD CONSTRAINT "request_events_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_events" ADD CONSTRAINT "request_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_templates" ADD CONSTRAINT "request_templates_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_from_division_id_divisions_id_fk" FOREIGN KEY ("from_division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_to_division_id_divisions_id_fk" FOREIGN KEY ("to_division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_template_id_request_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."request_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_linked_story_id_stories_id_fk" FOREIGN KEY ("linked_story_id") REFERENCES "public"."stories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_source_task_id_tasks_id_fk" FOREIGN KEY ("source_task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_source_story_id_stories_id_fk" FOREIGN KEY ("source_story_id") REFERENCES "public"."stories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_user_week" ON "member_capacities" USING btree ("user_id","week_start");