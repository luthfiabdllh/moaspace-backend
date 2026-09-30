import crypto from 'node:crypto'
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import {
  authTokensTable,
  divisionMembersTable,
  divisionsTable,
  sessionsTable,
  usersTable,
} from '@moaspace/database'
import { and, desc, eq, isNull } from 'drizzle-orm'
import {
  DATABASE_CONNECTION,
  type Database,
} from '../database/database.provider.js'
import type { CreateUserDto } from './dto/create-user.dto.js'

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name)

  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  // ─── 1. Super Admin: Daftarkan Anggota Baru ──────────────────────────────
  async create(dto: CreateUserDto) {
    const email = dto.email.toLowerCase().trim()

    // Cek apakah email sudah terdaftar
    const [existing] = await this.db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email))

    if (existing) {
      throw new ConflictException('Alamat email sudah terdaftar dalam sistem.')
    }

    // Verifikasi divisi ada
    const [division] = await this.db
      .select({ id: divisionsTable.id, name: divisionsTable.name })
      .from(divisionsTable)
      .where(eq(divisionsTable.id, dto.divisionId))

    if (!division) {
      throw new NotFoundException('Divisi yang dipilih tidak ditemukan.')
    }

    const userId = crypto.randomUUID()
    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 hari

    await this.db.transaction(async (tx) => {
      // 1. Buat User (passwordHash null sampai aktivasi)
      await tx.insert(usersTable).values({
        id: userId,
        email,
        name: dto.name.trim(),
        passwordHash: null,
        isSuperAdmin: false,
        status: 'ACTIVE',
      })

      // 2. Hubungkan ke Divisi dengan Role yang ditentukan
      await tx.insert(divisionMembersTable).values({
        id: crypto.randomUUID(),
        userId,
        divisionId: dto.divisionId,
        role: dto.role,
      })

      // 3. Terbitkan Token Aktivasi
      await tx.insert(authTokensTable).values({
        id: crypto.randomUUID(),
        userId,
        type: 'ACTIVATION',
        tokenHash,
        expiresAt,
      })
    })

    const activationUrl = `http://localhost:3001/activate?token=${rawToken}`
    this.logger.log(`📧 [EMAIL SIMULATION] Link Aktivasi Anggota untuk ${email}: ${activationUrl}`)

    return {
      success: true,
      message: `Anggota ${dto.name} berhasil didaftarkan ke divisi ${division.name}.`,
      user: {
        id: userId,
        name: dto.name.trim(),
        email,
        isSuperAdmin: false,
        status: 'ACTIVE',
        isActivated: false,
        divisionId: dto.divisionId,
        divisionName: division.name,
        role: dto.role,
      },
      activationToken: rawToken,
      activationUrl,
    }
  }

  // ─── 2. Super Admin: Ambil Semua Anggota ─────────────────────────────────
  async findAll() {
    const users = await this.db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        isSuperAdmin: usersTable.isSuperAdmin,
        status: usersTable.status,
        passwordHash: usersTable.passwordHash,
        googleId: usersTable.googleId,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt))

    // Ambil seluruh membership divisi
    const memberships = await this.db
      .select({
        userId: divisionMembersTable.userId,
        divisionId: divisionMembersTable.divisionId,
        role: divisionMembersTable.role,
        divisionName: divisionsTable.name,
        divisionSlug: divisionsTable.slug,
      })
      .from(divisionMembersTable)
      .innerJoin(divisionsTable, eq(divisionMembersTable.divisionId, divisionsTable.id))

    const memberMap = new Map<string, typeof memberships>()
    for (const m of memberships) {
      const list = memberMap.get(m.userId) || []
      list.push(m)
      memberMap.set(m.userId, list)
    }

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      isSuperAdmin: u.isSuperAdmin,
      status: u.status,
      isActivated: u.passwordHash !== null || u.googleId !== null,
      createdAt: u.createdAt,
      divisions: memberMap.get(u.id) || [],
    }))
  }

  // ─── 3. Super Admin: Ubah Status (Aktif / Nonaktif) ──────────────────────
  async updateStatus(userId: string, status: 'ACTIVE' | 'INACTIVE') {
    const [user] = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))

    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan.')
    }

    if (user.isSuperAdmin && status === 'INACTIVE') {
      throw new BadRequestException('Akun Super Admin tidak dapat dinonaktifkan.')
    }

    await this.db
      .update(usersTable)
      .set({ status })
      .where(eq(usersTable.id, userId))

    // PRD: Akun nonaktif dicabut semua sesinya
    if (status === 'INACTIVE') {
      await this.db
        .update(sessionsTable)
        .set({ revokedAt: new Date() })
        .where(and(eq(sessionsTable.userId, userId), isNull(sessionsTable.revokedAt)))
    }

    return {
      success: true,
      message: `Status pengguna berhasil diubah menjadi ${status}.`,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        status,
      },
    }
  }

  // ─── 4. Super Admin: Kirim Ulang Link Aktivasi ───────────────────────────
  async resendActivation(userId: string) {
    const [user] = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))

    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan.')
    }

    if (user.passwordHash !== null) {
      throw new BadRequestException('Akun ini sudah diaktivasi sebelumnya.')
    }

    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    // Buat token aktivasi baru
    await this.db.insert(authTokensTable).values({
      id: crypto.randomUUID(),
      userId: user.id,
      type: 'ACTIVATION',
      tokenHash,
      expiresAt,
    })

    const activationUrl = `http://localhost:3001/activate?token=${rawToken}`
    this.logger.log(`📧 [EMAIL SIMULATION] Link Aktivasi Ulang untuk ${user.email}: ${activationUrl}`)

    return {
      success: true,
      message: `Tautan aktivasi baru telah dibuat untuk ${user.email}.`,
      activationToken: rawToken,
      activationUrl,
    }
  }
}
