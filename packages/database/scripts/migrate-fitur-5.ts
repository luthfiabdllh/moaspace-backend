import { Pool } from 'pg'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

const candidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(process.cwd(), '../apps/api/.env'),
  path.resolve(process.cwd(), 'apps/api/.env'),
]

for (const envPath of candidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath })
    break
  }
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/moaspace',
})

async function run() {
  const client = await pool.connect()
  try {
    console.log('Running migration for Fitur 5...')

    await client.query(`
      -- 1. Tambah kolom story_points dan sp_locked_at ke tasks
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS story_points integer;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sp_locked_at timestamp with time zone;

      -- 2. Buat enum capacity_request_status jika belum ada
      DO $$ BEGIN
        CREATE TYPE capacity_request_status AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      -- 3. Buat tabel member_capacities
      CREATE TABLE IF NOT EXISTS member_capacities (
        id text PRIMARY KEY,
        user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        week_start date NOT NULL,
        capacity_sp integer NOT NULL DEFAULT 10,
        note text,
        updated_by_id text REFERENCES users(id),
        requested_sp integer,
        request_status capacity_request_status NOT NULL DEFAULT 'NONE',
        created_at timestamp with time zone NOT NULL DEFAULT now(),
        updated_at timestamp with time zone NOT NULL DEFAULT now()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_week ON member_capacities(user_id, week_start);

      -- 4. Buat tabel task_sp_logs
      CREATE TABLE IF NOT EXISTS task_sp_logs (
        id text PRIMARY KEY,
        task_id text NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        old_sp integer,
        new_sp integer NOT NULL,
        changed_by_id text NOT NULL REFERENCES users(id),
        reason text NOT NULL,
        created_at timestamp with time zone NOT NULL DEFAULT now()
      );

      -- 5. Buat tabel assignment_overrides
      CREATE TABLE IF NOT EXISTS assignment_overrides (
        id text PRIMARY KEY,
        task_id text NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        assignee_id text NOT NULL REFERENCES users(id),
        utilization_at_assign integer NOT NULL,
        overridden_by_id text NOT NULL REFERENCES users(id),
        created_at timestamp with time zone NOT NULL DEFAULT now()
      );

      -- 6. Buat tabel system_settings
      CREATE TABLE IF NOT EXISTS system_settings (
        key varchar(100) PRIMARY KEY,
        value jsonb NOT NULL
      );

      -- 7. Seed default system settings jika belum ada
      INSERT INTO system_settings (key, value)
      VALUES 
        ('default_capacity_sp', '10'::jsonb),
        ('allowed_sp_scale', '[1, 2, 3, 5, 8]'::jsonb)
      ON CONFLICT (key) DO NOTHING;
    `)

    console.log('✅ Migration Fitur 5 completed successfully!')
  } catch (err) {
    console.error('Migration failed:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
