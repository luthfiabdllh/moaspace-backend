import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, desc, eq, ilike, inArray, isNotNull, isNull, or } from 'drizzle-orm'
import {
  divisionMembersTable,
  divisionsTable,
  epicsTable,
  storiesTable,
  tasksTable,
  usersTable,
} from '@moaspace/database'
import { DATABASE_CONNECTION, type Database } from '../database/database.provider.js'
import { ActivityLogsService } from '../activity-logs/activity-logs.service.js'
import type { RequestUser } from '../common/decorators/current-user.decorator.js'
import type { CreateStoryDto } from './dto/create-story.dto.js'
import type { UpdateStoryDto } from './dto/update-story.dto.js'
import type { QueryStoriesDto } from './dto/query-stories.dto.js'

@Injectable()
export class StoriesService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  // ─── 1. Ambil Seluruh Story Beserta Kalkulasi Progres Dinamis ───────────────
  async findAll(query: QueryStoriesDto) {
    const conditions = []

    if (query.divisionId) {
      conditions.push(eq(storiesTable.divisionId, query.divisionId))
    }

    if (query.epicId) {
      conditions.push(eq(storiesTable.epicId, query.epicId))
    }

    if (query.isClosed !== undefined) {
      const isClosedBool = query.isClosed === 'true'
      conditions.push(
        isClosedBool ? isNotNull(storiesTable.closedAt) : isNull(storiesTable.closedAt),
      )
    }

    if (query.search) {
      const term = `%${query.search.trim()}%`
      conditions.push(
        or(
          ilike(storiesTable.title, term),
          ilike(storiesTable.prokerTag, term),
          ilike(storiesTable.doneCriteria, term),
        ),
      )
    }

    const stories = await this.db
      .select({
        id: storiesTable.id,
        epicId: storiesTable.epicId,
        epicTitle: epicsTable.title,
        divisionId: storiesTable.divisionId,
        divisionName: divisionsTable.name,
        divisionSlug: divisionsTable.slug,
        title: storiesTable.title,
        doneCriteria: storiesTable.doneCriteria,
        targetDate: storiesTable.targetDate,
        prokerTag: storiesTable.prokerTag,
        sourceRequestId: storiesTable.sourceRequestId,
        closedAt: storiesTable.closedAt,
        createdAt: storiesTable.createdAt,
      })
      .from(storiesTable)
      .innerJoin(divisionsTable, eq(storiesTable.divisionId, divisionsTable.id))
      .leftJoin(epicsTable, eq(storiesTable.epicId, epicsTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(storiesTable.createdAt))

    if (stories.length === 0) {
      return []
    }

    const storyIds = stories.map((s) => s.id)

    // Ambil tasks untuk seluruh stories
    const tasks = await this.db
      .select({
        storyId: tasksTable.storyId,
        status: tasksTable.status,
      })
      .from(tasksTable)
      .where(inArray(tasksTable.storyId, storyIds))

    return stories.map((story) => {
      const storyTasks = tasks.filter((t) => t.storyId === story.id)
      const totalTasks = storyTasks.length
      const doneTasks = storyTasks.filter((t) => t.status === 'DONE').length
      const progressPercentage =
        totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

      return {
        ...story,
        isClosed: story.closedAt !== null,
        totalTasks,
        doneTasks,
        progressPercentage,
      }
    })
  }

  // ─── 2. Ambil Detail Satu Story ────────────────────────────────────────────
  async findOne(id: string) {
    const [story] = await this.db
      .select({
        id: storiesTable.id,
        epicId: storiesTable.epicId,
        epicTitle: epicsTable.title,
        divisionId: storiesTable.divisionId,
        divisionName: divisionsTable.name,
        divisionSlug: divisionsTable.slug,
        title: storiesTable.title,
        doneCriteria: storiesTable.doneCriteria,
        targetDate: storiesTable.targetDate,
        prokerTag: storiesTable.prokerTag,
        sourceRequestId: storiesTable.sourceRequestId,
        closedAt: storiesTable.closedAt,
        createdAt: storiesTable.createdAt,
        updatedAt: storiesTable.updatedAt,
      })
      .from(storiesTable)
      .innerJoin(divisionsTable, eq(storiesTable.divisionId, divisionsTable.id))
      .leftJoin(epicsTable, eq(storiesTable.epicId, epicsTable.id))
      .where(eq(storiesTable.id, id))

    if (!story) {
      throw new NotFoundException('Story tidak ditemukan.')
    }

    const tasks = await this.db
      .select({
        id: tasksTable.id,
        storyId: tasksTable.storyId,
        title: tasksTable.title,
        description: tasksTable.description,
        status: tasksTable.status,
        priority: tasksTable.priority,
        dueDate: tasksTable.dueDate,
        position: tasksTable.position,
        isBlocked: tasksTable.isBlocked,
        blockedReason: tasksTable.blockedReason,
        assigneeId: tasksTable.assigneeId,
        assigneeName: usersTable.name,
        assigneeEmail: usersTable.email,
        startedAt: tasksTable.startedAt,
        completedAt: tasksTable.completedAt,
        revisionCount: tasksTable.revisionCount,
        createdAt: tasksTable.createdAt,
      })
      .from(tasksTable)
      .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
      .where(eq(tasksTable.storyId, id))
      .orderBy(tasksTable.position)

    const totalTasks = tasks.length
    const doneTasks = tasks.filter((t) => t.status === 'DONE').length
    const progressPercentage =
      totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

    return {
      ...story,
      isClosed: story.closedAt !== null,
      tasks,
      totalTasks,
      doneTasks,
      progressPercentage,
    }
  }

  // ─── 3. Buat Story Baru ────────────────────────────────────────────────────
  async create(dto: CreateStoryDto, user: RequestUser) {
    // Validasi wewenang: Koordinator divisi terkait atau Super Admin / Kormanit
    if (!user.isSuperAdmin && !user.isKormanit) {
      const [membership] = await this.db
        .select()
        .from(divisionMembersTable)
        .where(
          and(
            eq(divisionMembersTable.divisionId, dto.divisionId),
            eq(divisionMembersTable.userId, user.userId),
            eq(divisionMembersTable.role, 'COORDINATOR'),
          ),
        )

      if (!membership) {
        throw new ForbiddenException(
          'Hanya Koordinator dari divisi terkait yang dapat membuat Story.',
        )
      }
    }

    const storyId = crypto.randomUUID()
    const targetDate = dto.targetDate ? new Date(dto.targetDate) : null

    const [created] = await this.db
      .insert(storiesTable)
      .values({
        id: storyId,
        divisionId: dto.divisionId,
        epicId: dto.epicId || null,
        title: dto.title.trim(),
        doneCriteria: dto.doneCriteria || null,
        targetDate,
        prokerTag: dto.prokerTag || null,
        sourceRequestId: dto.sourceRequestId || null,
      })
      .returning()

    if (!created) {
      throw new Error('Gagal membuat story.')
    }

    await this.activityLogsService.record({
      entityType: 'STORY',
      entityId: storyId,
      action: 'STORY_CREATED',
      actorId: user.userId,
      before: null,
      after: {
        id: storyId,
        title: created.title,
        divisionId: created.divisionId,
        epicId: created.epicId,
      },
    })

    return this.findOne(storyId)
  }

  // ─── 4. Perbarui Story ─────────────────────────────────────────────────────
  async update(id: string, dto: UpdateStoryDto, user: RequestUser) {
    const [existing] = await this.db
      .select()
      .from(storiesTable)
      .where(eq(storiesTable.id, id))

    if (!existing) {
      throw new NotFoundException('Story tidak ditemukan.')
    }

    // Validasi wewenang: Koordinator divisi terkait atau Super Admin / Kormanit
    if (!user.isSuperAdmin && !user.isKormanit) {
      const [membership] = await this.db
        .select()
        .from(divisionMembersTable)
        .where(
          and(
            eq(divisionMembersTable.divisionId, existing.divisionId),
            eq(divisionMembersTable.userId, user.userId),
            eq(divisionMembersTable.role, 'COORDINATOR'),
          ),
        )

      if (!membership) {
        throw new ForbiddenException(
          'Hanya Koordinator divisi atau administrator yang dapat mengubah Story ini.',
        )
      }
    }

    const updates: Partial<typeof storiesTable.$inferInsert> = {}

    if (dto.title !== undefined) updates.title = dto.title.trim()
    if (dto.doneCriteria !== undefined) updates.doneCriteria = dto.doneCriteria || null
    if (dto.targetDate !== undefined)
      updates.targetDate = dto.targetDate ? new Date(dto.targetDate) : null
    if (dto.prokerTag !== undefined) updates.prokerTag = dto.prokerTag || null
    if (dto.epicId !== undefined) updates.epicId = dto.epicId

    if (dto.isClosed !== undefined) {
      updates.closedAt = dto.isClosed ? new Date() : null
    }

    if (Object.keys(updates).length > 0) {
      await this.db
        .update(storiesTable)
        .set(updates)
        .where(eq(storiesTable.id, id))
    }

    await this.activityLogsService.record({
      entityType: 'STORY',
      entityId: id,
      action: dto.isClosed ? 'STORY_CLOSED' : 'STORY_UPDATED',
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

  // ─── 5. Hapus Story ────────────────────────────────────────────────────────
  async delete(id: string, user: RequestUser) {
    const [existing] = await this.db
      .select()
      .from(storiesTable)
      .where(eq(storiesTable.id, id))

    if (!existing) {
      throw new NotFoundException('Story tidak ditemukan.')
    }

    if (!user.isSuperAdmin && !user.isKormanit) {
      const [membership] = await this.db
        .select()
        .from(divisionMembersTable)
        .where(
          and(
            eq(divisionMembersTable.divisionId, existing.divisionId),
            eq(divisionMembersTable.userId, user.userId),
            eq(divisionMembersTable.role, 'COORDINATOR'),
          ),
        )

      if (!membership) {
        throw new ForbiddenException(
          'Hanya Koordinator divisi atau administrator yang dapat menghapus Story ini.',
        )
      }
    }

    await this.db.delete(storiesTable).where(eq(storiesTable.id, id))

    await this.activityLogsService.record({
      entityType: 'STORY',
      entityId: id,
      action: 'STORY_DELETED',
      actorId: user.userId,
      before: { title: existing.title, divisionId: existing.divisionId },
      after: null,
    })

    return { success: true, message: 'Story berhasil dihapus.' }
  }
}
