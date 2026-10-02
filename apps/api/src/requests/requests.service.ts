import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import {
  divisionMembersTable,
  divisionsTable,
  epicsTable,
  requestEventsTable,
  requestTemplatesTable,
  requestsTable,
  storiesTable,
  tasksTable,
  usersTable,
} from '@moaspace/database'
import { DATABASE_CONNECTION, type Database } from '../database/database.provider.js'
import { ActivityLogsService } from '../activity-logs/activity-logs.service.js'
import type { RequestUser } from '../common/decorators/current-user.decorator.js'
import type { CreateRequestTemplateDto } from './dto/create-template.dto.js'
import type { UpdateRequestTemplateDto } from './dto/update-template.dto.js'
import type { CreateRequestDto } from './dto/create-request.dto.js'
import type { UpdateRequestDto } from './dto/update-request.dto.js'
import type { OriginApprovalDto } from './dto/origin-approval.dto.js'
import type { TriageRequestDto } from './dto/triage-request.dto.js'
import type { RespondInfoDto } from './dto/respond-info.dto.js'
import type { ConvertToStoryDto } from './dto/convert-to-story.dto.js'
import type { DeliverRequestDto } from './dto/deliver-request.dto.js'
import type { ConfirmRequestDto } from './dto/confirm-request.dto.js'
import type { QueryRequestsDto } from './dto/query-requests.dto.js'
import { randomUUID } from 'node:crypto'

@Injectable()
export class RequestsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. TEMPLATES MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  async findAllTemplates(divisionId: string) {
    return this.db
      .select()
      .from(requestTemplatesTable)
      .where(eq(requestTemplatesTable.divisionId, divisionId))
      .orderBy(desc(requestTemplatesTable.createdAt))
  }

  async findTemplateById(id: string) {
    const [template] = await this.db
      .select()
      .from(requestTemplatesTable)
      .where(eq(requestTemplatesTable.id, id))

    if (!template) {
      throw new NotFoundException('Template request tidak ditemukan.')
    }

    return template
  }

  async createTemplate(
    divisionId: string,
    dto: CreateRequestTemplateDto,
    user: RequestUser,
  ) {
    await this.assertCoordinator(divisionId, user, 'membuat template request')

    const id = randomUUID()
    const [template] = await this.db
      .insert(requestTemplatesTable)
      .values({
        id,
        divisionId,
        name: dto.name,
        description: dto.description ?? null,
        fields: dto.fields,
      })
      .returning()

    await this.activityLogsService.record({
      entityType: 'REQUEST',
      entityId: id,
      action: 'TEMPLATE_CREATED',
      actorId: user.userId,
      before: null,
      after: { name: dto.name, divisionId },
    })

    return template
  }

  async updateTemplate(
    id: string,
    dto: UpdateRequestTemplateDto,
    user: RequestUser,
  ) {
    const existing = await this.findTemplateById(id)
    await this.assertCoordinator(
      existing.divisionId,
      user,
      'memperbarui template request',
    )

    const [updated] = await this.db
      .update(requestTemplatesTable)
      .set({
        name: dto.name ?? existing.name,
        description:
          dto.description !== undefined ? dto.description : existing.description,
        fields: dto.fields ?? existing.fields,
        updatedAt: new Date(),
      })
      .where(eq(requestTemplatesTable.id, id))
      .returning()

    if (!updated) {
      throw new NotFoundException('Template request tidak ditemukan.')
    }

    await this.activityLogsService.record({
      entityType: 'REQUEST',
      entityId: id,
      action: 'TEMPLATE_UPDATED',
      actorId: user.userId,
      before: { name: existing.name },
      after: { name: updated.name },
    })

    return updated
  }

  async deleteTemplate(id: string, user: RequestUser) {
    const existing = await this.findTemplateById(id)
    await this.assertCoordinator(
      existing.divisionId,
      user,
      'menghapus template request',
    )

    await this.db
      .delete(requestTemplatesTable)
      .where(eq(requestTemplatesTable.id, id))

    await this.activityLogsService.record({
      entityType: 'REQUEST',
      entityId: id,
      action: 'TEMPLATE_DELETED',
      actorId: user.userId,
      before: { name: existing.name, divisionId: existing.divisionId },
      after: null,
    })

    return { success: true, message: 'Template request berhasil dihapus.' }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. REQUESTS LIFECYCLE & STATE MACHINE
  // ─────────────────────────────────────────────────────────────────────────────

  async createRequest(dto: CreateRequestDto, user: RequestUser) {
    if (dto.fromDivisionId === dto.toDivisionId) {
      throw new BadRequestException(
        'Divisi asal dan divisi tujuan tidak boleh sama untuk request antar divisi.',
      )
    }

    // Pastikan user anggota divisi asal (atau super admin/kormanit)
    await this.assertMember(dto.fromDivisionId, user, 'membuat request dari divisi ini')

    // Ambil setting approval divisi asal
    const [fromDivision] = await this.db
      .select({
        id: divisionsTable.id,
        name: divisionsTable.name,
        requestApprovalEnabled: divisionsTable.requestApprovalEnabled,
      })
      .from(divisionsTable)
      .where(eq(divisionsTable.id, dto.fromDivisionId))

    if (!fromDivision) {
      throw new NotFoundException('Divisi asal tidak ditemukan.')
    }

    const [toDivision] = await this.db
      .select({ id: divisionsTable.id, name: divisionsTable.name })
      .from(divisionsTable)
      .where(eq(divisionsTable.id, dto.toDivisionId))

    if (!toDivision) {
      throw new NotFoundException('Divisi tujuan tidak ditemukan.')
    }

    // Tentukan status awal berdasarkan flag isDraft dan requestApprovalEnabled
    const initialStatus = dto.isDraft
      ? 'DRAFT'
      : fromDivision.requestApprovalEnabled
        ? 'WAITING_ORIGIN_APPROVAL'
        : 'SUBMITTED'

    const id = randomUUID()
    const [request] = await this.db
      .insert(requestsTable)
      .values({
        id,
        fromDivisionId: dto.fromDivisionId,
        toDivisionId: dto.toDivisionId,
        requesterId: user.userId,
        templateId: dto.templateId ?? null,
        title: dto.title,
        brief: dto.brief,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        status: initialStatus,
        sourceTaskId: dto.sourceTaskId ?? null,
        sourceStoryId: dto.sourceStoryId ?? null,
      })
      .returning()

    // Catat event awal
    const initialNote = dto.isDraft
      ? 'Permohonan disimpan sebagai draft oleh pemohon.'
      : fromDivision.requestApprovalEnabled
        ? 'Permohonan diajukan, menunggu persetujuan koordinator divisi asal.'
        : 'Permohonan berhasil diajukan langsung ke divisi tujuan.'

    await this.db.insert(requestEventsTable).values({
      id: randomUUID(),
      requestId: id,
      fromStatus: null,
      toStatus: initialStatus,
      actorId: user.userId,
      note: initialNote,
    })

    await this.activityLogsService.record({
      entityType: 'REQUEST',
      entityId: id,
      action: 'REQUEST_CREATED',
      actorId: user.userId,
      before: null,
      after: {
        title: dto.title,
        fromDivisionId: dto.fromDivisionId,
        toDivisionId: dto.toDivisionId,
        status: initialStatus,
      },
    })

    return request
  }

  async findAllRequests(query: QueryRequestsDto, user: RequestUser) {
    const userDivisionIds = await this.getUserDivisionIds(user.userId)

    const conditions = []

    if (!user.isSuperAdmin && !user.isKormanit) {
      if (userDivisionIds.length === 0) {
        return []
      }

      if (query.direction === 'incoming') {
        conditions.push(inArray(requestsTable.toDivisionId, userDivisionIds))
      } else if (query.direction === 'outgoing') {
        conditions.push(
          or(
            inArray(requestsTable.fromDivisionId, userDivisionIds),
            eq(requestsTable.requesterId, user.userId),
          ),
        )
      } else {
        // all
        conditions.push(
          or(
            inArray(requestsTable.toDivisionId, userDivisionIds),
            inArray(requestsTable.fromDivisionId, userDivisionIds),
            eq(requestsTable.requesterId, user.userId),
          ),
        )
      }
    } else {
      if (query.direction === 'incoming' && query.divisionId) {
        conditions.push(eq(requestsTable.toDivisionId, query.divisionId))
      } else if (query.direction === 'outgoing' && query.divisionId) {
        conditions.push(eq(requestsTable.fromDivisionId, query.divisionId))
      }
    }

    if (query.divisionId) {
      conditions.push(
        or(
          eq(requestsTable.fromDivisionId, query.divisionId),
          eq(requestsTable.toDivisionId, query.divisionId),
        ),
      )
    }

    if (query.status) {
      conditions.push(eq(requestsTable.status, query.status))
    }

    if (query.search) {
      conditions.push(ilike(requestsTable.title, `%${query.search.trim()}%`))
    }

    const rows = await this.db
      .select({
        id: requestsTable.id,
        title: requestsTable.title,
        status: requestsTable.status,
        deadline: requestsTable.deadline,
        fromDivisionId: requestsTable.fromDivisionId,
        toDivisionId: requestsTable.toDivisionId,
        requesterId: requestsTable.requesterId,
        templateId: requestsTable.templateId,
        linkedStoryId: requestsTable.linkedStoryId,
        createdAt: requestsTable.createdAt,
        updatedAt: requestsTable.updatedAt,
        fromDivisionName: sql<string>`from_div.name`,
        toDivisionName: sql<string>`to_div.name`,
        requesterName: sql<string>`req_user.name`,
        requesterAvatar: sql<string>`req_user.avatar_url`,
        templateName: sql<string | null>`tmpl.name`,
      })
      .from(requestsTable)
      .innerJoin(
        sql`${divisionsTable} AS from_div`,
        sql`from_div.id = ${requestsTable.fromDivisionId}`,
      )
      .innerJoin(
        sql`${divisionsTable} AS to_div`,
        sql`to_div.id = ${requestsTable.toDivisionId}`,
      )
      .innerJoin(
        sql`${usersTable} AS req_user`,
        sql`req_user.id = ${requestsTable.requesterId}`,
      )
      .leftJoin(
        sql`${requestTemplatesTable} AS tmpl`,
        sql`tmpl.id = ${requestsTable.templateId}`,
      )
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(requestsTable.createdAt))

    return rows
  }

  async findOneRequest(id: string, user: RequestUser) {
    const [request] = await this.db
      .select({
        id: requestsTable.id,
        title: requestsTable.title,
        brief: requestsTable.brief,
        status: requestsTable.status,
        deadline: requestsTable.deadline,
        reason: requestsTable.reason,
        deliveryNotes: requestsTable.deliveryNotes,
        deliveryAttachments: requestsTable.deliveryAttachments,
        fromDivisionId: requestsTable.fromDivisionId,
        toDivisionId: requestsTable.toDivisionId,
        requesterId: requestsTable.requesterId,
        templateId: requestsTable.templateId,
        linkedStoryId: requestsTable.linkedStoryId,
        sourceTaskId: requestsTable.sourceTaskId,
        sourceStoryId: requestsTable.sourceStoryId,
        createdAt: requestsTable.createdAt,
        updatedAt: requestsTable.updatedAt,
        fromDivisionName: sql<string>`from_div.name`,
        toDivisionName: sql<string>`to_div.name`,
        requesterName: sql<string>`req_user.name`,
        requesterEmail: sql<string>`req_user.email`,
        requesterAvatar: sql<string>`req_user.avatar_url`,
        templateName: sql<string | null>`tmpl.name`,
      })
      .from(requestsTable)
      .innerJoin(
        sql`${divisionsTable} AS from_div`,
        sql`from_div.id = ${requestsTable.fromDivisionId}`,
      )
      .innerJoin(
        sql`${divisionsTable} AS to_div`,
        sql`to_div.id = ${requestsTable.toDivisionId}`,
      )
      .innerJoin(
        sql`${usersTable} AS req_user`,
        sql`req_user.id = ${requestsTable.requesterId}`,
      )
      .leftJoin(
        sql`${requestTemplatesTable} AS tmpl`,
        sql`tmpl.id = ${requestsTable.templateId}`,
      )
      .where(eq(requestsTable.id, id))

    if (!request) {
      throw new NotFoundException('Request tidak ditemukan.')
    }

    // Pastikan user punya akses melihat request ini
    const isSuper = user.isSuperAdmin || user.isKormanit
    const isRequester = request.requesterId === user.userId
    const isFromMember = await this.isDivisionMember(request.fromDivisionId, user.userId)
    const isToMember = await this.isDivisionMember(request.toDivisionId, user.userId)

    if (!isSuper && !isRequester && !isFromMember && !isToMember) {
      throw new ForbiddenException('Anda tidak memiliki akses melihat request ini.')
    }

    // Ambil event timeline
    const events = await this.db
      .select({
        id: requestEventsTable.id,
        fromStatus: requestEventsTable.fromStatus,
        toStatus: requestEventsTable.toStatus,
        note: requestEventsTable.note,
        createdAt: requestEventsTable.createdAt,
        actorId: requestEventsTable.actorId,
        actorName: sql<string>`act_user.name`,
        actorAvatar: sql<string>`act_user.avatar_url`,
      })
      .from(requestEventsTable)
      .innerJoin(
        sql`${usersTable} AS act_user`,
        sql`act_user.id = ${requestEventsTable.actorId}`,
      )
      .where(eq(requestEventsTable.requestId, id))
      .orderBy(requestEventsTable.createdAt)

    // Ambil data linked story jika ada
    let linkedStory: {
      id: string
      title: string
      epicTitle: string | null
      tasksCount: number
      doneTasksCount: number
    } | null = null

    if (request.linkedStoryId) {
      const [storyRow] = await this.db
        .select({
          id: storiesTable.id,
          title: storiesTable.title,
          epicTitle: epicsTable.title,
        })
        .from(storiesTable)
        .leftJoin(epicsTable, eq(storiesTable.epicId, epicsTable.id))
        .where(eq(storiesTable.id, request.linkedStoryId))

      if (storyRow) {
        const tasks = await this.db
          .select({ status: tasksTable.status })
          .from(tasksTable)
          .where(eq(tasksTable.storyId, storyRow.id))

        const doneTasksCount = tasks.filter((t) => t.status === 'DONE').length

        linkedStory = {
          id: storyRow.id,
          title: storyRow.title,
          epicTitle: storyRow.epicTitle,
          tasksCount: tasks.length,
          doneTasksCount,
        }
      }
    }

    // Hak akses aksi
    const isFromCoordinator =
      isSuper || (await this.isDivisionCoordinator(request.fromDivisionId, user.userId))
    const isToCoordinator =
      isSuper || (await this.isDivisionCoordinator(request.toDivisionId, user.userId))

    const permissions = {
      canSubmitDraft:
        (isRequester || isFromCoordinator) && request.status === 'DRAFT',
      canEditDraft:
        (isRequester || isFromCoordinator) && request.status === 'DRAFT',
      canApproveOrigin:
        isFromCoordinator && request.status === 'WAITING_ORIGIN_APPROVAL',
      canTriage: isToCoordinator && request.status === 'SUBMITTED',
      canRespondInfo:
        (isRequester || isFromCoordinator) && request.status === 'NEED_INFO',
      canConvertToStory: isToCoordinator && request.status === 'ACCEPTED',
      canDeliver: isToCoordinator && request.status === 'IN_PROGRESS',
      canConfirmOrRevise:
        (isRequester || isFromCoordinator) && request.status === 'DELIVERED',
    }

    return {
      ...request,
      events,
      linkedStory,
      permissions,
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. TRANSITION ACTIONS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Approval koordinator divisi asal
   */
  async approveOrigin(id: string, dto: OriginApprovalDto, user: RequestUser) {
    const request = await this.getRequestOrThrow(id)

    if (request.status !== 'WAITING_ORIGIN_APPROVAL') {
      throw new BadRequestException(
        `Request tidak dalam status menunggu approval asal (status saat ini: ${request.status}).`,
      )
    }

    await this.assertCoordinator(
      request.fromDivisionId,
      user,
      'memberikan persetujuan divisi asal',
    )

    if (dto.action === 'REJECT' && !dto.reason) {
      throw new BadRequestException('Alasan penolakan internal wajib dicantumkan.')
    }

    const newStatus = dto.action === 'APPROVE' ? 'SUBMITTED' : 'REJECTED'

    const [updated] = await this.db
      .update(requestsTable)
      .set({
        status: newStatus,
        reason: dto.action === 'REJECT' ? dto.reason : null,
        updatedAt: new Date(),
      })
      .where(eq(requestsTable.id, id))
      .returning()

    await this.db.insert(requestEventsTable).values({
      id: randomUUID(),
      requestId: id,
      fromStatus: 'WAITING_ORIGIN_APPROVAL',
      toStatus: newStatus,
      actorId: user.userId,
      note:
        dto.action === 'APPROVE'
          ? 'Disetujui oleh koordinator divisi asal.'
          : `Ditolak internal: ${dto.reason}`,
    })

    await this.activityLogsService.record({
      entityType: 'REQUEST',
      entityId: id,
      action: dto.action === 'APPROVE' ? 'ORIGIN_APPROVED' : 'ORIGIN_REJECTED',
      actorId: user.userId,
      before: { status: 'WAITING_ORIGIN_APPROVAL' },
      after: { status: newStatus, reason: dto.reason },
    })

    return updated
  }

  /**
   * Triage koordinator divisi tujuan (ACCEPT / REJECT / NEED_INFO)
   */
  async triage(id: string, dto: TriageRequestDto, user: RequestUser) {
    const request = await this.getRequestOrThrow(id)

    if (request.status !== 'SUBMITTED') {
      throw new BadRequestException(
        `Request tidak dalam status SUBMITTED (status saat ini: ${request.status}).`,
      )
    }

    await this.assertCoordinator(
      request.toDivisionId,
      user,
      'melakukan triage request divisi tujuan',
    )

    if ((dto.action === 'REJECT' || dto.action === 'NEED_INFO') && !dto.reason) {
      throw new BadRequestException(
        `Alasan wajib dicantumkan untuk aksi ${dto.action}.`,
      )
    }

    let newStatus: 'ACCEPTED' | 'REJECTED' | 'NEED_INFO' = 'ACCEPTED'
    let noteText = 'Permohonan diterima oleh koordinator divisi tujuan.'

    if (dto.action === 'REJECT') {
      newStatus = 'REJECTED'
      noteText = `Permohonan ditolak divisi tujuan: ${dto.reason}`
    } else if (dto.action === 'NEED_INFO') {
      newStatus = 'NEED_INFO'
      noteText = `Meminta informasi tambahan: ${dto.reason}`
    }

    const [updated] = await this.db
      .update(requestsTable)
      .set({
        status: newStatus,
        reason: dto.reason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(requestsTable.id, id))
      .returning()

    await this.db.insert(requestEventsTable).values({
      id: randomUUID(),
      requestId: id,
      fromStatus: 'SUBMITTED',
      toStatus: newStatus,
      actorId: user.userId,
      note: noteText,
    })

    await this.activityLogsService.record({
      entityType: 'REQUEST',
      entityId: id,
      action: `TRIAGE_${dto.action}`,
      actorId: user.userId,
      before: { status: 'SUBMITTED' },
      after: { status: newStatus, reason: dto.reason },
    })

    return updated
  }

  /**
   * Pemohon merespons kebutuhan informasi tambahan
   */
  async respondInfo(id: string, dto: RespondInfoDto, user: RequestUser) {
    const request = await this.getRequestOrThrow(id)

    if (request.status !== 'NEED_INFO') {
      throw new BadRequestException(
        `Request tidak dalam status NEED_INFO (status saat ini: ${request.status}).`,
      )
    }

    const isRequester = request.requesterId === user.userId
    const isSuper = user.isSuperAdmin || user.isKormanit
    const isFromMember = await this.isDivisionMember(request.fromDivisionId, user.userId)

    if (!isSuper && !isRequester && !isFromMember) {
      throw new ForbiddenException(
        'Hanya pemohon atau anggota divisi asal yang dapat melengkapi informasi permohonan.',
      )
    }

    const [updated] = await this.db
      .update(requestsTable)
      .set({
        brief: dto.brief,
        status: 'SUBMITTED',
        reason: null, // Clear reason after respond
        updatedAt: new Date(),
      })
      .where(eq(requestsTable.id, id))
      .returning()

    await this.db.insert(requestEventsTable).values({
      id: randomUUID(),
      requestId: id,
      fromStatus: 'NEED_INFO',
      toStatus: 'SUBMITTED',
      actorId: user.userId,
      note: dto.note ?? 'Informasi tambahan telah dilengkapi oleh pemohon.',
    })

    await this.activityLogsService.record({
      entityType: 'REQUEST',
      entityId: id,
      action: 'REQUEST_INFO_RESPONDED',
      actorId: user.userId,
      before: { status: 'NEED_INFO' },
      after: { status: 'SUBMITTED' },
    })

    return updated
  }

  /**
   * Mengonversi request yang telah diterima (ACCEPTED) menjadi Story di board divisi tujuan
   */
  async convertToStory(id: string, dto: ConvertToStoryDto, user: RequestUser) {
    const request = await this.getRequestOrThrow(id)

    if (request.status !== 'ACCEPTED') {
      throw new BadRequestException(
        `Hanya request dengan status ACCEPTED yang dapat dikonversi menjadi Story (status saat ini: ${request.status}).`,
      )
    }

    await this.assertCoordinator(
      request.toDivisionId,
      user,
      'mengonversi request menjadi Story di divisi tujuan',
    )

    const storyTitle = dto.title?.trim() || request.title
    const storyId = randomUUID()

    const [story] = await this.db
      .insert(storiesTable)
      .values({
        id: storyId,
        divisionId: request.toDivisionId,
        title: storyTitle,
        epicId: dto.epicId ?? null,
        doneCriteria: dto.doneCriteria ?? null,
        targetDate: dto.targetDate
          ? new Date(dto.targetDate)
          : request.deadline,
        prokerTag: dto.prokerTag ?? null,
        sourceRequestId: request.id,
      })
      .returning()

    if (!story) {
      throw new BadRequestException('Gagal membuat story untuk permohonan ini.')
    }

    const [updatedRequest] = await this.db
      .update(requestsTable)
      .set({
        linkedStoryId: story.id,
        status: 'IN_PROGRESS',
        updatedAt: new Date(),
      })
      .where(eq(requestsTable.id, id))
      .returning()

    await this.db.insert(requestEventsTable).values({
      id: randomUUID(),
      requestId: id,
      fromStatus: 'ACCEPTED',
      toStatus: 'IN_PROGRESS',
      actorId: user.userId,
      note: `Dikonversi menjadi Story: ${story.title} pada divisi tujuan.`,
    })

    await this.activityLogsService.record({
      entityType: 'REQUEST',
      entityId: id,
      action: 'CONVERTED_TO_STORY',
      actorId: user.userId,
      before: { status: 'ACCEPTED' },
      after: { status: 'IN_PROGRESS', linkedStoryId: story.id },
    })

    return { request: updatedRequest, story }
  }

  /**
   * Pengiriman hasil kerja oleh divisi tujuan (DELIVERED)
   */
  async deliver(id: string, dto: DeliverRequestDto, user: RequestUser) {
    const request = await this.getRequestOrThrow(id)

    if (request.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        `Request tidak dalam pengerjaan (status saat ini: ${request.status}).`,
      )
    }

    await this.assertCoordinator(
      request.toDivisionId,
      user,
      'mengirimkan hasil kerja request',
    )

    // Periksa status seluruh task pada Story terkait jika ada
    if (request.linkedStoryId) {
      const tasks = await this.db
        .select({ id: tasksTable.id, status: tasksTable.status, title: tasksTable.title })
        .from(tasksTable)
        .where(eq(tasksTable.storyId, request.linkedStoryId))

      const unfinishedTasks = tasks.filter((t) => t.status !== 'DONE')
      if (unfinishedTasks.length > 0) {
        throw new BadRequestException(
          `Semua task pada Story harus berstatus DONE sebelum hasil dapat dikirimkan (${unfinishedTasks.length} task belum selesai).`,
        )
      }
    }

    const [updated] = await this.db
      .update(requestsTable)
      .set({
        status: 'DELIVERED',
        deliveryNotes: dto.deliveryNotes,
        deliveryAttachments: dto.deliveryAttachments,
        updatedAt: new Date(),
      })
      .where(eq(requestsTable.id, id))
      .returning()

    await this.db.insert(requestEventsTable).values({
      id: randomUUID(),
      requestId: id,
      fromStatus: 'IN_PROGRESS',
      toStatus: 'DELIVERED',
      actorId: user.userId,
      note: `Hasil kerja telah dikirimkan: ${dto.deliveryNotes}`,
    })

    await this.activityLogsService.record({
      entityType: 'REQUEST',
      entityId: id,
      action: 'REQUEST_DELIVERED',
      actorId: user.userId,
      before: { status: 'IN_PROGRESS' },
      after: { status: 'DELIVERED', deliveryNotes: dto.deliveryNotes },
    })

    return updated
  }

  /**
   * Pemohon mengonfirmasi hasil atau mengajukan revisi
   */
  async confirm(id: string, dto: ConfirmRequestDto, user: RequestUser) {
    const request = await this.getRequestOrThrow(id)

    if (request.status !== 'DELIVERED') {
      throw new BadRequestException(
        `Hasil kerja belum dikirimkan (status saat ini: ${request.status}).`,
      )
    }

    const isRequester = request.requesterId === user.userId
    const isSuper = user.isSuperAdmin || user.isKormanit
    const isFromCoordinator = await this.isDivisionCoordinator(
      request.fromDivisionId,
      user.userId,
    )

    if (!isSuper && !isRequester && !isFromCoordinator) {
      throw new ForbiddenException(
        'Hanya pemohon atau koordinator divisi asal yang dapat mengonfirmasi atau meminta revisi hasil kerja.',
      )
    }

    if (dto.action === 'REVISION' && !dto.reason) {
      throw new BadRequestException('Alasan atau catatan revisi wajib dicantumkan.')
    }

    const newStatus = dto.action === 'CONFIRM' ? 'CONFIRMED' : 'REVISION'

    const [updated] = await this.db
      .update(requestsTable)
      .set({
        status: newStatus,
        reason: dto.action === 'REVISION' ? dto.reason : null,
        updatedAt: new Date(),
      })
      .where(eq(requestsTable.id, id))
      .returning()

    // Jika CONFIRM, tutup Story terkait jika ada
    if (dto.action === 'CONFIRM' && request.linkedStoryId) {
      await this.db
        .update(storiesTable)
        .set({ closedAt: new Date() })
        .where(eq(storiesTable.id, request.linkedStoryId))
    }

    // Jika REVISION dan ada Story terkait, naikkan revision_count pada task terkait
    if (dto.action === 'REVISION' && request.linkedStoryId) {
      await this.db
        .update(tasksTable)
        .set({
          status: 'IN_PROGRESS',
          revisionCount: sql`${tasksTable.revisionCount} + 1`,
        })
        .where(eq(tasksTable.storyId, request.linkedStoryId))
    }

    await this.db.insert(requestEventsTable).values({
      id: randomUUID(),
      requestId: id,
      fromStatus: 'DELIVERED',
      toStatus: newStatus,
      actorId: user.userId,
      note:
        dto.action === 'CONFIRM'
          ? 'Hasil permohonan telah dikonfirmasi dan disetujui pemohon.'
          : `Permintaan revisi diajukan: ${dto.reason}`,
    })

    await this.activityLogsService.record({
      entityType: 'REQUEST',
      entityId: id,
      action: dto.action === 'CONFIRM' ? 'REQUEST_CONFIRMED' : 'REQUEST_REVISION',
      actorId: user.userId,
      before: { status: 'DELIVERED' },
      after: { status: newStatus, reason: dto.reason },
    })

    return updated
  }

  /**
   * Update draft permohonan (judul, brief, deadline, template)
   */
  async updateRequest(id: string, dto: UpdateRequestDto, user: RequestUser) {
    const request = await this.getRequestOrThrow(id)

    if (request.status !== 'DRAFT') {
      throw new BadRequestException(
        `Hanya permohonan berstatus DRAFT yang dapat diedit (status saat ini: ${request.status}).`,
      )
    }

    const isRequester = request.requesterId === user.userId
    let isFromCoordinator = user.isSuperAdmin || user.isKormanit
    if (!isRequester && !isFromCoordinator) {
      isFromCoordinator = await this.isDivisionCoordinator(request.fromDivisionId, user.userId)
      if (!isFromCoordinator) {
        throw new ForbiddenException(
          'Hanya pemohon atau koordinator divisi asal yang dapat mengedit draft ini.',
        )
      }
    }

    const [updated] = await this.db
      .update(requestsTable)
      .set({
        title: dto.title ?? request.title,
        brief: dto.brief ? dto.brief : request.brief,
        deadline:
          dto.deadline !== undefined
            ? dto.deadline
              ? new Date(dto.deadline)
              : null
            : request.deadline,
        templateId:
          dto.templateId !== undefined
            ? dto.templateId || null
            : request.templateId,
        updatedAt: new Date(),
      })
      .where(eq(requestsTable.id, id))
      .returning()

    await this.activityLogsService.record({
      entityType: 'REQUEST',
      entityId: id,
      action: 'REQUEST_UPDATED',
      actorId: user.userId,
      before: { title: request.title, brief: request.brief },
      after: { title: updated.title, brief: updated.brief },
    })

    return updated
  }

  /**
   * Submit draft permohonan resmi ke alur approval atau triage
   */
  async submitDraft(id: string, user: RequestUser) {
    const request = await this.getRequestOrThrow(id)

    if (request.status !== 'DRAFT') {
      throw new BadRequestException(
        `Hanya permohonan berstatus DRAFT yang dapat diajukan (status saat ini: ${request.status}).`,
      )
    }

    const isRequester = request.requesterId === user.userId
    let isFromCoordinator = user.isSuperAdmin || user.isKormanit
    if (!isRequester && !isFromCoordinator) {
      isFromCoordinator = await this.isDivisionCoordinator(request.fromDivisionId, user.userId)
      if (!isFromCoordinator) {
        throw new ForbiddenException(
          'Hanya pemohon atau koordinator divisi asal yang dapat mengajukan draft ini.',
        )
      }
    }

    const [fromDivision] = await this.db
      .select({
        requestApprovalEnabled: divisionsTable.requestApprovalEnabled,
      })
      .from(divisionsTable)
      .where(eq(divisionsTable.id, request.fromDivisionId))

    const newStatus = fromDivision?.requestApprovalEnabled
      ? 'WAITING_ORIGIN_APPROVAL'
      : 'SUBMITTED'

    const [updated] = await this.db
      .update(requestsTable)
      .set({
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(requestsTable.id, id))
      .returning()

    const note = fromDivision?.requestApprovalEnabled
      ? 'Draft permohonan resmi diajukan, menunggu persetujuan koordinator divisi asal.'
      : 'Draft permohonan resmi diajukan langsung ke divisi tujuan.'

    await this.db.insert(requestEventsTable).values({
      id: randomUUID(),
      requestId: id,
      fromStatus: 'DRAFT',
      toStatus: newStatus,
      actorId: user.userId,
      note,
    })

    await this.activityLogsService.record({
      entityType: 'REQUEST',
      entityId: id,
      action: 'REQUEST_SUBMITTED',
      actorId: user.userId,
      before: { status: 'DRAFT' },
      after: { status: newStatus },
    })

    return updated
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. HELPER PERMISSIONS & LOOKUPS
  // ─────────────────────────────────────────────────────────────────────────────

  private async getRequestOrThrow(id: string) {
    const [request] = await this.db
      .select()
      .from(requestsTable)
      .where(eq(requestsTable.id, id))

    if (!request) {
      throw new NotFoundException('Request tidak ditemukan.')
    }

    return request
  }

  private async getUserDivisionIds(userId: string): Promise<string[]> {
    const memberships = await this.db
      .select({ divisionId: divisionMembersTable.divisionId })
      .from(divisionMembersTable)
      .where(eq(divisionMembersTable.userId, userId))

    return memberships.map((m) => m.divisionId)
  }

  private async isDivisionMember(divisionId: string, userId: string): Promise<boolean> {
    const [membership] = await this.db
      .select({ id: divisionMembersTable.id })
      .from(divisionMembersTable)
      .where(
        and(
          eq(divisionMembersTable.divisionId, divisionId),
          eq(divisionMembersTable.userId, userId),
        ),
      )

    return Boolean(membership)
  }

  private async isDivisionCoordinator(
    divisionId: string,
    userId: string,
  ): Promise<boolean> {
    const [membership] = await this.db
      .select({ id: divisionMembersTable.id })
      .from(divisionMembersTable)
      .where(
        and(
          eq(divisionMembersTable.divisionId, divisionId),
          eq(divisionMembersTable.userId, userId),
          eq(divisionMembersTable.role, 'COORDINATOR'),
        ),
      )

    return Boolean(membership)
  }

  private async assertCoordinator(
    divisionId: string,
    user: RequestUser,
    actionDesc: string,
  ) {
    if (user.isSuperAdmin || user.isKormanit) {
      return
    }

    const isCoord = await this.isDivisionCoordinator(divisionId, user.userId)
    if (!isCoord) {
      throw new ForbiddenException(
        `Hanya Koordinator divisi atau administrator yang berhak untuk ${actionDesc}.`,
      )
    }
  }

  private async assertMember(
    divisionId: string,
    user: RequestUser,
    actionDesc: string,
  ) {
    if (user.isSuperAdmin || user.isKormanit) {
      return
    }

    const isMem = await this.isDivisionMember(divisionId, user.userId)
    if (!isMem) {
      throw new ForbiddenException(
        `Anda harus menjadi anggota divisi ini untuk ${actionDesc}.`,
      )
    }
  }
}
