import crypto from 'node:crypto'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, desc, eq, ilike, inArray, or } from 'drizzle-orm'
import {
  divisionsTable,
  epicsTable,
  programMembersTable,
  programsTable,
  storiesTable,
  subunitMembersTable,
  subunitsTable,
  tasksTable,
  usersTable,
  type Program,
} from '@moaspace/database'
import { DATABASE_CONNECTION, type Database } from '../database/database.provider.js'
import { ActivityLogsService } from '../activity-logs/activity-logs.service.js'
import type { CreateProgramDto } from './dto/create-program.dto.js'
import type { UpdateProgramDto } from './dto/update-program.dto.js'
import type { ReviewProgramDto } from './dto/review-program.dto.js'
import type { AddProgramMemberDto } from './dto/add-program-member.dto.js'
import type { QueryProgramsDto } from './dto/query-programs.dto.js'

@Injectable()
export class ProgramsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  // ─── 1. Ambil Seluruh Program Kerja ──────────────────────────────────────────
  async findAll(query: QueryProgramsDto = {}) {
    const conditions = []

    if (query.scope) {
      conditions.push(eq(programsTable.scope, query.scope))
    }
    if (query.subunitId) {
      conditions.push(eq(programsTable.subunitId, query.subunitId))
    }
    if (query.cluster) {
      conditions.push(eq(programsTable.cluster, query.cluster))
    }
    if (query.status) {
      conditions.push(eq(programsTable.status, query.status))
    }
    if (query.primaryPicId) {
      conditions.push(eq(programsTable.primaryPicId, query.primaryPicId))
    }
    if (query.search) {
      const searchPattern = `%${query.search.trim()}%`
      conditions.push(
        or(
          ilike(programsTable.title, searchPattern),
          ilike(programsTable.description, searchPattern),
        ),
      )
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const programs = await this.db
      .select({
        id: programsTable.id,
        title: programsTable.title,
        description: programsTable.description,
        scope: programsTable.scope,
        subunitId: programsTable.subunitId,
        cluster: programsTable.cluster,
        primaryPicId: programsTable.primaryPicId,
        startDate: programsTable.startDate,
        endDate: programsTable.endDate,
        status: programsTable.status,
        clusterApprovalStatus: programsTable.clusterApprovalStatus,
        clusterApprovedById: programsTable.clusterApprovedById,
        clusterApprovedAt: programsTable.clusterApprovedAt,
        clusterRejectionReason: programsTable.clusterRejectionReason,
        governanceApprovalStatus: programsTable.governanceApprovalStatus,
        governanceApprovedById: programsTable.governanceApprovedById,
        governanceApprovedAt: programsTable.governanceApprovedAt,
        governanceRejectionReason: programsTable.governanceRejectionReason,
        createdById: programsTable.createdById,
        createdAt: programsTable.createdAt,
        updatedAt: programsTable.updatedAt,
      })
      .from(programsTable)
      .where(whereClause)
      .orderBy(desc(programsTable.createdAt))

    if (programs.length === 0) {
      return []
    }

    const programIds = programs.map((p) => p.id)

    // Ambil Subunits
    const subunits = await this.db
      .select({
        id: subunitsTable.id,
        name: subunitsTable.name,
        slug: subunitsTable.slug,
        location: subunitsTable.location,
      })
      .from(subunitsTable)

    const subunitMap = new Map(subunits.map((s) => [s.id, s]))

    // Ambil Pengguna (PIC, Reviewers, Members)
    const allUsers = await this.db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        cluster: usersTable.cluster,
        isClusterCoordinator: usersTable.isClusterCoordinator,
        status: usersTable.status,
      })
      .from(usersTable)

    const userMap = new Map(allUsers.map((u) => [u.id, u]))

    // Ambil Tim Pelaksana
    const allMembers = await this.db
      .select({
        id: programMembersTable.id,
        programId: programMembersTable.programId,
        userId: programMembersTable.userId,
        role: programMembersTable.role,
      })
      .from(programMembersTable)
      .where(inArray(programMembersTable.programId, programIds))

    // Ambil Epics yang terkait
    const allEpics = await this.db
      .select({
        id: epicsTable.id,
        programId: epicsTable.programId,
        title: epicsTable.title,
        closedAt: epicsTable.closedAt,
      })
      .from(epicsTable)
      .where(inArray(epicsTable.programId, programIds))

    // Ambil Tasks dari Epics tersebut untuk progres agregat
    const epicIds = allEpics.map((e) => e.id)
    let epicTasks: {
      id: string
      epicId: string | null
      status: string
      storyPoints: number | null
    }[] = []

    if (epicIds.length > 0) {
      const stories = await this.db
        .select({
          id: storiesTable.id,
          epicId: storiesTable.epicId,
        })
        .from(storiesTable)
        .where(inArray(storiesTable.epicId, epicIds))

      const storyIds = stories.map((s) => s.id)
      const storyEpicMap = new Map(stories.map((s) => [s.id, s.epicId]))

      if (storyIds.length > 0) {
        const rawTasks = await this.db
          .select({
            id: tasksTable.id,
            storyId: tasksTable.storyId,
            status: tasksTable.status,
            storyPoints: tasksTable.storyPoints,
          })
          .from(tasksTable)
          .where(inArray(tasksTable.storyId, storyIds))

        epicTasks = rawTasks.map((t) => ({
          id: t.id,
          epicId: storyEpicMap.get(t.storyId) || null,
          status: t.status,
          storyPoints: t.storyPoints,
        }))
      }
    }

    return programs.map((prog) => {
      const progMembers = allMembers
        .filter((m) => m.programId === prog.id)
        .map((m) => {
          const user = userMap.get(m.userId)
          return {
            id: m.id,
            userId: m.userId,
            role: m.role,
            user: user || null,
          }
        })

      const progEpics = allEpics.filter((e) => e.programId === prog.id)
      const progEpicIds = new Set(progEpics.map((e) => e.id))
      const progTasks = epicTasks.filter((t) => t.epicId && progEpicIds.has(t.epicId))

      const totalTasks = progTasks.length
      const completedTasks = progTasks.filter((t) => t.status === 'DONE').length
      const totalPoints = progTasks.reduce((acc, cur) => acc + (cur.storyPoints || 0), 0)
      const completedPoints = progTasks
        .filter((t) => t.status === 'DONE')
        .reduce((acc, cur) => acc + (cur.storyPoints || 0), 0)

      return {
        ...prog,
        subunit: prog.subunitId ? subunitMap.get(prog.subunitId) || null : null,
        primaryPic: userMap.get(prog.primaryPicId) || null,
        clusterApprovedBy: prog.clusterApprovedById
          ? userMap.get(prog.clusterApprovedById) || null
          : null,
        governanceApprovedBy: prog.governanceApprovedById
          ? userMap.get(prog.governanceApprovedById) || null
          : null,
        members: progMembers,
        metrics: {
          totalEpics: progEpics.length,
          completedEpics: progEpics.filter((e) => !!e.closedAt).length,
          totalTasks,
          completedTasks,
          totalPoints,
          completedPoints,
          progressPercentage:
            totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        },
      }
    })
  }

  // ─── 2. Ambil Detail Satu Program Kerja ──────────────────────────────────────
  async findOne(id: string) {
    const list = await this.findAll()
    const program = list.find((p) => p.id === id)
    if (!program) {
      throw new NotFoundException('Program kerja tidak ditemukan.')
    }

    // Ambil rincian epics yang tertaut beserta nama divisi pemilik
    const epics = await this.db
      .select({
        id: epicsTable.id,
        title: epicsTable.title,
        description: epicsTable.description,
        scope: epicsTable.scope,
        prokerTag: epicsTable.prokerTag,
        ownerDivisionId: epicsTable.ownerDivisionId,
        ownerDivisionName: divisionsTable.name,
        startDate: epicsTable.startDate,
        endDate: epicsTable.endDate,
        closedAt: epicsTable.closedAt,
        createdAt: epicsTable.createdAt,
      })
      .from(epicsTable)
      .leftJoin(divisionsTable, eq(epicsTable.ownerDivisionId, divisionsTable.id))
      .where(eq(epicsTable.programId, id))
      .orderBy(desc(epicsTable.createdAt))

    return {
      ...program,
      epics,
    }
  }

  // ─── 3. Buat Program Kerja Baru ──────────────────────────────────────────────
  async create(dto: CreateProgramDto, actorUserId: string) {
    if (dto.scope === 'SUBUNIT' && !dto.subunitId) {
      throw new BadRequestException(
        'Subunit posko wajib dipilih jika cakupan program kerja adalah SUBUNIT.',
      )
    }

    if (dto.subunitId) {
      const [subunit] = await this.db
        .select()
        .from(subunitsTable)
        .where(eq(subunitsTable.id, dto.subunitId))
        .limit(1)

      if (!subunit) {
        throw new NotFoundException('Subunit posko tidak ditemukan.')
      }
    }

    // Validasi PIC Utama
    const [primaryPic] = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, dto.primaryPicId))
      .limit(1)

    if (!primaryPic) {
      throw new NotFoundException('Pengguna PIC Utama tidak ditemukan.')
    }

    if (primaryPic.status !== 'ACTIVE') {
      throw new BadRequestException('Pengguna yang dinonaktifkan tidak dapat dijadikan PIC Utama.')
    }

    const programId = crypto.randomUUID()

    await this.db.insert(programsTable).values({
      id: programId,
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      scope: dto.scope,
      subunitId: dto.scope === 'SUBUNIT' ? dto.subunitId : null,
      cluster: dto.cluster,
      primaryPicId: dto.primaryPicId,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      status: 'PROPOSED',
      clusterApprovalStatus: 'PENDING',
      governanceApprovalStatus: 'PENDING',
      createdById: actorUserId,
    })

    // Tambahkan Tim Pelaksana jika ada
    const membersToInsert: {
      id: string
      programId: string
      userId: string
      role: 'CO_PIC' | 'MEMBER'
    }[] = []

    if (dto.coPicIds && dto.coPicIds.length > 0) {
      for (const coPicId of dto.coPicIds) {
        if (coPicId !== dto.primaryPicId) {
          membersToInsert.push({
            id: crypto.randomUUID(),
            programId,
            userId: coPicId,
            role: 'CO_PIC',
          })
        }
      }
    }

    if (dto.memberIds && dto.memberIds.length > 0) {
      for (const memId of dto.memberIds) {
        if (memId !== dto.primaryPicId && !membersToInsert.some((m) => m.userId === memId)) {
          membersToInsert.push({
            id: crypto.randomUUID(),
            programId,
            userId: memId,
            role: 'MEMBER',
          })
        }
      }
    }

    if (membersToInsert.length > 0) {
      await this.db.insert(programMembersTable).values(membersToInsert)
    }

    await this.activityLogsService.record({
      actorId: actorUserId,
      action: 'CREATE_PROGRAM',
      entityType: 'PROGRAM',
      entityId: programId,
      after: {
        title: dto.title,
        scope: dto.scope,
        cluster: dto.cluster,
        primaryPicId: dto.primaryPicId,
      },
    })

    return this.findOne(programId)
  }

  // ─── 4. Update Program Kerja ─────────────────────────────────────────────────
  async update(
    id: string,
    dto: UpdateProgramDto,
    actorUserId: string,
    actorIsSuperAdmin: boolean,
  ) {
    const [existing] = await this.db
      .select()
      .from(programsTable)
      .where(eq(programsTable.id, id))
      .limit(1)

    if (!existing) {
      throw new NotFoundException('Program kerja tidak ditemukan.')
    }

    // Izin: Super Admin atau PIC Utama atau Co-PIC
    if (!actorIsSuperAdmin && existing.primaryPicId !== actorUserId) {
      const [isCoPic] = await this.db
        .select()
        .from(programMembersTable)
        .where(
          and(
            eq(programMembersTable.programId, id),
            eq(programMembersTable.userId, actorUserId),
            eq(programMembersTable.role, 'CO_PIC'),
          ),
        )
        .limit(1)

      if (!isCoPic) {
        throw new ForbiddenException(
          'Hanya Super Admin, PIC Utama, atau Co-PIC yang dapat memperbarui program kerja ini.',
        )
      }
    }

    if (dto.primaryPicId && dto.primaryPicId !== existing.primaryPicId) {
      const [newPic] = await this.db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, dto.primaryPicId))
        .limit(1)

      if (!newPic || newPic.status !== 'ACTIVE') {
        throw new BadRequestException('PIC Utama baru harus pengguna yang berstatus aktif.')
      }
    }

    const nextScope = dto.scope ?? existing.scope
    const nextSubunitId =
      nextScope === 'SUBUNIT'
        ? dto.subunitId !== undefined
          ? dto.subunitId
          : existing.subunitId
        : null

    if (nextScope === 'SUBUNIT' && !nextSubunitId) {
      throw new BadRequestException(
        'Subunit posko wajib ditentukan jika cakupan program kerja adalah SUBUNIT.',
      )
    }

    await this.db
      .update(programsTable)
      .set({
        title: dto.title !== undefined ? dto.title.trim() : undefined,
        description: dto.description !== undefined ? dto.description.trim() || null : undefined,
        scope: dto.scope,
        subunitId: nextSubunitId,
        cluster: dto.cluster,
        primaryPicId: dto.primaryPicId,
        status: dto.status,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      })
      .where(eq(programsTable.id, id))

    await this.activityLogsService.record({
      actorId: actorUserId,
      action: 'UPDATE_PROGRAM',
      entityType: 'PROGRAM',
      entityId: id,
      after: { dto },
    })

    return this.findOne(id)
  }

  // ─── 5. Review Keilmuan (Kormater) ──────────────────────────────────────────
  async reviewCluster(
    id: string,
    dto: ReviewProgramDto,
    actorUserId: string,
    actorIsSuperAdmin: boolean,
  ) {
    const [existing] = await this.db
      .select()
      .from(programsTable)
      .where(eq(programsTable.id, id))
      .limit(1)

    if (!existing) {
      throw new NotFoundException('Program kerja tidak ditemukan.')
    }

    // Ambil data user reviewer
    const [actorUser] = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, actorUserId))
      .limit(1)

    if (!actorUser) {
      throw new NotFoundException('Pengguna tidak ditemukan.')
    }

    // Otorisasi: Super Admin ATAU Koordinator Klaster (Kormater) yang klaster-nya sesuai
    const isKormater =
      actorUser.isClusterCoordinator &&
      (actorUser.cluster === existing.cluster || existing.cluster === 'UNIT_SHARED')

    if (!actorIsSuperAdmin && !isKormater) {
      throw new ForbiddenException(
        'Hanya Koordinator Klaster terkait atau Super Admin yang berhak memberikan approval keilmuan.',
      )
    }

    const clusterApprovedAt = new Date()
    const clusterRejectionReason =
      dto.decision === 'REJECTED' ? dto.reason?.trim() || 'Ditolak tanpa catatan.' : null

    // Cek auto-activate bila governance sudah approved
    let nextStatus: Program['status'] = existing.status
    if (dto.decision === 'APPROVED' && existing.governanceApprovalStatus === 'APPROVED') {
      nextStatus = 'ACTIVE'
    } else if (dto.decision === 'REJECTED') {
      nextStatus = 'PROPOSED'
    }

    await this.db
      .update(programsTable)
      .set({
        clusterApprovalStatus: dto.decision,
        clusterApprovedById: actorUserId,
        clusterApprovedAt,
        clusterRejectionReason,
        status: nextStatus,
      })
      .where(eq(programsTable.id, id))

    await this.activityLogsService.record({
      actorId: actorUserId,
      action: 'REVIEW_PROGRAM_CLUSTER',
      entityType: 'PROGRAM',
      entityId: id,
      after: { decision: dto.decision, reason: dto.reason },
    })

    return this.findOne(id)
  }

  // ─── 6. Review Tata Kelola / Wilayah (Kormasit / Kormanit) ───────────────────
  async reviewGovernance(
    id: string,
    dto: ReviewProgramDto,
    actorUserId: string,
    actorIsSuperAdmin: boolean,
  ) {
    const [existing] = await this.db
      .select()
      .from(programsTable)
      .where(eq(programsTable.id, id))
      .limit(1)

    if (!existing) {
      throw new NotFoundException('Program kerja tidak ditemukan.')
    }

    if (existing.scope === 'SUBUNIT') {
      // Boleh jika Super Admin atau Koordinator Subunit (Kormasit) posko terkait
      let isKormasit = false
      if (existing.subunitId) {
        const [kormasitMember] = await this.db
          .select()
          .from(subunitMembersTable)
          .where(
            and(
              eq(subunitMembersTable.subunitId, existing.subunitId),
              eq(subunitMembersTable.userId, actorUserId),
              eq(subunitMembersTable.role, 'COORDINATOR'),
            ),
          )
          .limit(1)

        isKormasit = !!kormasitMember
      }

      if (!actorIsSuperAdmin && !isKormasit) {
        throw new ForbiddenException(
          'Hanya Koordinator Subunit posko bersangkutan atau Super Admin yang berhak memberikan approval tata kelola.',
        )
      }
    } else {
      // Scope UNIT: hanya Super Admin / Kormanit
      if (!actorIsSuperAdmin) {
        throw new ForbiddenException(
          'Hanya Super Admin / Koordinator Unit yang berhak memberikan approval tata kelola program tingkat unit.',
        )
      }
    }

    const governanceApprovedAt = new Date()
    const governanceRejectionReason =
      dto.decision === 'REJECTED' ? dto.reason?.trim() || 'Ditolak tanpa catatan.' : null

    // Cek auto-activate bila cluster sudah approved
    let nextStatus: Program['status'] = existing.status
    if (dto.decision === 'APPROVED' && existing.clusterApprovalStatus === 'APPROVED') {
      nextStatus = 'ACTIVE'
    } else if (dto.decision === 'REJECTED') {
      nextStatus = 'PROPOSED'
    }

    await this.db
      .update(programsTable)
      .set({
        governanceApprovalStatus: dto.decision,
        governanceApprovedById: actorUserId,
        governanceApprovedAt,
        governanceRejectionReason,
        status: nextStatus,
      })
      .where(eq(programsTable.id, id))

    await this.activityLogsService.record({
      actorId: actorUserId,
      action: 'REVIEW_PROGRAM_GOVERNANCE',
      entityType: 'PROGRAM',
      entityId: id,
      after: { decision: dto.decision, reason: dto.reason },
    })

    return this.findOne(id)
  }

  // ─── 7. Kelola Tim Pelaksana ────────────────────────────────────────────────
  async addMember(
    programId: string,
    dto: AddProgramMemberDto,
    actorUserId: string,
    actorIsSuperAdmin: boolean,
  ) {
    const [existing] = await this.db
      .select()
      .from(programsTable)
      .where(eq(programsTable.id, programId))
      .limit(1)

    if (!existing) {
      throw new NotFoundException('Program kerja tidak ditemukan.')
    }

    if (!actorIsSuperAdmin && existing.primaryPicId !== actorUserId) {
      throw new ForbiddenException(
        'Hanya Super Admin atau PIC Utama yang dapat menambahkan anggota tim program kerja.',
      )
    }

    const [user] = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, dto.userId))
      .limit(1)

    if (!user || user.status !== 'ACTIVE') {
      throw new BadRequestException('Hanya pengguna aktif yang dapat ditambahkan ke tim pelaksana.')
    }

    if (existing.primaryPicId === dto.userId) {
      throw new BadRequestException('Pengguna ini sudah terdaftar sebagai PIC Utama program kerja.')
    }

    const [alreadyMember] = await this.db
      .select()
      .from(programMembersTable)
      .where(
        and(
          eq(programMembersTable.programId, programId),
          eq(programMembersTable.userId, dto.userId),
        ),
      )
      .limit(1)

    if (alreadyMember) {
      throw new ConflictException('Pengguna ini sudah terdaftar dalam tim pelaksana program kerja.')
    }

    await this.db.insert(programMembersTable).values({
      id: crypto.randomUUID(),
      programId,
      userId: dto.userId,
      role: dto.role,
    })

    return this.findOne(programId)
  }

  async removeMember(
    programId: string,
    userId: string,
    actorUserId: string,
    actorIsSuperAdmin: boolean,
  ) {
    const [existing] = await this.db
      .select()
      .from(programsTable)
      .where(eq(programsTable.id, programId))
      .limit(1)

    if (!existing) {
      throw new NotFoundException('Program kerja tidak ditemukan.')
    }

    if (!actorIsSuperAdmin && existing.primaryPicId !== actorUserId && actorUserId !== userId) {
      throw new ForbiddenException(
        'Anda tidak memiliki izin untuk mengeluarkan anggota dari tim pelaksana.',
      )
    }

    await this.db
      .delete(programMembersTable)
      .where(
        and(
          eq(programMembersTable.programId, programId),
          eq(programMembersTable.userId, userId),
        ),
      )

    return this.findOne(programId)
  }

  // ─── 8. Hapus Program Kerja ──────────────────────────────────────────────────
  async delete(id: string, actorUserId: string, actorIsSuperAdmin: boolean) {
    const [existing] = await this.db
      .select()
      .from(programsTable)
      .where(eq(programsTable.id, id))
      .limit(1)

    if (!existing) {
      throw new NotFoundException('Program kerja tidak ditemukan.')
    }

    if (!actorIsSuperAdmin && existing.primaryPicId !== actorUserId) {
      throw new ForbiddenException('Hanya Super Admin atau PIC Utama yang dapat menghapus program kerja.')
    }

    await this.db.delete(programsTable).where(eq(programsTable.id, id))

    await this.activityLogsService.record({
      actorId: actorUserId,
      action: 'DELETE_PROGRAM',
      entityType: 'PROGRAM',
      entityId: id,
      before: { title: existing.title },
    })

    return { success: true, message: 'Program kerja berhasil dihapus.' }
  }
}
