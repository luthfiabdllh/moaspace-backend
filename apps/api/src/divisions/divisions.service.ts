import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, asc, eq } from 'drizzle-orm'
import {
  divisionMembersTable,
  divisionsTable,
  usersTable,
  type Division,
} from '@moaspace/database'
import { DATABASE_CONNECTION, type Database } from '../database/database.provider.js'
import { ActivityLogsService } from '../activity-logs/activity-logs.service.js'
import type { CreateDivisionDto } from './dto/create-division.dto.js'
import type { UpdateDivisionDto } from './dto/update-division.dto.js'
import type { AddDivisionMemberDto } from './dto/add-division-member.dto.js'
import type { UpdateDivisionMemberRoleDto } from './dto/update-division-member-role.dto.js'

@Injectable()
export class DivisionsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  // ─── 1. Ambil Semua Divisi Beserta Anggota & Koordinator ─────────────────────
  async findAll() {
    const divisions = await this.db
      .select({
        id: divisionsTable.id,
        name: divisionsTable.name,
        slug: divisionsTable.slug,
        requestApprovalEnabled: divisionsTable.requestApprovalEnabled,
        createdAt: divisionsTable.createdAt,
      })
      .from(divisionsTable)
      .orderBy(asc(divisionsTable.name))

    const allMembers = await this.db
      .select({
        divisionId: divisionMembersTable.divisionId,
        userId: divisionMembersTable.userId,
        role: divisionMembersTable.role,
        userName: usersTable.name,
        userEmail: usersTable.email,
        userStatus: usersTable.status,
      })
      .from(divisionMembersTable)
      .innerJoin(usersTable, eq(divisionMembersTable.userId, usersTable.id))
      .where(eq(usersTable.status, 'ACTIVE'))

    return divisions.map((div) => {
      const divMembers = allMembers.filter((m) => m.divisionId === div.id)
      const coordinators = divMembers
        .filter((m) => m.role === 'COORDINATOR')
        .map((m) => ({
          id: m.userId,
          name: m.userName,
          email: m.userEmail,
        }))

      return {
        ...div,
        memberCount: divMembers.length,
        coordinators,
      }
    })
  }

  // ─── 2. Ambil Detail Divisi Berdasarkan ID atau Slug ───────────────────────
  async findOne(idOrSlug: string) {
    let [division] = await this.db
      .select()
      .from(divisionsTable)
      .where(eq(divisionsTable.id, idOrSlug))

    if (!division) {
      ;[division] = await this.db
        .select()
        .from(divisionsTable)
        .where(eq(divisionsTable.slug, idOrSlug))
    }

    if (!division) {
      throw new NotFoundException('Divisi tidak ditemukan.')
    }

    const members = await this.db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        status: usersTable.status,
        role: divisionMembersTable.role,
        joinedAt: divisionMembersTable.createdAt,
      })
      .from(divisionMembersTable)
      .innerJoin(usersTable, eq(divisionMembersTable.userId, usersTable.id))
      .where(
        and(
          eq(divisionMembersTable.divisionId, division.id),
          eq(usersTable.status, 'ACTIVE'),
        ),
      )
      .orderBy(asc(usersTable.name))

    return {
      ...division,
      members,
      memberCount: members.length,
    }
  }

  // ─── 3. Buat Divisi Baru ───────────────────────────────────────────────────
  async create(dto: CreateDivisionDto, actorId?: string): Promise<Division> {
    const slug = dto.slug
      ? dto.slug.trim().toLowerCase()
      : this.slugify(dto.name)

    const [existing] = await this.db
      .select({ id: divisionsTable.id })
      .from(divisionsTable)
      .where(eq(divisionsTable.slug, slug))

    if (existing) {
      throw new ConflictException(`Slug '${slug}' sudah digunakan oleh divisi lain.`)
    }

    const divisionId = crypto.randomUUID()
    const [created] = await this.db
      .insert(divisionsTable)
      .values({
        id: divisionId,
        name: dto.name.trim(),
        slug,
        requestApprovalEnabled: dto.requestApprovalEnabled ?? false,
      })
      .returning()

    if (!created) {
      throw new Error('Gagal membuat divisi baru.')
    }

    await this.activityLogsService.record({
      entityType: 'DIVISION',
      entityId: created.id,
      action: 'DIVISION_CREATED',
      actorId,
      before: null,
      after: {
        id: created.id,
        name: created.name,
        slug: created.slug,
        requestApprovalEnabled: created.requestApprovalEnabled,
      },
    })

    return created
  }

  // ─── 4. Perbarui Informasi Divisi ──────────────────────────────────────────
  async update(
    id: string,
    dto: UpdateDivisionDto,
    actorId?: string,
  ): Promise<Division> {
    const [existing] = await this.db
      .select()
      .from(divisionsTable)
      .where(eq(divisionsTable.id, id))

    if (!existing) {
      throw new NotFoundException('Divisi tidak ditemukan.')
    }

    const updates: Partial<typeof divisionsTable.$inferInsert> = {}

    if (dto.name !== undefined) {
      updates.name = dto.name.trim()
    }

    if (dto.slug !== undefined) {
      const cleanSlug = dto.slug.trim().toLowerCase()
      if (cleanSlug !== existing.slug) {
        const [conflict] = await this.db
          .select({ id: divisionsTable.id })
          .from(divisionsTable)
          .where(eq(divisionsTable.slug, cleanSlug))

        if (conflict) {
          throw new ConflictException(
            `Slug '${cleanSlug}' sudah digunakan oleh divisi lain.`,
          )
        }
        updates.slug = cleanSlug
      }
    }

    if (dto.requestApprovalEnabled !== undefined) {
      updates.requestApprovalEnabled = dto.requestApprovalEnabled
    }

    if (Object.keys(updates).length === 0) {
      return existing
    }

    const [updated] = await this.db
      .update(divisionsTable)
      .set(updates)
      .where(eq(divisionsTable.id, id))
      .returning()

    if (!updated) {
      throw new Error('Gagal memperbarui divisi.')
    }

    await this.activityLogsService.record({
      entityType: 'DIVISION',
      entityId: id,
      action: 'DIVISION_UPDATED',
      actorId,
      before: {
        name: existing.name,
        slug: existing.slug,
        requestApprovalEnabled: existing.requestApprovalEnabled,
      },
      after: {
        name: updated.name,
        slug: updated.slug,
        requestApprovalEnabled: updated.requestApprovalEnabled,
      },
    })

    return updated
  }

  // ─── 5. Tambah Anggota ke Divisi ───────────────────────────────────────────
  async addMember(
    divisionId: string,
    dto: AddDivisionMemberDto,
    actorId?: string,
  ) {
    const [division] = await this.db
      .select()
      .from(divisionsTable)
      .where(eq(divisionsTable.id, divisionId))

    if (!division) {
      throw new NotFoundException('Divisi tidak ditemukan.')
    }

    const [user] = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, dto.userId))

    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan.')
    }

    const [existingMember] = await this.db
      .select()
      .from(divisionMembersTable)
      .where(
        and(
          eq(divisionMembersTable.divisionId, divisionId),
          eq(divisionMembersTable.userId, dto.userId),
        ),
      )

    if (existingMember) {
      throw new ConflictException('Pengguna sudah menjadi anggota divisi ini.')
    }

    const memberId = crypto.randomUUID()
    await this.db.insert(divisionMembersTable).values({
      id: memberId,
      divisionId,
      userId: dto.userId,
      role: dto.role,
    })

    await this.activityLogsService.record({
      entityType: 'USER',
      entityId: dto.userId,
      action: 'DIVISION_ADDED',
      actorId,
      before: null,
      after: {
        divisionId,
        divisionName: division.name,
        role: dto.role,
      },
    })

    return {
      success: true,
      message: `${user.name} berhasil ditambahkan ke divisi ${division.name}.`,
    }
  }

  // ─── 6. Ubah Peran Anggota dalam Divisi ─────────────────────────────────────
  async updateMemberRole(
    divisionId: string,
    userId: string,
    dto: UpdateDivisionMemberRoleDto,
    actorId?: string,
  ) {
    const [membership] = await this.db
      .select({
        id: divisionMembersTable.id,
        currentRole: divisionMembersTable.role,
        divisionName: divisionsTable.name,
        userName: usersTable.name,
      })
      .from(divisionMembersTable)
      .innerJoin(divisionsTable, eq(divisionMembersTable.divisionId, divisionsTable.id))
      .innerJoin(usersTable, eq(divisionMembersTable.userId, usersTable.id))
      .where(
        and(
          eq(divisionMembersTable.divisionId, divisionId),
          eq(divisionMembersTable.userId, userId),
        ),
      )

    if (!membership) {
      throw new NotFoundException('Anggota tidak terdaftar pada divisi ini.')
    }

    if (membership.currentRole === dto.role) {
      return { success: true, message: 'Peran anggota tidak berubah.' }
    }

    await this.db
      .update(divisionMembersTable)
      .set({ role: dto.role })
      .where(eq(divisionMembersTable.id, membership.id))

    await this.activityLogsService.record({
      entityType: 'USER',
      entityId: userId,
      action: 'DIVISION_ROLE_UPDATED',
      actorId,
      before: {
        divisionId,
        divisionName: membership.divisionName,
        role: membership.currentRole,
      },
      after: {
        divisionId,
        divisionName: membership.divisionName,
        role: dto.role,
      },
    })

    return {
      success: true,
      message: `Peran ${membership.userName} diubah menjadi ${dto.role === 'COORDINATOR' ? 'Koordinator' : 'Anggota'}.`,
    }
  }

  // ─── 7. Hapus Anggota dari Divisi ───────────────────────────────────────────
  async removeMember(divisionId: string, userId: string, actorId?: string) {
    const [membership] = await this.db
      .select({
        id: divisionMembersTable.id,
        role: divisionMembersTable.role,
        divisionName: divisionsTable.name,
        userName: usersTable.name,
      })
      .from(divisionMembersTable)
      .innerJoin(divisionsTable, eq(divisionMembersTable.divisionId, divisionsTable.id))
      .innerJoin(usersTable, eq(divisionMembersTable.userId, usersTable.id))
      .where(
        and(
          eq(divisionMembersTable.divisionId, divisionId),
          eq(divisionMembersTable.userId, userId),
        ),
      )

    if (!membership) {
      throw new NotFoundException('Anggota tidak terdaftar pada divisi ini.')
    }

    await this.db
      .delete(divisionMembersTable)
      .where(eq(divisionMembersTable.id, membership.id))

    await this.activityLogsService.record({
      entityType: 'USER',
      entityId: userId,
      action: 'DIVISION_REMOVED',
      actorId,
      before: {
        divisionId,
        divisionName: membership.divisionName,
        role: membership.role,
      },
      after: null,
    })

    return {
      success: true,
      message: `${membership.userName} berhasil dihapus dari divisi ${membership.divisionName}.`,
    }
  }

  // ─── Helper: Slugify ───────────────────────────────────────────────────────
  private slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-') // Ganti spasi dengan -
      .replace(/[^\w-]+/g, '') // Hapus karakter non-alphanumeric selain -
      .replace(/--+/g, '-') // Ganti multiple - dengan single -
      .replace(/^-+/, '') // Hapus - di awal
      .replace(/-+$/, '') // Hapus - di akhir
  }
}
