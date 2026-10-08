import bcrypt from 'bcrypt'
import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq } from 'drizzle-orm'
import { Pool } from 'pg'
import {
  divisionsTable,
  usersTable,
} from '../src/index.js'

config({ path: '.env' })

const DEFAULT_DIVISIONS = [
  { name: 'Media Kreatif', slug: 'media-kreatif' },
  { name: 'Sponsorship', slug: 'sponsorship' },
  { name: 'Operasional', slug: 'operasional' },
  { name: 'Sekretaris', slug: 'sekretaris' },
  { name: 'Bendahara', slug: 'bendahara' },
  { name: 'PSDM', slug: 'psdm' },
  { name: 'Humas Publikasi', slug: 'humas-publikasi' },
  { name: 'Koordinator Unit', slug: 'koordinator-unit'}
]

async function seed() {
  const databaseUrl =
    process.env['DATABASE_URL'] ||
    'postgresql://postgres:postgres@localhost:5432/moaspace'
  console.log('🔄 Connecting to database...')
  const pool = new Pool({ connectionString: databaseUrl })
  const db = drizzle(pool)

  try {
    // 1. Seed Super Admin
    const adminEmail = 'admin@moaspace.com'
    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, adminEmail))

    let adminId: string

    if (existing.length === 0) {
      adminId = crypto.randomUUID()
      const passwordHash = await bcrypt.hash('admin123', 10)
      await db.insert(usersTable).values({
        id: adminId,
        name: 'Super Admin KKN',
        email: adminEmail,
        passwordHash,
        isSuperAdmin: true,
        status: 'ACTIVE',
      })
      console.log('✅ Super Admin user created: admin@moaspace.com / admin123')
    } else {
      adminId = existing[0]!.id
      // Ensure existing admin is super admin and active
      await db
        .update(usersTable)
        .set({ isSuperAdmin: true, status: 'ACTIVE' })
        .where(eq(usersTable.id, adminId))
      console.log('ℹ️ Super Admin user verified: admin@moaspace.com')
    }

    // 2. Seed Kormanit (Koordinator Mahasiswa Unit)
    const kormanitEmail = 'kormanit@moaspace.com'
    const existingKormanit = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, kormanitEmail))

    let kormanitId: string

    if (existingKormanit.length === 0) {
      kormanitId = crypto.randomUUID()
      const passwordHash = await bcrypt.hash('kormanit123', 10)
      await db.insert(usersTable).values({
        id: kormanitId,
        name: 'Kormanit Unit KKN',
        email: kormanitEmail,
        passwordHash,
        isSuperAdmin: false,
        isKormanit: true,
        status: 'ACTIVE',
      })
      console.log('✅ Kormanit user created: kormanit@moaspace.com / kormanit123')
    } else {
      kormanitId = existingKormanit[0]!.id
      await db
        .update(usersTable)
        .set({ isKormanit: true, status: 'ACTIVE' })
        .where(eq(usersTable.id, kormanitId))
      console.log('ℹ️ Kormanit user verified: kormanit@moaspace.com')
    }

    // 3. Seed 7 Default Divisions
    for (const div of DEFAULT_DIVISIONS) {
      const existingDiv = await db
        .select()
        .from(divisionsTable)
        .where(eq(divisionsTable.slug, div.slug))

      if (existingDiv.length === 0) {
        await db.insert(divisionsTable).values({
          id: crypto.randomUUID(),
          name: div.name,
          slug: div.slug,
          requestApprovalEnabled: false,
        })
        console.log(`✅ Division created: ${div.name} (${div.slug})`)
      }
    }

    console.log('✨ Seed completed successfully!')
  } catch (err) {
    console.error('❌ Seed error:', err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

seed()
