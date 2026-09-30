import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, asc, desc, eq, ilike, or } from 'drizzle-orm'
import {
  divisionMembersTable,
  divisionsTable,
  storiesTable,
  tasksTable,
  usersTable,
} from '@moaspace/database'
import { DATABASE_CONNECTION, type Database } from '../database/database.provider.js'
import { ActivityLogsService } from '../activity-logs/activity-logs.service.js'
import type { RequestUser } from '../common/decorators/current-user.decorator.js'
import type { CreateTaskDto } from './dto/create-task.dto.js'
import type { UpdateTaskDto } from './dto/update-task.dto.js'
import type { QueryTasksDto } from './dto/query-tasks.dto.js'

@Injectable()
export class TasksService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  // ─── 1. Ambil Seluruh Task dengan Filter ───────────────────────────────────
  async findAll(query: QueryTasksDto) {
    const conditions = []

    if (query.storyId) {
      conditions.push(eq(tasksTable.storyId, query.storyId))
    }

    if (query.assigneeId) {
      conditions.push(eq(tasksTable.assigneeId, query.assigneeId))
    }

    if (query.status) {
      conditions.push(eq(tasksTable.status, query.status))
    }

    if (query.priority) {
      conditions.push(eq(tasksTable.priority, query.priority))
    }

    if (query.divisionId) {
      conditions.push(eq(storiesTable.divisionId, query.divisionId))
    }

    if (query.search) {
      const term = `%${query.search.trim()}%`
      conditions.push(
        or(
          ilike(tasksTable.title, term),
          ilike(tasksTable.description, term),
        ),
      )
    }

    return this.db
      .select({
        id: tasksTable.id,
        storyId: tasksTable.storyId,
        storyTitle: storiesTable.title,
        divisionId: storiesTable.divisionId,
        divisionName: divisionsTable.name,
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
        updatedAt: tasksTable.updatedAt,
      })
      .from(tasksTable)
      .innerJoin(storiesTable, eq(tasksTable.storyId, storiesTable.id))
      .innerJoin(divisionsTable, eq(storiesTable.divisionId, divisionsTable.id))
      .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(tasksTable.position), desc(tasksTable.createdAt))
  }

  // ─── 2. Ambil Detail Satu Task Beserta Riwayat Aktivitasnya ────────────────
  async findOne(id: string) {
    const [task] = await this.db
      .select({
        id: tasksTable.id,
        storyId: tasksTable.storyId,
        storyTitle: storiesTable.title,
        divisionId: storiesTable.divisionId,
        divisionName: divisionsTable.name,
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
        updatedAt: tasksTable.updatedAt,
      })
      .from(tasksTable)
      .innerJoin(storiesTable, eq(tasksTable.storyId, storiesTable.id))
      .innerJoin(divisionsTable, eq(storiesTable.divisionId, divisionsTable.id))
      .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
      .where(eq(tasksTable.id, id))

    if (!task) {
      throw new NotFoundException('Task tidak ditemukan.')
    }

    const activityLogs = await this.activityLogsService.findByEntity('TASK', id)

    return {
      ...task,
      activityLogs,
    }
  }

  // ─── 3. Buat Task Baru ─────────────────────────────────────────────────────
  async create(dto: CreateTaskDto, user: RequestUser) {
    const [story] = await this.db
      .select({
        id: storiesTable.id,
        divisionId: storiesTable.divisionId,
        title: storiesTable.title,
      })
      .from(storiesTable)
      .where(eq(storiesTable.id, dto.storyId))

    if (!story) {
      throw new NotFoundException('Story tidak ditemukan.')
    }

    // Validasi wewenang: anggota/koordinator divisi story atau Super Admin / Kormanit
    if (!user.isSuperAdmin && !user.isKormanit) {
      const [membership] = await this.db
        .select()
        .from(divisionMembersTable)
        .where(
          and(
            eq(divisionMembersTable.divisionId, story.divisionId),
            eq(divisionMembersTable.userId, user.userId),
          ),
        )

      if (!membership) {
        throw new ForbiddenException(
          'Anda harus menjadi anggota divisi terkait untuk membuat task.',
        )
      }
    }

    const taskId = crypto.randomUUID()
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : null
    const position = dto.position || `${Date.now()}`

    const [created] = await this.db
      .insert(tasksTable)
      .values({
        id: taskId,
        storyId: dto.storyId,
        title: dto.title.trim(),
        description: dto.description || null,
        assigneeId: dto.assigneeId || null,
        status: dto.status || 'BACKLOG',
        priority: dto.priority || 'MEDIUM',
        dueDate,
        position,
        isBlocked: dto.isBlocked ?? false,
        blockedReason: dto.blockedReason || null,
      })
      .returning()

    if (!created) {
      throw new Error('Gagal membuat task.')
    }

    // Periksa status penyelesaian story (jika sebelumnya tertutup, buka kembali)
    await this.checkAndUpdateStoryCompletion(story.id)

    await this.activityLogsService.record({
      entityType: 'TASK',
      entityId: taskId,
      action: 'TASK_CREATED',
      actorId: user.userId,
      before: null,
      after: {
        id: taskId,
        title: created.title,
        storyId: created.storyId,
        status: created.status,
      },
    })

    return this.findOne(taskId)
  }

  // ─── 4. Perbarui Task ──────────────────────────────────────────────────────
  async update(id: string, dto: UpdateTaskDto, user: RequestUser) {
    const [existing] = await this.db
      .select({
        id: tasksTable.id,
        storyId: tasksTable.storyId,
        divisionId: storiesTable.divisionId,
        status: tasksTable.status,
        title: tasksTable.title,
        assigneeId: tasksTable.assigneeId,
      })
      .from(tasksTable)
      .innerJoin(storiesTable, eq(tasksTable.storyId, storiesTable.id))
      .where(eq(tasksTable.id, id))

    if (!existing) {
      throw new NotFoundException('Task tidak ditemukan.')
    }

    // Validasi wewenang
    if (!user.isSuperAdmin && !user.isKormanit) {
      const [membership] = await this.db
        .select()
        .from(divisionMembersTable)
        .where(
          and(
            eq(divisionMembersTable.divisionId, existing.divisionId),
            eq(divisionMembersTable.userId, user.userId),
          ),
        )

      if (!membership) {
        throw new ForbiddenException(
          'Anda tidak memiliki akses untuk mengubah task divisi ini.',
        )
      }
    }

    const updates: Partial<typeof tasksTable.$inferInsert> = {}

    if (dto.title !== undefined) updates.title = dto.title.trim()
    if (dto.description !== undefined) updates.description = dto.description || null
    if (dto.assigneeId !== undefined) updates.assigneeId = dto.assigneeId
    if (dto.priority !== undefined) updates.priority = dto.priority
    if (dto.position !== undefined) updates.position = dto.position
    if (dto.isBlocked !== undefined) updates.isBlocked = dto.isBlocked
    if (dto.blockedReason !== undefined) updates.blockedReason = dto.blockedReason
    if (dto.revisionCount !== undefined) updates.revisionCount = dto.revisionCount
    if (dto.dueDate !== undefined)
      updates.dueDate = dto.dueDate ? new Date(dto.dueDate) : null

    // Tangani perubahan status dan timestamp otomatis
    let isStatusChanged = false
    if (dto.status !== undefined && dto.status !== existing.status) {
      isStatusChanged = true
      updates.status = dto.status

      if (dto.status === 'DONE') {
        updates.completedAt = new Date()
      } else if (existing.status === 'BACKLOG' && (dto.status === 'TODO' || dto.status === 'IN_PROGRESS')) {
        updates.startedAt = new Date()
      }
    }

    if (Object.keys(updates).length > 0) {
      await this.db
        .update(tasksTable)
        .set(updates)
        .where(eq(tasksTable.id, id))
    }

    // Periksa apakah semua task dalam story selesai -> auto-close story
    if (isStatusChanged) {
      await this.checkAndUpdateStoryCompletion(existing.storyId)
    }

    await this.activityLogsService.record({
      entityType: 'TASK',
      entityId: id,
      action: isStatusChanged ? 'TASK_STATUS_CHANGED' : 'TASK_UPDATED',
      actorId: user.userId,
      before: {
        status: existing.status,
        title: existing.title,
        assigneeId: existing.assigneeId,
      },
      after: {
        status: updates.status ?? existing.status,
        title: updates.title ?? existing.title,
        assigneeId: updates.assigneeId !== undefined ? updates.assigneeId : existing.assigneeId,
      },
    })

    return this.findOne(id)
  }

  // ─── 5. Hapus Task ─────────────────────────────────────────────────────────
  async delete(id: string, user: RequestUser) {
    const [existing] = await this.db
      .select({
        id: tasksTable.id,
        storyId: tasksTable.storyId,
        divisionId: storiesTable.divisionId,
        title: tasksTable.title,
      })
      .from(tasksTable)
      .innerJoin(storiesTable, eq(tasksTable.storyId, storiesTable.id))
      .where(eq(tasksTable.id, id))

    if (!existing) {
      throw new NotFoundException('Task tidak ditemukan.')
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
          'Hanya Koordinator divisi atau administrator yang dapat menghapus task.',
        )
      }
    }

    await this.db.delete(tasksTable).where(eq(tasksTable.id, id))

    // Periksa status penyelesaian story setelah penghapusan
    await this.checkAndUpdateStoryCompletion(existing.storyId)

    await this.activityLogsService.record({
      entityType: 'TASK',
      entityId: id,
      action: 'TASK_DELETED',
      actorId: user.userId,
      before: { title: existing.title, storyId: existing.storyId },
      after: null,
    })

    return { success: true, message: 'Task berhasil dihapus.' }
  }

  // ─── Helper: Auto-close Story jika seluruh Task berstatus DONE ──────────────
  private async checkAndUpdateStoryCompletion(storyId: string) {
    const allStoryTasks = await this.db
      .select({
        id: tasksTable.id,
        status: tasksTable.status,
      })
      .from(tasksTable)
      .where(eq(tasksTable.storyId, storyId))

    if (allStoryTasks.length === 0) {
      return
    }

    const allDone = allStoryTasks.every((t) => t.status === 'DONE')

    const [story] = await this.db
      .select({
        id: storiesTable.id,
        closedAt: storiesTable.closedAt,
      })
      .from(storiesTable)
      .where(eq(storiesTable.id, storyId))

    if (!story) return

    if (allDone && !story.closedAt) {
      await this.db
        .update(storiesTable)
        .set({ closedAt: new Date() })
        .where(eq(storiesTable.id, storyId))
    } else if (!allDone && story.closedAt) {
      await this.db
        .update(storiesTable)
        .set({ closedAt: null })
        .where(eq(storiesTable.id, storyId))
    }
  }
}
