import fs from 'node:fs'
import path from 'node:path'
import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

const candidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(process.cwd(), '../apps/api/.env'),
  path.resolve(process.cwd(), 'apps/api/.env'),
]

for (const envPath of candidates) {
  if (fs.existsSync(envPath)) {
    config({ path: envPath })
    break
  }
}

export default defineConfig({
  schema: ['./src/schemas'],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] || 'postgresql://postgres:postgres@localhost:5432/moaspace',
  },
})
