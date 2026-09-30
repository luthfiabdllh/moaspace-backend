import bcrypt from 'bcrypt'
import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq } from 'drizzle-orm'
import { Pool } from 'pg'
import { usersTable } from '../src/index'

config({ path: '.env' })

async function seed() {
  const databaseUrl = process.env['DATABASE_URL'] || 'postgresql://postgres:postgres@localhost:5432/moaspace'
  console.log('🔄 Connecting to database...')
  const pool = new Pool({ connectionString: databaseUrl })
  const db = drizzle(pool)

  try {
    const adminEmail = 'admin@moaspace.com'
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, adminEmail))

    if (existing.length === 0) {
      const passwordHash = await bcrypt.hash('admin123', 10)
      await db.insert(usersTable).values({
        id: crypto.randomUUID(),
        name: 'MoaSpace Admin',
        email: adminEmail,
        password: passwordHash,
        role: 'ADMIN',
      })
      console.log('✅ Admin user created: admin@moaspace.com / admin123')
    } else {
      console.log('ℹ️ Admin user already exists.')
    }
  } catch (err) {
    console.error('❌ Seed error:', err)
  } finally {
    await pool.end()
  }
}

seed()
