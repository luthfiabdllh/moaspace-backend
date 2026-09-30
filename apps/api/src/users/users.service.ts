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
import { ActivityLogsService } from '../activity-logs/activity-logs.service.js'
import {
  DATABASE_CONNECTION,
  type Database,
} from '../database/database.provider.js'
import type { AddUserDivisionDto } from './dto/add-user-division.dto.js'
import type { CreateUserDto } from './dto/create-user.dto.js'
import type { MoveUserDivisionDto } from './dto/move-user-division.dto.js'
import type { UpdateUserDivisionRoleDto } from './dto/update-user-division-role.dto.js'
import type { UpdateUserGlobalRoleDto } from './dto/update-user-global-role.dto.js'

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name)

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  // ─── 1. Super Admin & Koordinator Mahasiswa Unit: Daftarkan Anggota Baru ──
  async create(dto: CreateUserDto, actorId?: string) {
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

    const isKormanit =
      dto.role === 'KORMANIT' || dto.role === 'KOORDINATOR_MAHASISWA_UNIT'
    const divisionRole: 'MEMBER' | 'COORDINATOR' =
      dto.role === 'COORDINATOR' ? 'COORDINATOR' : dto.role === 'MEMBER' ? 'MEMBER' : 'COORDINATOR'

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
        isKormanit,
        status: 'ACTIVE',
      })

      // 2. Hubungkan ke Divisi dengan Role yang ditentukan
      await tx.insert(divisionMembersTable).values({
        id: crypto.randomUUID(),
        userId,
        divisionId: dto.divisionId,
        role: divisionRole,
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

    // Catat activity log
    await this.activityLogsService.record({
      entityType: 'USER',
      entityId: userId,
      action: 'USER_CREATED',
      actorId,
      after: {
        id: userId,
        name: dto.name.trim(),
        email,
        divisionId: dto.divisionId,
        divisionName: division.name,
        role: dto.role,
        isKormanit,
      },
    })

    const activationUrl = `http://localhost:3001/activate?token=${rawToken}`
    this.logger.log(`📧 [EMAIL SIMULATION] Link Aktivasi Anggota untuk ${email}: ${activationUrl}`)

    return {
      success: true,
      message: `Anggota ${dto.name} berhasil didaftarkan${isKormanit ? ' sebagai Koordinator Mahasiswa Unit' : ''} ke divisi ${division.name}.`,
      user: {
        id: userId,
        name: dto.name.trim(),
        email,
        isSuperAdmin: false,
        isKormanit,
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

  // ─── 2. Super Admin & Koordinator Mahasiswa Unit: Ambil Semua Anggota ──────
  async findAll() {
    const users = await this.db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        isSuperAdmin: usersTable.isSuperAdmin,
        isKormanit: usersTable.isKormanit,
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
        id: divisionMembersTable.id,
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
      isKormanit: u.isKormanit,
      status: u.status,
      isActivated: u.passwordHash !== null || u.googleId !== null,
      createdAt: u.createdAt,
      divisions: memberMap.get(u.id) || [],
    }))
  }

  // ─── 3. Super Admin & Koordinator Mahasiswa Unit: Ubah Status ───────────────
  async updateStatus(
    userId: string,
    status: 'ACTIVE' | 'INACTIVE',
    actorId?: string,
  ) {
    const [user] = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))

    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan.')
    }

    if ((user.isSuperAdmin || user.isKormanit) && status === 'INACTIVE') {
      throw new BadRequestException('Akun Super Admin atau Koordinator Mahasiswa Unit tidak dapat dinonaktifkan.')
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

    await this.activityLogsService.record({
      entityType: 'USER',
      entityId: userId,
      action: 'STATUS_UPDATED',
      actorId,
      before: { status: user.status },
      after: { status },
    })

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

  // ─── 4. Tambah Anggota ke Divisi Lain (Multi-Divisi) ──────────────────────
  async addDivision(
    userId: string,
    dto: AddUserDivisionDto,
    actorId?: string,
  ) {
    const [user] = await this.db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, userId))

    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan.')
    }

    const [division] = await this.db
      .select({ id: divisionsTable.id, name: divisionsTable.name })
      .from(divisionsTable)
      .where(eq(divisionsTable.id, dto.divisionId))

    if (!division) {
      throw new NotFoundException('Divisi tidak ditemukan.')
    }

    const [existingMember] = await this.db
      .select({ id: divisionMembersTable.id })
      .from(divisionMembersTable)
      .where(
        and(
          eq(divisionMembersTable.userId, userId),
          eq(divisionMembersTable.divisionId, dto.divisionId),
        ),
      )

    if (existingMember) {
      throw new ConflictException('Anggota sudah terdaftar di divisi ini.')
    }

    const membershipId = crypto.randomUUID()
    await this.db.insert(divisionMembersTable).values({
      id: membershipId,
      userId,
      divisionId: dto.divisionId,
      role: dto.role,
    })

    await this.activityLogsService.record({
      entityType: 'USER',
      entityId: userId,
      action: 'DIVISION_ADDED',
      actorId,
      after: {
        divisionId: dto.divisionId,
        divisionName: division.name,
        role: dto.role,
      },
    })

    return {
      success: true,
      message: `Anggota ${user.name} berhasil ditambahkan ke divisi ${division.name} sebagai ${dto.role === 'COORDINATOR' ? 'Koordinator' : 'Anggota'}.`,
      membership: {
        id: membershipId,
        userId,
        divisionId: dto.divisionId,
        divisionName: division.name,
        role: dto.role,
      },
    }
  }

  // ─── 5. Ubah Role Anggota di Divisi Tertentu ──────────────────────────────
  async updateDivisionRole(
    userId: string,
    divisionId: string,
    dto: UpdateUserDivisionRoleDto,
    actorId?: string,
  ) {
    const [user] = await this.db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, userId))

    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan.')
    }

    const [membership] = await this.db
      .select({
        id: divisionMembersTable.id,
        role: divisionMembersTable.role,
        divisionName: divisionsTable.name,
      })
      .from(divisionMembersTable)
      .innerJoin(divisionsTable, eq(divisionMembersTable.divisionId, divisionsTable.id))
      .where(
        and(
          eq(divisionMembersTable.userId, userId),
          eq(divisionMembersTable.divisionId, divisionId),
        ),
      )

    if (!membership) {
      throw new NotFoundException('Keanggotaan divisi tidak ditemukan.')
    }

    if (membership.role === dto.role) {
      return {
        success: true,
        message: `Role anggota di divisi ${membership.divisionName} sudah ${dto.role}.`,
      }
    }

    await this.db
      .update(divisionMembersTable)
      .set({ role: dto.role })
      .where(eq(divisionMembersTable.id, membership.id))

    await this.activityLogsService.record({
      entityType: 'USER',
      entityId: userId,
      action: 'ROLE_CHANGED',
      actorId,
      before: {
        divisionId,
        divisionName: membership.divisionName,
        role: membership.role,
      },
      after: {
        divisionId,
        divisionName: membership.divisionName,
        role: dto.role,
      },
    })

    return {
      success: true,
      message: `Role ${user.name} di divisi ${membership.divisionName} berhasil diubah menjadi ${dto.role === 'COORDINATOR' ? 'Koordinator' : 'Anggota'}.`,
    }
  }

  // ─── 6. Hapus Keanggotaan dari Suatu Divisi ───────────────────────────────
  async removeDivision(
    userId: string,
    divisionId: string,
    actorId?: string,
  ) {
    const [user] = await this.db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        isSuperAdmin: usersTable.isSuperAdmin,
        isKormanit: usersTable.isKormanit,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))

    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan.')
    }

    const memberships = await this.db
      .select({
        id: divisionMembersTable.id,
        divisionId: divisionMembersTable.divisionId,
        role: divisionMembersTable.role,
        divisionName: divisionsTable.name,
      })
      .from(divisionMembersTable)
      .innerJoin(divisionsTable, eq(divisionMembersTable.divisionId, divisionsTable.id))
      .where(eq(divisionMembersTable.userId, userId))

    const target = memberships.find((m) => m.divisionId === divisionId)
    if (!target) {
      throw new NotFoundException('Keanggotaan divisi tidak ditemukan.')
    }

    if (memberships.length <= 1 && !user.isSuperAdmin && !user.isKormanit) {
      throw new BadRequestException(
        'Anggota harus memiliki setidaknya satu divisi. Gunakan fitur pindah divisi jika ingin mengganti divisi.',
      )
    }

    await this.db
      .delete(divisionMembersTable)
      .where(eq(divisionMembersTable.id, target.id))

    await this.activityLogsService.record({
      entityType: 'USER',
      entityId: userId,
      action: 'DIVISION_REMOVED',
      actorId,
      before: {
        divisionId,
        divisionName: target.divisionName,
        role: target.role,
      },
    })

    return {
      success: true,
      message: `Anggota ${user.name} berhasil dihapus dari divisi ${target.divisionName}.`,
    }
  }

  // ─── 7. Pindahkan Anggota dari Satu Divisi ke Divisi Lain ──────────────────
  async moveDivision(
    userId: string,
    dto: MoveUserDivisionDto,
    actorId?: string,
  ) {
    if (dto.fromDivisionId === dto.toDivisionId) {
      throw new BadRequestException('Divisi asal dan tujuan tidak boleh sama.')
    }

    const [user] = await this.db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, userId))

    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan.')
    }

    const [fromMembership] = await this.db
      .select({
        id: divisionMembersTable.id,
        role: divisionMembersTable.role,
        divisionName: divisionsTable.name,
      })
      .from(divisionMembersTable)
      .innerJoin(divisionsTable, eq(divisionMembersTable.divisionId, divisionsTable.id))
      .where(
        and(
          eq(divisionMembersTable.userId, userId),
          eq(divisionMembersTable.divisionId, dto.fromDivisionId),
        ),
      )

    if (!fromMembership) {
      throw new NotFoundException('Keanggotaan di divisi asal tidak ditemukan.')
    }

    const [toDivision] = await this.db
      .select({ id: divisionsTable.id, name: divisionsTable.name })
      .from(divisionsTable)
      .where(eq(divisionsTable.id, dto.toDivisionId))

    if (!toDivision) {
      throw new NotFoundException('Divisi tujuan tidak ditemukan.')
    }

    const [existingInTo] = await this.db
      .select({ id: divisionMembersTable.id })
      .from(divisionMembersTable)
      .where(
        and(
          eq(divisionMembersTable.userId, userId),
          eq(divisionMembersTable.divisionId, dto.toDivisionId),
        ),
      )

    if (existingInTo) {
      throw new ConflictException('Anggota sudah terdaftar di divisi tujuan.')
    }

    const newRole = dto.role ?? fromMembership.role

    await this.db.transaction(async (tx) => {
      await tx
        .delete(divisionMembersTable)
        .where(eq(divisionMembersTable.id, fromMembership.id))

      await tx.insert(divisionMembersTable).values({
        id: crypto.randomUUID(),
        userId,
        divisionId: dto.toDivisionId,
        role: newRole,
      })
    })

    await this.activityLogsService.record({
      entityType: 'USER',
      entityId: userId,
      action: 'DIVISION_MOVED',
      actorId,
      before: {
        divisionId: dto.fromDivisionId,
        divisionName: fromMembership.divisionName,
        role: fromMembership.role,
      },
      after: {
        divisionId: dto.toDivisionId,
        divisionName: toDivision.name,
        role: newRole,
      },
    })

    return {
      success: true,
      message: `Anggota ${user.name} berhasil dipindahkan dari divisi ${fromMembership.divisionName} ke ${toDivision.name}.`,
    }
  }

  // ─── 8. Ubah Hak Akses Koordinator Mahasiswa Unit ───────────────────────────
  async updateGlobalRole(
    userId: string,
    dto: UpdateUserGlobalRoleDto,
    actorId?: string,
  ) {
    const [user] = await this.db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        isSuperAdmin: usersTable.isSuperAdmin,
        isKormanit: usersTable.isKormanit,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))

    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan.')
    }

    if (user.isSuperAdmin) {
      throw new BadRequestException('Hak akses Super Admin tidak dapat diubah.')
    }

    if (user.isKormanit === dto.isKormanit) {
      return {
        success: true,
        message: 'Peran Koordinator Mahasiswa Unit tidak berubah.',
      }
    }

    await this.db
      .update(usersTable)
      .set({ isKormanit: dto.isKormanit })
      .where(eq(usersTable.id, userId))

    await this.activityLogsService.record({
      entityType: 'USER',
      entityId: userId,
      action: 'GLOBAL_ROLE_CHANGED',
      actorId,
      before: { isKormanit: user.isKormanit },
      after: { isKormanit: dto.isKormanit },
    })

    return {
      success: true,
      message: dto.isKormanit
        ? `Pengguna ${user.name} kini memiliki peran Koordinator Mahasiswa Unit.`
        : `Akses Koordinator Mahasiswa Unit untuk ${user.name} telah dicabut.`,
      user: {
        id: user.id,
        name: user.name,
        isKormanit: dto.isKormanit,
      },
    }
  }

  // ─── 9. Kirim Ulang Link Aktivasi ───────────────────────────────────────────
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
