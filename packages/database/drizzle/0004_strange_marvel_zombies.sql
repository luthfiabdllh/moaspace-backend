CREATE TYPE "public"."academic_cluster" AS ENUM('SAINTEK', 'SOSHUM', 'MEDIKA', 'AGRO');--> statement-breakpoint
CREATE TYPE "public"."subunit_role" AS ENUM('MEMBER', 'COORDINATOR');--> statement-breakpoint
CREATE TYPE "public"."program_approval_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."program_cluster" AS ENUM('SAINTEK', 'SOSHUM', 'MEDIKA', 'AGRO', 'UNIT_SHARED');--> statement-breakpoint
CREATE TYPE "public"."program_member_role" AS ENUM('CO_PIC', 'MEMBER');--> statement-breakpoint
CREATE TYPE "public"."program_scope" AS ENUM('UNIT', 'SUBUNIT');--> statement-breakpoint
CREATE TYPE "public"."program_status" AS ENUM('PROPOSED', 'ACTIVE', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
ALTER TYPE "public"."announcement_target" ADD VALUE 'SUBUNIT';--> statement-breakpoint
ALTER TYPE "public"."announcement_target" ADD VALUE 'CLUSTER';--> statement-breakpoint
CREATE TABLE "subunit_members" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"subunit_id" text NOT NULL,
	"role" "subunit_role" DEFAULT 'MEMBER' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subunits" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"location" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subunits_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "program_members" (
	"id" text PRIMARY KEY NOT NULL,
	"program_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "program_member_role" DEFAULT 'MEMBER' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" text PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"scope" "program_scope" DEFAULT 'SUBUNIT' NOT NULL,
	"subunit_id" text,
	"cluster" "program_cluster" DEFAULT 'UNIT_SHARED' NOT NULL,
	"primary_pic_id" text NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"status" "program_status" DEFAULT 'PROPOSED' NOT NULL,
	"cluster_approval_status" "program_approval_status" DEFAULT 'PENDING' NOT NULL,
	"cluster_approved_by_id" text,
	"cluster_approved_at" timestamp with time zone,
	"cluster_rejection_reason" text,
	"governance_approval_status" "program_approval_status" DEFAULT 'PENDING' NOT NULL,
	"governance_approved_by_id" text,
	"governance_approved_at" timestamp with time zone,
	"governance_rejection_reason" text,
	"created_by_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "target_subunit_id" text;--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "target_cluster" "academic_cluster";--> statement-breakpoint
ALTER TABLE "epics" ADD COLUMN "program_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "cluster" "academic_cluster";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_cluster_coordinator" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "subunit_members" ADD CONSTRAINT "subunit_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subunit_members" ADD CONSTRAINT "subunit_members_subunit_id_subunits_id_fk" FOREIGN KEY ("subunit_id") REFERENCES "public"."subunits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_members" ADD CONSTRAINT "program_members_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_members" ADD CONSTRAINT "program_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_subunit_id_subunits_id_fk" FOREIGN KEY ("subunit_id") REFERENCES "public"."subunits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_primary_pic_id_users_id_fk" FOREIGN KEY ("primary_pic_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_cluster_approved_by_id_users_id_fk" FOREIGN KEY ("cluster_approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_governance_approved_by_id_users_id_fk" FOREIGN KEY ("governance_approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_user_subunit" ON "subunit_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_program_user" ON "program_members" USING btree ("program_id","user_id");--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_target_subunit_id_subunits_id_fk" FOREIGN KEY ("target_subunit_id") REFERENCES "public"."subunits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epics" ADD CONSTRAINT "epics_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;