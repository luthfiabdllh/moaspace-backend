/**
 * Seed produksi — membuat satu akun Super Admin + 7 divisi default
 * organisasi. TIDAK ada akun Kormanit, task/story/epic/request contoh, atau
 * data dummy lain apa pun. Admin yang login kemudian mengatur anggota,
 * penugasan, dst. lewat UI.
 *
 * Kredensial admin dibaca dari environment variable (TIDAK hardcoded)
 * supaya tidak pernah masuk ke git/log:
 *   ADMIN_EMAIL     (wajib)
 *   ADMIN_PASSWORD  (wajib, minimal 8 karakter)
 *   ADMIN_NAME      (opsional, default "Super Admin")
 *
 * Idempotent: aman dijalankan berulang kali (tiap deploy).
 * - Admin: kalau email sudah ada, hanya pastikan isSuperAdmin+ACTIVE —
 *   TIDAK menimpa password yang sudah ada.
 * - Divisi: kalau slug sudah ada, dilewati (tidak diubah/di-reset).
 */
import bcrypt from 'bcrypt'
import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq } from 'drizzle-orm'
import { Pool } from 'pg'
import { usersTable, divisionsTable } from '../src/index.js'

config({ path: '.env' })

const DEFAULT_DIVISIONS = [
  { name: 'Media Kreatif', slug: 'media-kreatif' },
  { name: 'Sponsorship', slug: 'sponsorship' },
  { name: 'Operasional', slug: 'operasional' },
  { name: 'Sekretaris', slug: 'sekretaris' },
  { name: 'Bendahara', slug: 'bendahara' },
  { name: 'PSDM', slug: 'psdm' },
  { name: 'Humas Publikasi', slug: 'humas-publikasi' },
]

async function seedProduction() {
  const adminEmail = process.env['ADMIN_EMAIL']
  const adminPassword = process.env['ADMIN_PASSWORD']
  const adminName = process.env['ADMIN_NAME'] || 'Super Admin'

  if (!adminEmail || !adminPassword) {
    console.error(
      '❌ ADMIN_EMAIL dan ADMIN_PASSWORD wajib diisi di environment sebelum menjalankan seed ini.',
    )
    process.exit(1)
  }

  if (adminPassword.length < 8) {
    console.error('❌ ADMIN_PASSWORD minimal 8 karakter.')
    process.exit(1)
  }

  const databaseUrl = process.env['DATABASE_URL']
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL wajib diisi.')
    process.exit(1)
  }

  console.log('🔄 Connecting to database...')
  const pool = new Pool({ connectionString: databaseUrl })
  const db = drizzle(pool)

  try {
    // 1. Super Admin (satu-satunya akun)
    const existingAdmin = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, adminEmail))

    if (existingAdmin.length === 0) {
      const passwordHash = await bcrypt.hash(adminPassword, 10)
      await db.insert(usersTable).values({
        id: crypto.randomUUID(),
        name: adminName,
        email: adminEmail,
        passwordHash,
        isSuperAdmin: true,
        status: 'ACTIVE',
      })
      console.log(`✅ Super Admin created: ${adminEmail}`)
    } else {
      // Sudah ada — pastikan rolenya benar, tapi JANGAN timpa password
      // (menghindari deploy berulang diam-diam me-reset password admin).
      await db
        .update(usersTable)
        .set({ isSuperAdmin: true, status: 'ACTIVE' })
        .where(eq(usersTable.id, existingAdmin[0]!.id))
      console.log(`ℹ️ Super Admin already exists, verified role: ${adminEmail}`)
    }

    // 2. Divisi default organisasi (tanpa anggota — admin yang menambahkan
    //    lewat UI setelah login)
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
      } else {
        console.log(`ℹ️ Division already exists, skipped: ${div.name}`)
      }
    }

    console.log('✨ Production seed completed.')
  } catch (err) {
    console.error('❌ Seed error:', err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

seedProduction()
