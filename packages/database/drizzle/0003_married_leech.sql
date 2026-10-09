CREATE TYPE "public"."announcement_category" AS ENUM('URGENT', 'MEETING', 'INFO', 'ACTIVITY');--> statement-breakpoint
CREATE TYPE "public"."announcement_target" AS ENUM('ALL', 'DIVISION');--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" text PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" jsonb NOT NULL,
	"category" "announcement_category" DEFAULT 'INFO' NOT NULL,
	"target_type" "announcement_target" DEFAULT 'ALL' NOT NULL,
	"target_division_id" text,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"event_start_date" timestamp with time zone,
	"event_end_date" timestamp with time zone,
	"location" varchar(255),
	"author_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" text NOT NULL,
	"google_event_id" text NOT NULL,
	"calendar_id" text NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_calendar_integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"google_refresh_token" text NOT NULL,
	"calendar_id" text NOT NULL,
	"calendar_name" varchar(255) DEFAULT 'MoaSpace - Tim KKN' NOT NULL,
	"sync_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_calendar_integrations_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_target_division_id_divisions_id_fk" FOREIGN KEY ("target_division_id") REFERENCES "public"."divisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_calendar_integrations" ADD CONSTRAINT "user_calendar_integrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;