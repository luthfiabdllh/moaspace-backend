import { config } from 'dotenv'
import { Pool } from 'pg'

config({ path: '.env' })

const databaseUrl =
  process.env['DATABASE_URL'] ||
  'postgresql://postgres:postgres@localhost:5432/moaspace'

async function migrate() {
  console.log('🔄 Menghubungkan ke database untuk migrasi Fitur 3...')
  const pool = new Pool({ connectionString: databaseUrl })

  const sql = `
    DO $$ BEGIN
      CREATE TYPE "epic_scope" AS ENUM('DIVISION', 'CROSS');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "task_priority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "task_status" AS ENUM('BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS "epics" (
      "id" text PRIMARY KEY NOT NULL,
      "title" varchar(255) NOT NULL,
      "description" text,
      "start_date" timestamp with time zone,
      "end_date" timestamp with time zone,
      "proker_tag" varchar(100),
      "scope" "epic_scope" DEFAULT 'DIVISION' NOT NULL,
      "owner_division_id" text REFERENCES "divisions"("id") ON DELETE SET NULL,
      "created_by_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "closed_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "epic_divisions" (
      "epic_id" text NOT NULL REFERENCES "epics"("id") ON DELETE CASCADE,
      "division_id" text NOT NULL REFERENCES "divisions"("id") ON DELETE CASCADE,
      PRIMARY KEY("epic_id", "division_id")
    );

    CREATE TABLE IF NOT EXISTS "stories" (
      "id" text PRIMARY KEY NOT NULL,
      "epic_id" text REFERENCES "epics"("id") ON DELETE SET NULL,
      "division_id" text NOT NULL REFERENCES "divisions"("id") ON DELETE CASCADE,
      "title" varchar(255) NOT NULL,
      "done_criteria" text,
      "target_date" timestamp with time zone,
      "proker_tag" varchar(100),
      "source_request_id" text,
      "closed_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "tasks" (
      "id" text PRIMARY KEY NOT NULL,
      "story_id" text NOT NULL REFERENCES "stories"("id") ON DELETE CASCADE,
      "title" varchar(255) NOT NULL,
      "description" text,
      "assignee_id" text REFERENCES "users"("id") ON DELETE SET NULL,
      "status" "task_status" DEFAULT 'BACKLOG' NOT NULL,
      "priority" "task_priority" DEFAULT 'MEDIUM' NOT NULL,
      "due_date" timestamp with time zone,
      "position" varchar(50) DEFAULT '0' NOT NULL,
      "is_blocked" boolean DEFAULT false NOT NULL,
      "blocked_reason" text,
      "started_at" timestamp with time zone,
      "completed_at" timestamp with time zone,
      "revision_count" integer DEFAULT 0 NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `

  try {
    await pool.query(sql)
    console.log('✅ Berhasil membuat tabel epics, epic_divisions, stories, dan tasks!')
  } catch (err) {
    console.error('❌ Gagal menjalankan migrasi:', err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

migrate()
