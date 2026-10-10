import crypto from 'node:crypto'
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, asc, eq } from 'drizzle-orm'
import {
  subunitMembersTable,
  subunitsTable,
  usersTable,
  type Subunit,
} from '@moaspace/database'
import { DATABASE_CONNECTION, type Database } from '../database/database.provider.js'
import { ActivityLogsService } from '../activity-logs/activity-logs.service.js'
import type { CreateSubunitDto } from './dto/create-subunit.dto.js'
import type { UpdateSubunitDto } from './dto/update-subunit.dto.js'
import type { AddSubunitMemberDto } from './dto/add-subunit-member.dto.js'
import type { UpdateSubunitMemberRoleDto } from './dto/update-subunit-member-role.dto.js'

@Injectable()
export class SubunitsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  // ─── 1. Ambil Semua Subunit Beserta Anggota & Kormasit ──────────────────────
  async findAll() {
    const subunits = await this.db
      .select({
        id: subunitsTable.id,
        name: subunitsTable.name,
        slug: subunitsTable.slug,
        location: subunitsTable.location,
        description: subunitsTable.description,
        createdAt: subunitsTable.createdAt,
      })
      .from(subunitsTable)
      .orderBy(asc(subunitsTable.name))

    const allMembers = await this.db
      .select({
        subunitId: subunitMembersTable.subunitId,
        userId: subunitMembersTable.userId,
        role: subunitMembersTable.role,
        userName: usersTable.name,
        userEmail: usersTable.email,
        userCluster: usersTable.cluster,
        isClusterCoordinator: usersTable.isClusterCoordinator,
        userStatus: usersTable.status,
      })
      .from(subunitMembersTable)
      .innerJoin(usersTable, eq(subunitMembersTable.userId, usersTable.id))
      .where(eq(usersTable.status, 'ACTIVE'))

    return subunits.map((sub) => {
      const subMembers = allMembers.filter((m) => m.subunitId === sub.id)
      const coordinators = subMembers
        .filter((m) => m.role === 'COORDINATOR')
        .map((m) => ({
          id: m.userId,
          name: m.userName,
          email: m.userEmail,
          cluster: m.userCluster,
          isClusterCoordinator: m.isClusterCoordinator,
        }))

      return {
        ...sub,
        memberCount: subMembers.length,
        coordinators,
      }
    })
  }

  // ─── 2. Ambil Detail Subunit Berdasarkan ID atau Slug ───────────────────────
  async findOne(idOrSlug: string) {
    let [subunit] = await this.db
      .select()
      .from(subunitsTable)
      .where(eq(subunitsTable.id, idOrSlug))

    if (!subunit) {
      ;[subunit] = await this.db
        .select()
        .from(subunitsTable)
        .where(eq(subunitsTable.slug, idOrSlug))
    }

    if (!subunit) {
      throw new NotFoundException(`Subunit '${idOrSlug}' tidak ditemukan.`)
    }

    const members = await this.db
      .select({
        id: subunitMembersTable.id,
        userId: subunitMembersTable.userId,
        userName: usersTable.name,
        userEmail: usersTable.email,
        userStatus: usersTable.status,
        cluster: usersTable.cluster,
        isClusterCoordinator: usersTable.isClusterCoordinator,
        role: subunitMembersTable.role,
        joinedAt: subunitMembersTable.createdAt,
      })
      .from(subunitMembersTable)
      .innerJoin(usersTable, eq(subunitMembersTable.userId, usersTable.id))
      .where(
        and(
          eq(subunitMembersTable.subunitId, subunit.id),
          eq(usersTable.status, 'ACTIVE'),
        ),
      )
      .orderBy(asc(usersTable.name))

    return {
      ...subunit,
      members,
      memberCount: members.length,
    }
  }

  // ─── 3. Buat Subunit Baru ───────────────────────────────────────────────────
  async create(dto: CreateSubunitDto, actorId?: string): Promise<Subunit> {
    const slug = dto.slug
      ? dto.slug.trim().toLowerCase()
      : this.slugify(dto.name)

    const [existing] = await this.db
      .select({ id: subunitsTable.id })
      .from(subunitsTable)
      .where(eq(subunitsTable.slug, slug))

    if (existing) {
      throw new ConflictException(`Slug '${slug}' sudah digunakan oleh subunit lain.`)
    }

    const subunitId = crypto.randomUUID()
    const [created] = await this.db
      .insert(subunitsTable)
      .values({
        id: subunitId,
        name: dto.name.trim(),
        slug,
        location: dto.location?.trim() || null,
        description: dto.description?.trim() || null,
      })
      .returning()

    if (!created) {
      throw new Error('Gagal membuat subunit baru.')
    }

    await this.activityLogsService.record({
      entityType: 'USER',
      entityId: subunitId,
      action: 'STATUS_UPDATED',
      actorId,
      after: { name: created.name, slug: created.slug, location: created.location },
    })

    return created
  }

  // ─── 4. Perbarui Subunit ───────────────────────────────────────────────────
  async update(id: string, dto: UpdateSubunitDto, actorId?: string): Promise<Subunit> {
    const [subunit] = await this.db
      .select()
      .from(subunitsTable)
      .where(eq(subunitsTable.id, id))

    if (!subunit) {
      throw new NotFoundException('Subunit tidak ditemukan.')
    }

    const updateData: Partial<typeof subunitsTable.$inferInsert> = {}
    if (dto.name !== undefined) updateData.name = dto.name.trim()
    if (dto.location !== undefined) updateData.location = dto.location.trim() || null
    if (dto.description !== undefined) updateData.description = dto.description.trim() || null

    const [updated] = await this.db
      .update(subunitsTable)
      .set(updateData)
      .where(eq(subunitsTable.id, id))
      .returning()

    if (!updated) {
      throw new Error('Gagal memperbarui subunit.')
    }

    await this.activityLogsService.record({
      entityType: 'USER',
      entityId: id,
      action: 'STATUS_UPDATED',
      actorId,
      before: { name: subunit.name, location: subunit.location },
      after: { name: updated.name, location: updated.location },
    })

    return updated
  }

  // ─── 5. Hapus Subunit ───────────────────────────────────────────────────────
  async remove(id: string, actorId?: string) {
    const [subunit] = await this.db
      .select()
      .from(subunitsTable)
      .where(eq(subunitsTable.id, id))

    if (!subunit) {
      throw new NotFoundException('Subunit tidak ditemukan.')
    }

    await this.db.delete(subunitsTable).where(eq(subunitsTable.id, id))

    await this.activityLogsService.record({
      entityType: 'USER',
      entityId: id,
      action: 'STATUS_UPDATED',
      actorId,
      before: { name: subunit.name, slug: subunit.slug },
      after: null,
    })

    return {
      success: true,
      message: `Subunit '${subunit.name}' berhasil dihapus.`,
    }
  }

  // ─── 6. Tambah Anggota ke Subunit ──────────────────────────────────────────
  async addMember(subunitId: string, dto: AddSubunitMemberDto, actorId?: string) {
    const [subunit] = await this.db
      .select()
      .from(subunitsTable)
      .where(eq(subunitsTable.id, subunitId))

    if (!subunit) {
      throw new NotFoundException('Subunit tidak ditemukan.')
    }

    const [user] = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, dto.userId))

    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan.')
    }

    if (user.status !== 'ACTIVE') {
      throw new BadRequestException('Akun berstatus nonaktif tidak dapat ditambahkan ke subunit.')
    }

    // Periksa apakah pengguna sudah tergabung di subunit manapun (1 mahasiswa = 1 subunit)
    const [existingMembership] = await this.db
      .select({
        id: subunitMembersTable.id,
        subunitId: subunitMembersTable.subunitId,
        subunitName: subunitsTable.name,
      })
      .from(subunitMembersTable)
      .innerJoin(subunitsTable, eq(subunitMembersTable.subunitId, subunitsTable.id))
      .where(eq(subunitMembersTable.userId, dto.userId))

    if (existingMembership) {
      if (existingMembership.subunitId === subunitId) {
        throw new ConflictException('Pengguna sudah menjadi anggota subunit ini.')
      }
      throw new ConflictException(
        `Pengguna sudah terdaftar di '${existingMembership.subunitName}'. Mahasiswa KKN hanya dapat ditempatkan di 1 subunit posko.`,
      )
    }

    const memberId = crypto.randomUUID()
    await this.db.insert(subunitMembersTable).values({
      id: memberId,
      userId: dto.userId,
      subunitId,
      role: dto.role,
    })

    await this.activityLogsService.record({
      entityType: 'USER',
      entityId: dto.userId,
      action: 'STATUS_UPDATED',
      actorId,
      after: {
        subunitId,
        subunitName: subunit.name,
        role: dto.role,
      },
    })

    return {
      success: true,
      message: `${user.name} berhasil ditambahkan ke subunit ${subunit.name} sebagai ${dto.role === 'COORDINATOR' ? 'Koordinator Subunit (Kormasit)' : 'Anggota'}.`,
      member: {
        id: memberId,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        role: dto.role,
        subunitId,
        subunitName: subunit.name,
      },
    }
  }

  // ─── 7. Ubah Role Anggota di Subunit (Anggota <-> Kormasit) ────────────────
  async updateMemberRole(
    subunitId: string,
    userId: string,
    dto: UpdateSubunitMemberRoleDto,
    actorId?: string,
  ) {
    const [subunit] = await this.db
      .select()
      .from(subunitsTable)
      .where(eq(subunitsTable.id, subunitId))

    if (!subunit) {
      throw new NotFoundException('Subunit tidak ditemukan.')
    }

    const [user] = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))

    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan.')
    }

    const [membership] = await this.db
      .select()
      .from(subunitMembersTable)
      .where(
        and(
          eq(subunitMembersTable.subunitId, subunitId),
          eq(subunitMembersTable.userId, userId),
        ),
      )

    if (!membership) {
      throw new NotFoundException('Anggota tidak terdaftar di subunit ini.')
    }

    if (membership.role === dto.role) {
      return {
        success: true,
        message: `Role anggota di subunit sudah ${dto.role}.`,
      }
    }

    await this.db
      .update(subunitMembersTable)
      .set({ role: dto.role })
      .where(eq(subunitMembersTable.id, membership.id))

    await this.activityLogsService.record({
      entityType: 'USER',
      entityId: userId,
      action: 'ROLE_CHANGED',
      actorId,
      before: { subunitId, role: membership.role },
      after: { subunitId, role: dto.role },
    })

    return {
      success: true,
      message: `Peran ${user.name} berhasil diubah menjadi ${dto.role === 'COORDINATOR' ? 'Koordinator Subunit (Kormasit)' : 'Anggota Subunit'}.`,
    }
  }

  // ─── 8. Hapus Anggota dari Subunit ──────────────────────────────────────────
  async removeMember(subunitId: string, userId: string, actorId?: string) {
    const [subunit] = await this.db
      .select()
      .from(subunitsTable)
      .where(eq(subunitsTable.id, subunitId))

    if (!subunit) {
      throw new NotFoundException('Subunit tidak ditemukan.')
    }

    const [user] = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))

    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan.')
    }

    const [membership] = await this.db
      .select()
      .from(subunitMembersTable)
      .where(
        and(
          eq(subunitMembersTable.subunitId, subunitId),
          eq(subunitMembersTable.userId, userId),
        ),
      )

    if (!membership) {
      throw new NotFoundException('Anggota tidak terdaftar di subunit ini.')
    }

    await this.db
      .delete(subunitMembersTable)
      .where(eq(subunitMembersTable.id, membership.id))

    await this.activityLogsService.record({
      entityType: 'USER',
      entityId: userId,
      action: 'STATUS_UPDATED',
      actorId,
      before: { subunitId, role: membership.role },
      after: null,
    })

    return {
      success: true,
      message: `${user.name} berhasil dihapus dari subunit ${subunit.name}.`,
    }
  }

  // ─── Helper: Slugify ───────────────────────────────────────────────────────
  private slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')
      .replace(/--+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '')
  }
}
