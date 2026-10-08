ALTER TABLE "epics" ADD COLUMN "source_request_id" text;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "linked_epic_id" text;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_linked_epic_id_epics_id_fk" FOREIGN KEY ("linked_epic_id") REFERENCES "public"."epics"("id") ON DELETE set null ON UPDATE no action;