import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { and, asc, desc, eq, ilike, or } from 'drizzle-orm'
import {
  assignmentOverridesTable,
  divisionMembersTable,
  divisionsTable,
  epicsTable,
  requestsTable,
  storiesTable,
  tasksTable,
  taskSpLogsTable,
  usersTable,
} from '@moaspace/database'
import { DATABASE_CONNECTION, type Database } from '../database/database.provider.js'
import { ActivityLogsService } from '../activity-logs/activity-logs.service.js'
import { CapacityService } from '../capacity/capacity.service.js'
import { TaskTransitionService } from './task-transition.service.js'
import { CalendarService } from '../calendar/calendar.service.js'
import { MailService } from '../mail/mail.service.js'
import type { RequestUser } from '../common/decorators/current-user.decorator.js'
import type { CreateTaskDto } from './dto/create-task.dto.js'
import type { UpdateTaskDto } from './dto/update-task.dto.js'
import type { QueryTasksDto } from './dto/query-tasks.dto.js'
import type { MoveTaskDto } from './dto/move-task.dto.js'
import type { BlockTaskDto } from './dto/block-task.dto.js'
import type { QueryBoardDto } from './dto/query-board.dto.js'
import crypto from 'node:crypto'

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name)

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly activityLogsService: ActivityLogsService,
    private readonly taskTransitionService: TaskTransitionService,
    private readonly capacityService: CapacityService,
    private readonly calendarService: CalendarService,
    private readonly mailService: MailService,
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
        epicId: storiesTable.epicId,
        epicTitle: epicsTable.title,
        sourceRequestId: storiesTable.sourceRequestId,
        requestTitle: requestsTable.title,
        divisionId: storiesTable.divisionId,
        divisionName: divisionsTable.name,
        title: tasksTable.title,
        description: tasksTable.description,
        status: tasksTable.status,
        priority: tasksTable.priority,
        storyPoints: tasksTable.storyPoints,
        spLockedAt: tasksTable.spLockedAt,
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
      .leftJoin(requestsTable, eq(storiesTable.sourceRequestId, requestsTable.id))
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
        epicId: storiesTable.epicId,
        epicTitle: epicsTable.title,
        sourceRequestId: storiesTable.sourceRequestId,
        requestTitle: requestsTable.title,
        divisionId: storiesTable.divisionId,
        divisionName: divisionsTable.name,
        title: tasksTable.title,
        description: tasksTable.description,
        status: tasksTable.status,
        priority: tasksTable.priority,
        storyPoints: tasksTable.storyPoints,
        spLockedAt: tasksTable.spLockedAt,
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
      .leftJoin(requestsTable, eq(storiesTable.sourceRequestId, requestsTable.id))
      .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
      .where(eq(tasksTable.id, id))

    if (!task) {
      throw new NotFoundException('Task tidak ditemukan.')
    }

    const activityLogs = await this.activityLogsService.findByEntity('TASK', id)

    const spLogs = await this.db
      .select({
        id: taskSpLogsTable.id,
        oldSp: taskSpLogsTable.oldSp,
        newSp: taskSpLogsTable.newSp,
        reason: taskSpLogsTable.reason,
        changedById: taskSpLogsTable.changedById,
        changedByName: usersTable.name,
        createdAt: taskSpLogsTable.createdAt,
      })
      .from(taskSpLogsTable)
      .leftJoin(usersTable, eq(taskSpLogsTable.changedById, usersTable.id))
      .where(eq(taskSpLogsTable.taskId, id))
      .orderBy(desc(taskSpLogsTable.createdAt))

    return {
      ...task,
      activityLogs,
      spLogs,
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

    // Aturan Story Point skala Fibonacci KKN: 1, 2, 3, 5, 8
    if (dto.storyPoints !== undefined && dto.storyPoints !== null) {
      if (![1, 2, 3, 5, 8].includes(dto.storyPoints)) {
        throw new BadRequestException(
          'Estimasi Story Point hanya boleh bernilai 1, 2, 3, 5, atau 8. Jika lebih dari 8, pecah task menjadi beberapa sub-task.',
        )
      }
    }

    // Validasi To Do / In Progress awal: wajib SP dan Assignee
    const initialStatus = dto.status || 'BACKLOG'
    if (initialStatus === 'TODO' || initialStatus === 'IN_PROGRESS') {
      if (!dto.storyPoints) {
        throw new UnprocessableEntityException(
          'Task yang berstatus To Do atau In Progress wajib memiliki estimasi Story Point (skala 1, 2, 3, 5, 8).',
        )
      }
      if (!dto.assigneeId) {
        throw new UnprocessableEntityException(
          'Task yang berstatus To Do atau In Progress wajib memiliki Assignee.',
        )
      }
    }

    // Validasi akun assignee jika ditugaskan
    if (dto.assigneeId) {
      const [assigneeUser] = await this.db
        .select({ id: usersTable.id, status: usersTable.status })
        .from(usersTable)
        .where(eq(usersTable.id, dto.assigneeId))

      if (!assigneeUser || assigneeUser.status !== 'ACTIVE') {
        throw new BadRequestException(
          'Pengguna yang dipilih tidak aktif atau dinonaktifkan sehingga tidak dapat ditugaskan.',
        )
      }
    }

    // Cek Overcapacity jika task aktif ditugaskan ke anggota
    let isOvercapacity = false
    let overcapacityUtilization = 0
    if (
      dto.assigneeId &&
      dto.storyPoints &&
      ['TODO', 'IN_PROGRESS', 'REVIEW'].includes(initialStatus)
    ) {
      const utilization = await this.capacityService.getUserUtilization(dto.assigneeId)
      const currentActiveSp = utilization.activeSp
      const capacitySp = utilization.capacitySp
      const projectedSp = currentActiveSp + dto.storyPoints
      const projectedUtilization = Math.round((projectedSp / capacitySp) * 100)

      if (projectedUtilization > 100) {
        if (!dto.override) {
          throw new ConflictException({
            statusCode: 409,
            error: 'OVERCAPACITY_WARNING',
            message: `Penugasan ini menyebabkan beban ${utilization.userName} mencapai ${projectedUtilization}% (melebihi kapasitas mingguan ${capacitySp} SP).`,
            data: {
              assigneeId: dto.assigneeId,
              assigneeName: utilization.userName,
              currentActiveSp,
              taskSp: dto.storyPoints,
              capacitySp,
              projectedSp,
              utilizationPercentage: projectedUtilization,
            },
          })
        }
        isOvercapacity = true
        overcapacityUtilization = projectedUtilization
      }
    }

    const taskId = crypto.randomUUID()
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : null
    const position = dto.position || `${Date.now()}`
    const isStartingInProgress = initialStatus === 'IN_PROGRESS'
    const spLockedAt = isStartingInProgress ? new Date() : null
    const startedAt = isStartingInProgress ? new Date() : null

    const [created] = await this.db
      .insert(tasksTable)
      .values({
        id: taskId,
        storyId: dto.storyId,
        title: dto.title.trim(),
        description: dto.description || null,
        assigneeId: dto.assigneeId || null,
        status: initialStatus,
        priority: dto.priority || 'MEDIUM',
        storyPoints: dto.storyPoints ?? null,
        spLockedAt,
        startedAt,
        dueDate,
        position,
        isBlocked: dto.isBlocked ?? false,
        blockedReason: dto.blockedReason || null,
      })
      .returning()

    if (!created) {
      throw new Error('Gagal membuat task.')
    }

    if (isOvercapacity && dto.assigneeId) {
      await this.db.insert(assignmentOverridesTable).values({
        id: crypto.randomUUID(),
        taskId,
        assigneeId: dto.assigneeId,
        utilizationAtAssign: overcapacityUtilization,
        overriddenById: user.userId,
      })
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
        storyPoints: created.storyPoints,
      },
    })

    // Sync ke Google Calendar jika memiliki dueDate dan assignee
    this.calendarService.syncTaskEvent(taskId).catch((err) => {
      this.logger.error(`Failed to sync calendar for created task ${taskId}: ${err.message}`)
    })

    // Kirim notifikasi email penugasan jika task memiliki assignee
    if (dto.assigneeId) {
      this.sendTaskAssignedNotification(taskId, dto.assigneeId, user.userId).catch((err) => {
        this.logger.error(`Failed to send task assigned email for task ${taskId}: ${err.message}`)
      })
    }

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
        storyPoints: tasksTable.storyPoints,
        spLockedAt: tasksTable.spLockedAt,
        revisionCount: tasksTable.revisionCount,
        startedAt: tasksTable.startedAt,
      })
      .from(tasksTable)
      .innerJoin(storiesTable, eq(tasksTable.storyId, storiesTable.id))
      .where(eq(tasksTable.id, id))

    if (!existing) {
      throw new NotFoundException('Task tidak ditemukan.')
    }

    const isGlobalAdmin = Boolean(user.isSuperAdmin || user.isKormanit)
    let isCoordinator = isGlobalAdmin

    if (!isGlobalAdmin) {
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
      isCoordinator = membership.role === 'COORDINATOR'
    }

    // Validasi Story Point Fibonacci: 1, 2, 3, 5, 8
    if (dto.storyPoints !== undefined && dto.storyPoints !== null) {
      if (![1, 2, 3, 5, 8].includes(dto.storyPoints)) {
        throw new BadRequestException(
          'Estimasi Story Point hanya boleh bernilai 1, 2, 3, 5, atau 8. Jika lebih dari 8, pecah task menjadi beberapa sub-task.',
        )
      }
    }

    const updates: Partial<typeof tasksTable.$inferInsert> = {}

    // Aturan Kunci SP:
    // SP otomatis terkunci ketika task beralih ke IN_PROGRESS. Pengubahan setelahnya hanya oleh Koordinator dengan mencantumkan alasan wajib yang dicatat di task_sp_logs.
    if (dto.storyPoints !== undefined && dto.storyPoints !== existing.storyPoints) {
      const isSpLocked = Boolean(existing.spLockedAt || ['IN_PROGRESS', 'REVIEW', 'DONE'].includes(existing.status))
      if (isSpLocked) {
        if (!isCoordinator) {
          throw new ForbiddenException(
            'Story Point telah dikunci karena pengerjaan task sudah dimulai. Hanya Koordinator yang berwenang mengubah Story Point.',
          )
        }
        if (!dto.spReason || !dto.spReason.trim()) {
          throw new BadRequestException(
            'Perubahan Story Point yang sudah terkunci wajib menyertakan alasan yang jelas (spReason).',
          )
        }
        await this.db.insert(taskSpLogsTable).values({
          id: crypto.randomUUID(),
          taskId: id,
          oldSp: existing.storyPoints,
          newSp: dto.storyPoints ?? 0,
          changedById: user.userId,
          reason: dto.spReason.trim(),
        })
      }
      updates.storyPoints = dto.storyPoints
    }

    // Overcapacity Check: jika assignee berubah, ATAU task berpindah dari
    // status tidak-aktif (BACKLOG/DONE) ke status aktif (TODO/IN_PROGRESS/
    // REVIEW) yang menghitung ke beban kerja anggota (konsisten dengan move()).
    const targetStatus = dto.status ?? existing.status
    const effectiveSp = dto.storyPoints !== undefined ? dto.storyPoints : (existing.storyPoints ?? 0)
    const effectiveAssigneeId = dto.assigneeId !== undefined ? dto.assigneeId : existing.assigneeId

    const ACTIVE_CAPACITY_STATUSES = ['TODO', 'IN_PROGRESS', 'REVIEW']
    const assigneeChanged =
      dto.assigneeId !== undefined &&
      dto.assigneeId !== null &&
      dto.assigneeId !== existing.assigneeId

    // Validasi akun assignee jika diubah ke pengguna tertentu
    if (assigneeChanged && dto.assigneeId) {
      const [assigneeUser] = await this.db
        .select({ id: usersTable.id, status: usersTable.status })
        .from(usersTable)
        .where(eq(usersTable.id, dto.assigneeId))

      if (!assigneeUser || assigneeUser.status !== 'ACTIVE') {
        throw new BadRequestException(
          'Pengguna yang dipilih tidak aktif atau dinonaktifkan sehingga tidak dapat ditugaskan.',
        )
      }
    }
    const wasActiveForCapacity = ACTIVE_CAPACITY_STATUSES.includes(existing.status)
    const willBeActiveForCapacity = ACTIVE_CAPACITY_STATUSES.includes(targetStatus)

    let isOvercapacity = false
    let overcapacityUtilization = 0

    if (
      effectiveAssigneeId &&
      effectiveSp &&
      effectiveSp > 0 &&
      willBeActiveForCapacity &&
      (assigneeChanged || !wasActiveForCapacity)
    ) {
      const utilization = await this.capacityService.getUserUtilization(effectiveAssigneeId)
      const currentActiveSp = utilization.activeSp
      const capacitySp = utilization.capacitySp
      const projectedSp = currentActiveSp + effectiveSp
      const projectedUtilization = Math.round((projectedSp / capacitySp) * 100)

      if (projectedUtilization > 100) {
        if (!dto.override) {
          throw new ConflictException({
            statusCode: 409,
            error: 'OVERCAPACITY_WARNING',
            message: `Penugasan ini menyebabkan beban ${utilization.userName} mencapai ${projectedUtilization}% (melebihi kapasitas mingguan ${capacitySp} SP).`,
            data: {
              assigneeId: effectiveAssigneeId,
              assigneeName: utilization.userName,
              currentActiveSp,
              taskSp: effectiveSp,
              capacitySp,
              projectedSp,
              utilizationPercentage: projectedUtilization,
            },
          })
        }
        isOvercapacity = true
        overcapacityUtilization = projectedUtilization
      }
    }

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

    // Tangani perubahan status: divalidasi lewat TaskTransitionService yang
    // SAMA dipakai oleh move() (drag-and-drop Kanban), supaya tombol "Ubah
    // Status Alur Kerja" di panel detail task tidak bisa melewati aturan role,
    // urutan tahap, maupun syarat SP+Assignee yang berlaku di drag-and-drop.
    let isStatusChanged = false
    if (dto.status !== undefined && dto.status !== existing.status) {
      isStatusChanged = true

      const isAssignee = Boolean(existing.assigneeId && existing.assigneeId === user.userId)
      const transition = this.taskTransitionService.validateTransition(
        {
          id: existing.id,
          status: existing.status,
          assigneeId: effectiveAssigneeId,
          storyPoints: effectiveSp,
          divisionId: existing.divisionId,
          revisionCount: existing.revisionCount,
          startedAt: existing.startedAt,
        },
        dto.status,
        { userId: user.userId, isCoordinator, isAssignee },
      )

      updates.status = transition.status
      if (transition.startedAt !== undefined) updates.startedAt = transition.startedAt
      if (transition.completedAt !== undefined) updates.completedAt = transition.completedAt
      if (transition.spLockedAt !== undefined) updates.spLockedAt = transition.spLockedAt
      if (transition.revisionCount !== undefined) updates.revisionCount = transition.revisionCount
    }

    if (Object.keys(updates).length > 0) {
      await this.db
        .update(tasksTable)
        .set(updates)
        .where(eq(tasksTable.id, id))
    }

    if (isOvercapacity && effectiveAssigneeId) {
      await this.db.insert(assignmentOverridesTable).values({
        id: crypto.randomUUID(),
        taskId: id,
        assigneeId: effectiveAssigneeId,
        utilizationAtAssign: overcapacityUtilization,
        overriddenById: user.userId,
      })
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
        storyPoints: existing.storyPoints,
      },
      after: {
        status: updates.status ?? existing.status,
        title: updates.title ?? existing.title,
        assigneeId: updates.assigneeId !== undefined ? updates.assigneeId : existing.assigneeId,
        storyPoints: updates.storyPoints !== undefined ? updates.storyPoints : existing.storyPoints,
      },
    })

    // Sync ke Google Calendar
    this.calendarService.syncTaskEvent(id).catch((err) => {
      this.logger.error(`Failed to sync calendar for updated task ${id}: ${err.message}`)
    })

    // Kirim notifikasi email jika assignee berubah
    if (assigneeChanged && dto.assigneeId) {
      this.sendTaskAssignedNotification(id, dto.assigneeId, user.userId).catch((err) => {
        this.logger.error(`Failed to send task assigned email for task ${id}: ${err.message}`)
      })
    }

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

    await this.calendarService.syncTaskEvent(id, true).catch(() => {})

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
        storyPoints: tasksTable.storyPoints,
        spLockedAt: tasksTable.spLockedAt,
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
      {
        id: task.id,
        status: task.status,
        assigneeId: task.assigneeId,
        storyPoints: task.storyPoints,
        divisionId: task.divisionId,
        revisionCount: task.revisionCount,
        startedAt: task.startedAt,
      },
      dto.status,
      { userId: user.userId, isCoordinator, isAssignee },
    )

    // Cek Overcapacity jika task bergerak dari status TIDAK aktif (BACKLOG/DONE)
    // ke status aktif (TODO/IN_PROGRESS/REVIEW) yang menghitung ke beban kerja
    // anggota. Berlaku juga untuk lompatan tahap langsung oleh Koordinator
    // (misal BACKLOG -> IN_PROGRESS), tidak hanya BACKLOG -> TODO.
    const ACTIVE_CAPACITY_STATUSES = ['TODO', 'IN_PROGRESS', 'REVIEW']
    const wasActiveForCapacity = ACTIVE_CAPACITY_STATUSES.includes(task.status)
    const willBeActiveForCapacity = ACTIVE_CAPACITY_STATUSES.includes(dto.status)

    let isOvercapacity = false
    let overcapacityUtilization = 0
    if (
      !wasActiveForCapacity &&
      willBeActiveForCapacity &&
      task.assigneeId &&
      task.storyPoints
    ) {
      const utilization = await this.capacityService.getUserUtilization(task.assigneeId)
      const currentActiveSp = utilization.activeSp
      const capacitySp = utilization.capacitySp
      const projectedSp = currentActiveSp + task.storyPoints
      const projectedUtilization = Math.round((projectedSp / capacitySp) * 100)

      if (projectedUtilization > 100) {
        if (!dto.override) {
          throw new ConflictException({
            statusCode: 409,
            error: 'OVERCAPACITY_WARNING',
            message: `Memindahkan task ini ke ${dto.status} menyebabkan beban ${utilization.userName} mencapai ${projectedUtilization}% (melebihi kapasitas mingguan ${capacitySp} SP).`,
            data: {
              assigneeId: task.assigneeId,
              assigneeName: utilization.userName,
              currentActiveSp,
              taskSp: task.storyPoints,
              capacitySp,
              projectedSp,
              utilizationPercentage: projectedUtilization,
            },
          })
        }
        isOvercapacity = true
        overcapacityUtilization = projectedUtilization
      }
    }

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
    if (transition.spLockedAt !== undefined) {
      updatePayload.spLockedAt = transition.spLockedAt
    }
    if (transition.revisionCount !== undefined) {
      updatePayload.revisionCount = transition.revisionCount
    }

    await this.db
      .update(tasksTable)
      .set(updatePayload)
      .where(eq(tasksTable.id, id))

    if (isOvercapacity && task.assigneeId) {
      await this.db.insert(assignmentOverridesTable).values({
        id: crypto.randomUUID(),
        taskId: id,
        assigneeId: task.assigneeId,
        utilizationAtAssign: overcapacityUtilization,
        overriddenById: user.userId,
      })
    }

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

    // Sync ke Google Calendar
    this.calendarService.syncTaskEvent(id).catch((err) => {
      this.logger.error(`Failed to sync calendar for moved task ${id}: ${err.message}`)
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
        sourceRequestId: storiesTable.sourceRequestId,
        requestTitle: requestsTable.title,
        divisionId: storiesTable.divisionId,
        divisionName: divisionsTable.name,
        title: tasksTable.title,
        description: tasksTable.description,
        status: tasksTable.status,
        priority: tasksTable.priority,
        storyPoints: tasksTable.storyPoints,
        spLockedAt: tasksTable.spLockedAt,
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
      .leftJoin(requestsTable, eq(storiesTable.sourceRequestId, requestsTable.id))
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
        sourceRequestId: storiesTable.sourceRequestId,
        requestTitle: requestsTable.title,
        divisionId: storiesTable.divisionId,
        divisionName: divisionsTable.name,
        title: tasksTable.title,
        description: tasksTable.description,
        status: tasksTable.status,
        priority: tasksTable.priority,
        storyPoints: tasksTable.storyPoints,
        spLockedAt: tasksTable.spLockedAt,
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
      .leftJoin(requestsTable, eq(storiesTable.sourceRequestId, requestsTable.id))
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

  private async sendTaskAssignedNotification(
    taskId: string,
    assigneeId: string,
    assignerUserId: string,
  ): Promise<void> {
    if (!assigneeId || assigneeId === assignerUserId) return
    try {
      const [task] = await this.db
        .select({
          id: tasksTable.id,
          title: tasksTable.title,
          priority: tasksTable.priority,
          dueDate: tasksTable.dueDate,
          divisionName: divisionsTable.name,
        })
        .from(tasksTable)
        .innerJoin(storiesTable, eq(tasksTable.storyId, storiesTable.id))
        .leftJoin(divisionsTable, eq(storiesTable.divisionId, divisionsTable.id))
        .where(eq(tasksTable.id, taskId))

      const [assignee] = await this.db
        .select({ name: usersTable.name, email: usersTable.email })
        .from(usersTable)
        .where(
          and(
            eq(usersTable.id, assigneeId),
            eq(usersTable.status, 'ACTIVE'),
          ),
        )

      const [assigner] = await this.db
        .select({ name: usersTable.name })
        .from(usersTable)
        .where(eq(usersTable.id, assignerUserId))

      if (task && assignee && assignee.email) {
        await this.mailService.sendTaskAssigned(
          assignee,
          {
            id: task.id,
            title: task.title,
            divisionName: task.divisionName ?? undefined,
            priority: task.priority,
            dueDate: task.dueDate,
          },
          assigner?.name ?? 'Koordinator',
        )
      }
    } catch (err: any) {
      this.logger.error(`Failed to send task assigned email for task ${taskId}: ${err.message}`)
    }
  }
}
