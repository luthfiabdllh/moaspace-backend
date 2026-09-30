import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { and, asc, desc, eq, ilike, or } from 'drizzle-orm'
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
import { TaskTransitionService } from './task-transition.service.js'
import type { RequestUser } from '../common/decorators/current-user.decorator.js'
import type { CreateTaskDto } from './dto/create-task.dto.js'
import type { UpdateTaskDto } from './dto/update-task.dto.js'
import type { QueryTasksDto } from './dto/query-tasks.dto.js'
import type { MoveTaskDto } from './dto/move-task.dto.js'
import type { BlockTaskDto } from './dto/block-task.dto.js'
import type { QueryBoardDto } from './dto/query-board.dto.js'

@Injectable()
export class TasksService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly activityLogsService: ActivityLogsService,
    private readonly taskTransitionService: TaskTransitionService,
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

  // ─── 6. Pindahkan Status & Posisi Task (Kanban Move) ──────────────────────
  async move(id: string, dto: MoveTaskDto, user: RequestUser) {
    const [task] = await this.db
      .select({
        id: tasksTable.id,
        status: tasksTable.status,
        position: tasksTable.position,
        assigneeId: tasksTable.assigneeId,
        storyId: tasksTable.storyId,
        divisionId: storiesTable.divisionId,
        revisionCount: tasksTable.revisionCount,
        startedAt: tasksTable.startedAt,
        completedAt: tasksTable.completedAt,
      })
      .from(tasksTable)
      .innerJoin(storiesTable, eq(tasksTable.storyId, storiesTable.id))
      .where(eq(tasksTable.id, id))

    if (!task) {
      throw new NotFoundException('Task tidak ditemukan.')
    }

    const isGlobalAdmin = Boolean(user.isSuperAdmin || user.isKormanit)
    let isCoordinator = isGlobalAdmin
    if (!isCoordinator) {
      const [membership] = await this.db
        .select()
        .from(divisionMembersTable)
        .where(
          and(
            eq(divisionMembersTable.divisionId, task.divisionId),
            eq(divisionMembersTable.userId, user.userId),
            eq(divisionMembersTable.role, 'COORDINATOR'),
          ),
        )
      isCoordinator = Boolean(membership)
    }

    const isAssignee = Boolean(task.assigneeId && task.assigneeId === user.userId)

    const transition = this.taskTransitionService.validateTransition(
      task,
      dto.status,
      { userId: user.userId, isCoordinator, isAssignee },
    )

    const updatePayload: Record<string, any> = {
      status: transition.status,
      position: dto.position,
      updatedAt: new Date(),
    }
    if (transition.startedAt !== undefined) {
      updatePayload.startedAt = transition.startedAt
    }
    if (transition.completedAt !== undefined) {
      updatePayload.completedAt = transition.completedAt
    }
    if (transition.revisionCount !== undefined) {
      updatePayload.revisionCount = transition.revisionCount
    }

    await this.db
      .update(tasksTable)
      .set(updatePayload)
      .where(eq(tasksTable.id, id))

    // Cek auto-close atau re-open Story
    await this.checkAndUpdateStoryCompletion(task.storyId)

    // Catat activity log audit
    await this.activityLogsService.record({
      entityType: 'TASK',
      entityId: id,
      action: 'TASK_MOVED',
      actorId: user.userId,
      before: { status: task.status, position: task.position },
      after: { status: transition.status, position: dto.position },
    })

    return this.findOne(id)
  }

  // ─── 7. Tandai Task sebagai Terkendala (Blocked) ──────────────────────────
  async block(id: string, dto: BlockTaskDto, user: RequestUser) {
    const [task] = await this.db
      .select({
        id: tasksTable.id,
        status: tasksTable.status,
        isBlocked: tasksTable.isBlocked,
        blockedReason: tasksTable.blockedReason,
        divisionId: storiesTable.divisionId,
      })
      .from(tasksTable)
      .innerJoin(storiesTable, eq(tasksTable.storyId, storiesTable.id))
      .where(eq(tasksTable.id, id))

    if (!task) {
      throw new NotFoundException('Task tidak ditemukan.')
    }

    if (task.status === 'DONE') {
      throw new UnprocessableEntityException(
        'Task yang sudah selesai (DONE) tidak dapat ditandai sebagai kendala/blocked.',
      )
    }

    const isGlobalAdmin = Boolean(user.isSuperAdmin || user.isKormanit)
    let isMember = isGlobalAdmin
    if (!isMember) {
      const [membership] = await this.db
        .select()
        .from(divisionMembersTable)
        .where(
          and(
            eq(divisionMembersTable.divisionId, task.divisionId),
            eq(divisionMembersTable.userId, user.userId),
          ),
        )
      isMember = Boolean(membership)
    }

    if (!isMember) {
      throw new ForbiddenException('Bukan anggota divisi terkait.')
    }

    await this.db
      .update(tasksTable)
      .set({
        isBlocked: true,
        blockedReason: dto.reason,
        updatedAt: new Date(),
      })
      .where(eq(tasksTable.id, id))

    await this.activityLogsService.record({
      entityType: 'TASK',
      entityId: id,
      action: 'TASK_BLOCKED',
      actorId: user.userId,
      before: { isBlocked: task.isBlocked, blockedReason: task.blockedReason },
      after: { isBlocked: true, blockedReason: dto.reason },
    })

    return this.findOne(id)
  }

  // ─── 8. Lepas Status Kendala (Unblock) ─────────────────────────────────────
  async unblock(id: string, user: RequestUser) {
    const [task] = await this.db
      .select({
        id: tasksTable.id,
        isBlocked: tasksTable.isBlocked,
        blockedReason: tasksTable.blockedReason,
        divisionId: storiesTable.divisionId,
      })
      .from(tasksTable)
      .innerJoin(storiesTable, eq(tasksTable.storyId, storiesTable.id))
      .where(eq(tasksTable.id, id))

    if (!task) {
      throw new NotFoundException('Task tidak ditemukan.')
    }

    const isGlobalAdmin = Boolean(user.isSuperAdmin || user.isKormanit)
    let isMember = isGlobalAdmin
    if (!isMember) {
      const [membership] = await this.db
        .select()
        .from(divisionMembersTable)
        .where(
          and(
            eq(divisionMembersTable.divisionId, task.divisionId),
            eq(divisionMembersTable.userId, user.userId),
          ),
        )
      isMember = Boolean(membership)
    }

    if (!isMember) {
      throw new ForbiddenException('Bukan anggota divisi terkait.')
    }

    await this.db
      .update(tasksTable)
      .set({
        isBlocked: false,
        blockedReason: null,
        updatedAt: new Date(),
      })
      .where(eq(tasksTable.id, id))

    await this.activityLogsService.record({
      entityType: 'TASK',
      entityId: id,
      action: 'TASK_UNBLOCKED',
      actorId: user.userId,
      before: { isBlocked: task.isBlocked, blockedReason: task.blockedReason },
      after: { isBlocked: false, blockedReason: null },
    })

    return this.findOne(id)
  }

  // ─── 9. Ambil Board Kanban Divisi (5 Kolom) ──────────────────────────────
  async getDivisionBoard(
    divisionId: string,
    query: QueryBoardDto,
    _user?: RequestUser,
  ) {
    const [division] = await this.db
      .select({ id: divisionsTable.id, name: divisionsTable.name })
      .from(divisionsTable)
      .where(eq(divisionsTable.id, divisionId))

    if (!division) {
      throw new NotFoundException('Divisi tidak ditemukan.')
    }

    const conditions = [eq(storiesTable.divisionId, divisionId)]

    if (query.assigneeId) {
      conditions.push(eq(tasksTable.assigneeId, query.assigneeId))
    }

    if (query.epicId) {
      conditions.push(eq(storiesTable.epicId, query.epicId))
    }

    if (query.prokerTag) {
      conditions.push(eq(storiesTable.prokerTag, query.prokerTag))
    }

    if (query.priority) {
      conditions.push(eq(tasksTable.priority, query.priority))
    }

    if (query.isBlocked !== undefined) {
      conditions.push(eq(tasksTable.isBlocked, query.isBlocked))
    }

    if (query.search) {
      const term = `%${query.search.trim()}%`
      conditions.push(
        or(
          ilike(tasksTable.title, term),
          ilike(tasksTable.description, term),
        )!,
      )
    }

    const tasks = await this.db
      .select({
        id: tasksTable.id,
        storyId: tasksTable.storyId,
        storyTitle: storiesTable.title,
        epicId: storiesTable.epicId,
        epicTitle: epicsTable.title,
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
      .leftJoin(epicsTable, eq(storiesTable.epicId, epicsTable.id))
      .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
      .where(and(...conditions))
      .orderBy(asc(tasksTable.position), desc(tasksTable.createdAt))

    return {
      BACKLOG: tasks.filter((t) => t.status === 'BACKLOG'),
      TODO: tasks.filter((t) => t.status === 'TODO'),
      IN_PROGRESS: tasks.filter((t) => t.status === 'IN_PROGRESS'),
      REVIEW: tasks.filter((t) => t.status === 'REVIEW'),
      DONE: tasks.filter((t) => t.status === 'DONE'),
    }
  }

  // ─── 10. Ambil Tugas Saya Lintas Divisi ───────────────────────────────────
  async getMeTasks(user: RequestUser) {
    const tasks = await this.db
      .select({
        id: tasksTable.id,
        storyId: tasksTable.storyId,
        storyTitle: storiesTable.title,
        epicId: storiesTable.epicId,
        epicTitle: epicsTable.title,
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
      .leftJoin(epicsTable, eq(storiesTable.epicId, epicsTable.id))
      .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
      .where(eq(tasksTable.assigneeId, user.userId))
      .orderBy(asc(tasksTable.position), desc(tasksTable.createdAt))

    return {
      BACKLOG: tasks.filter((t) => t.status === 'BACKLOG'),
      TODO: tasks.filter((t) => t.status === 'TODO'),
      IN_PROGRESS: tasks.filter((t) => t.status === 'IN_PROGRESS'),
      REVIEW: tasks.filter((t) => t.status === 'REVIEW'),
      DONE: tasks.filter((t) => t.status === 'DONE'),
    }
  }
}
