import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, desc, eq, ilike, inArray, isNotNull, isNull, or } from 'drizzle-orm'
import {
  divisionMembersTable,
  divisionsTable,
  epicDivisionsTable,
  epicsTable,
  storiesTable,
  tasksTable,
  usersTable,
} from '@moaspace/database'
import { DATABASE_CONNECTION, type Database } from '../database/database.provider.js'
import { ActivityLogsService } from '../activity-logs/activity-logs.service.js'
import type { RequestUser } from '../common/decorators/current-user.decorator.js'
import type { CreateEpicDto } from './dto/create-epic.dto.js'
import type { UpdateEpicDto } from './dto/update-epic.dto.js'
import type { QueryEpicsDto } from './dto/query-epics.dto.js'

@Injectable()
export class EpicsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  // ─── 1. Ambil Seluruh Epic Beserta Kalkulasi Progres Dinamis ────────────────
  async findAll(query: QueryEpicsDto) {
    const conditions = []

    if (query.scope) {
      conditions.push(eq(epicsTable.scope, query.scope))
    }

    if (query.isClosed !== undefined) {
      const isClosedBool = query.isClosed === 'true'
      conditions.push(
        isClosedBool ? isNotNull(epicsTable.closedAt) : isNull(epicsTable.closedAt),
      )
    }

    if (query.search) {
      const term = `%${query.search.trim()}%`
      conditions.push(
        or(
          ilike(epicsTable.title, term),
          ilike(epicsTable.description, term),
          ilike(epicsTable.prokerTag, term),
        ),
      )
    }

    const epics = await this.db
      .select({
        id: epicsTable.id,
        title: epicsTable.title,
        description: epicsTable.description,
        startDate: epicsTable.startDate,
        endDate: epicsTable.endDate,
        prokerTag: epicsTable.prokerTag,
        scope: epicsTable.scope,
        ownerDivisionId: epicsTable.ownerDivisionId,
        ownerDivisionName: divisionsTable.name,
        createdById: epicsTable.createdById,
        creatorName: usersTable.name,
        closedAt: epicsTable.closedAt,
        createdAt: epicsTable.createdAt,
      })
      .from(epicsTable)
      .leftJoin(divisionsTable, eq(epicsTable.ownerDivisionId, divisionsTable.id))
      .innerJoin(usersTable, eq(epicsTable.createdById, usersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(epicsTable.createdAt))

    if (epics.length === 0) {
      return []
    }

    const epicIds = epics.map((e) => e.id)

    // Ambil participating divisions untuk epics CROSS
    const participating = await this.db
      .select({
        epicId: epicDivisionsTable.epicId,
        divisionId: divisionsTable.id,
        divisionName: divisionsTable.name,
        divisionSlug: divisionsTable.slug,
      })
      .from(epicDivisionsTable)
      .innerJoin(
        divisionsTable,
        eq(epicDivisionsTable.divisionId, divisionsTable.id),
      )
      .where(inArray(epicDivisionsTable.epicId, epicIds))

    // Ambil stories dan tasks terkait untuk kalkulasi progres dinamis
    const stories = await this.db
      .select({
        id: storiesTable.id,
        epicId: storiesTable.epicId,
        divisionId: storiesTable.divisionId,
        closedAt: storiesTable.closedAt,
      })
      .from(storiesTable)
      .where(inArray(storiesTable.epicId, epicIds))

    const storyIds = stories.map((s) => s.id)

    let tasks: { storyId: string; status: string }[] = []
    if (storyIds.length > 0) {
      tasks = await this.db
        .select({
          storyId: tasksTable.storyId,
          status: tasksTable.status,
        })
        .from(tasksTable)
        .where(inArray(tasksTable.storyId, storyIds))
    }

    // Filter by divisionId jika ada parameter query
    let filteredEpics = epics
    if (query.divisionId) {
      filteredEpics = epics.filter((e) => {
        if (e.ownerDivisionId === query.divisionId) return true
        return participating.some(
          (p) => p.epicId === e.id && p.divisionId === query.divisionId,
        )
      })
    }

    return filteredEpics.map((epic) => {
      const epicStories = stories.filter((s) => s.epicId === epic.id)
      const epicStoryIds = new Set(epicStories.map((s) => s.id))
      const epicTasks = tasks.filter((t) => epicStoryIds.has(t.storyId))

      const totalTasks = epicTasks.length
      const doneTasks = epicTasks.filter((t) => t.status === 'DONE').length
      const progressPercentage =
        totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

      const participatingDivisions = participating
        .filter((p) => p.epicId === epic.id)
        .map((p) => ({
          id: p.divisionId,
          name: p.divisionName,
          slug: p.divisionSlug,
        }))

      return {
        ...epic,
        isClosed: epic.closedAt !== null,
        participatingDivisions,
        storyCount: epicStories.length,
        totalTasks,
        doneTasks,
        progressPercentage,
      }
    })
  }

  // ─── 2. Ambil Detail Satu Epic ─────────────────────────────────────────────
  async findOne(id: string) {
    const [epic] = await this.db
      .select({
        id: epicsTable.id,
        title: epicsTable.title,
        description: epicsTable.description,
        startDate: epicsTable.startDate,
        endDate: epicsTable.endDate,
        prokerTag: epicsTable.prokerTag,
        scope: epicsTable.scope,
        ownerDivisionId: epicsTable.ownerDivisionId,
        ownerDivisionName: divisionsTable.name,
        createdById: epicsTable.createdById,
        creatorName: usersTable.name,
        creatorEmail: usersTable.email,
        closedAt: epicsTable.closedAt,
        createdAt: epicsTable.createdAt,
        updatedAt: epicsTable.updatedAt,
      })
      .from(epicsTable)
      .leftJoin(divisionsTable, eq(epicsTable.ownerDivisionId, divisionsTable.id))
      .innerJoin(usersTable, eq(epicsTable.createdById, usersTable.id))
      .where(eq(epicsTable.id, id))

    if (!epic) {
      throw new NotFoundException('Epic tidak ditemukan.')
    }

    // Ambil participating divisions
    const participating = await this.db
      .select({
        id: divisionsTable.id,
        name: divisionsTable.name,
        slug: divisionsTable.slug,
      })
      .from(epicDivisionsTable)
      .innerJoin(
        divisionsTable,
        eq(epicDivisionsTable.divisionId, divisionsTable.id),
      )
      .where(eq(epicDivisionsTable.epicId, id))

    // Ambil stories
    const stories = await this.db
      .select({
        id: storiesTable.id,
        title: storiesTable.title,
        divisionId: storiesTable.divisionId,
        divisionName: divisionsTable.name,
        doneCriteria: storiesTable.doneCriteria,
        targetDate: storiesTable.targetDate,
        prokerTag: storiesTable.prokerTag,
        closedAt: storiesTable.closedAt,
        createdAt: storiesTable.createdAt,
      })
      .from(storiesTable)
      .innerJoin(divisionsTable, eq(storiesTable.divisionId, divisionsTable.id))
      .where(eq(storiesTable.epicId, id))
      .orderBy(desc(storiesTable.createdAt))

    const storyIds = stories.map((s) => s.id)

    let tasks: any[] = []
    if (storyIds.length > 0) {
      tasks = await this.db
        .select({
          id: tasksTable.id,
          storyId: tasksTable.storyId,
          title: tasksTable.title,
          status: tasksTable.status,
          priority: tasksTable.priority,
          assigneeId: tasksTable.assigneeId,
          assigneeName: usersTable.name,
          dueDate: tasksTable.dueDate,
          isBlocked: tasksTable.isBlocked,
        })
        .from(tasksTable)
        .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
        .where(inArray(tasksTable.storyId, storyIds))
    }

    const storiesWithProgress = stories.map((s) => {
      const sTasks = tasks.filter((t) => t.storyId === s.id)
      const total = sTasks.length
      const done = sTasks.filter((t) => t.status === 'DONE').length
      return {
        ...s,
        isClosed: s.closedAt !== null,
        totalTasks: total,
        doneTasks: done,
        progressPercentage: total > 0 ? Math.round((done / total) * 100) : 0,
        tasks: sTasks,
      }
    })

    const totalTasks = tasks.length
    const doneTasks = tasks.filter((t) => t.status === 'DONE').length
    const progressPercentage =
      totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

    return {
      ...epic,
      isClosed: epic.closedAt !== null,
      participatingDivisions: participating,
      stories: storiesWithProgress,
      storyCount: stories.length,
      totalTasks,
      doneTasks,
      progressPercentage,
    }
  }

  // ─── 3. Buat Epic Baru ─────────────────────────────────────────────────────
  async create(dto: CreateEpicDto, user: RequestUser) {
    if (dto.scope === 'CROSS') {
      if (!user.isSuperAdmin && !user.isKormanit) {
        throw new ForbiddenException(
          'Hanya Super Admin atau Koordinator Mahasiswa Unit yang dapat membuat Epic lintas divisi.',
        )
      }
    } else {
      if (!dto.ownerDivisionId) {
        throw new BadRequestException(
          'ownerDivisionId wajib disertakan untuk Epic bertipe DIVISION.',
        )
      }

      if (!user.isSuperAdmin && !user.isKormanit) {
        const [membership] = await this.db
          .select()
          .from(divisionMembersTable)
          .where(
            and(
              eq(divisionMembersTable.divisionId, dto.ownerDivisionId),
              eq(divisionMembersTable.userId, user.userId),
              eq(divisionMembersTable.role, 'COORDINATOR'),
            ),
          )

        if (!membership) {
          throw new ForbiddenException(
            'Hanya Koordinator dari divisi terkait yang dapat membuat Epic divisi ini.',
          )
        }
      }
    }

    const epicId = crypto.randomUUID()
    const startDate = dto.startDate ? new Date(dto.startDate) : null
    const endDate = dto.endDate ? new Date(dto.endDate) : null

    const [created] = await this.db
      .insert(epicsTable)
      .values({
        id: epicId,
        title: dto.title.trim(),
        description: dto.description || null,
        startDate,
        endDate,
        prokerTag: dto.prokerTag || null,
        scope: dto.scope,
        ownerDivisionId: dto.scope === 'DIVISION' ? dto.ownerDivisionId : null,
        createdById: user.userId,
      })
      .returning()

    if (!created) {
      throw new Error('Gagal membuat epic.')
    }

    if (
      dto.scope === 'CROSS' &&
      dto.participatingDivisionIds &&
      dto.participatingDivisionIds.length > 0
    ) {
      const links = dto.participatingDivisionIds.map((divId) => ({
        epicId,
        divisionId: divId,
      }))
      await this.db.insert(epicDivisionsTable).values(links)
    }

    await this.activityLogsService.record({
      entityType: 'EPIC',
      entityId: epicId,
      action: 'EPIC_CREATED',
      actorId: user.userId,
      before: null,
      after: {
        id: epicId,
        title: created.title,
        scope: created.scope,
        ownerDivisionId: created.ownerDivisionId,
      },
    })

    return this.findOne(epicId)
  }

  // ─── 4. Perbarui Epic ──────────────────────────────────────────────────────
  async update(id: string, dto: UpdateEpicDto, user: RequestUser) {
    const [existing] = await this.db
      .select()
      .from(epicsTable)
      .where(eq(epicsTable.id, id))

    if (!existing) {
      throw new NotFoundException('Epic tidak ditemukan.')
    }

    // Validasi wewenang update
    if (!user.isSuperAdmin && !user.isKormanit) {
      if (existing.scope === 'CROSS') {
        throw new ForbiddenException(
          'Hanya Super Admin atau Koordinator Mahasiswa Unit yang dapat mengubah Epic lintas divisi.',
        )
      }
      if (existing.ownerDivisionId) {
        const [membership] = await this.db
          .select()
          .from(divisionMembersTable)
          .where(
            and(
              eq(divisionMembersTable.divisionId, existing.ownerDivisionId),
              eq(divisionMembersTable.userId, user.userId),
              eq(divisionMembersTable.role, 'COORDINATOR'),
            ),
          )
        if (!membership) {
          throw new ForbiddenException(
            'Hanya Koordinator divisi atau administrator yang dapat mengubah Epic ini.',
          )
        }
      }
    }

    const updates: Partial<typeof epicsTable.$inferInsert> = {}

    if (dto.title !== undefined) updates.title = dto.title.trim()
    if (dto.description !== undefined) updates.description = dto.description || null
    if (dto.startDate !== undefined)
      updates.startDate = dto.startDate ? new Date(dto.startDate) : null
    if (dto.endDate !== undefined)
      updates.endDate = dto.endDate ? new Date(dto.endDate) : null
    if (dto.prokerTag !== undefined) updates.prokerTag = dto.prokerTag || null
    if (dto.ownerDivisionId !== undefined) updates.ownerDivisionId = dto.ownerDivisionId

    if (dto.isClosed !== undefined) {
      updates.closedAt = dto.isClosed ? new Date() : null
    }

    if (Object.keys(updates).length > 0) {
      await this.db
        .update(epicsTable)
        .set(updates)
        .where(eq(epicsTable.id, id))
    }

    if (dto.participatingDivisionIds !== undefined && existing.scope === 'CROSS') {
      await this.db
        .delete(epicDivisionsTable)
        .where(eq(epicDivisionsTable.epicId, id))

      if (dto.participatingDivisionIds.length > 0) {
        const links = dto.participatingDivisionIds.map((divId) => ({
          epicId: id,
          divisionId: divId,
        }))
        await this.db.insert(epicDivisionsTable).values(links)
      }
    }

    await this.activityLogsService.record({
      entityType: 'EPIC',
      entityId: id,
      action: dto.isClosed ? 'EPIC_CLOSED' : 'EPIC_UPDATED',
      actorId: user.userId,
      before: {
        title: existing.title,
        closedAt: existing.closedAt,
      },
      after: {
        title: updates.title ?? existing.title,
        closedAt: updates.closedAt !== undefined ? updates.closedAt : existing.closedAt,
      },
    })

    return this.findOne(id)
  }

  // ─── 5. Hapus Epic ─────────────────────────────────────────────────────────
  async delete(id: string, user: RequestUser) {
    const [existing] = await this.db
      .select()
      .from(epicsTable)
      .where(eq(epicsTable.id, id))

    if (!existing) {
      throw new NotFoundException('Epic tidak ditemukan.')
    }

    if (!user.isSuperAdmin && !user.isKormanit) {
      throw new ForbiddenException(
        'Hanya Super Admin atau Koordinator Mahasiswa Unit yang dapat menghapus Epic.',
      )
    }

    await this.db.delete(epicsTable).where(eq(epicsTable.id, id))

    await this.activityLogsService.record({
      entityType: 'EPIC',
      entityId: id,
      action: 'EPIC_DELETED',
      actorId: user.userId,
      before: { title: existing.title, scope: existing.scope },
      after: null,
    })

    return { success: true, message: 'Epic berhasil dihapus.' }
  }
}
