import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { and, desc, eq, ilike, inArray, or, type SQL } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import {
  announcementsTable,
  divisionMembersTable,
  divisionsTable,
  subunitMembersTable,
  subunitsTable,
  usersTable,
} from '@moaspace/database'
import { DATABASE_CONNECTION, type Database } from '../database/database.provider.js'
import { ActivityLogsService } from '../activity-logs/activity-logs.service.js'
import { CalendarService } from '../calendar/calendar.service.js'
import { MailService } from '../mail/mail.service.js'
import type { RequestUser } from '../common/decorators/current-user.decorator.js'
import type { CreateAnnouncementDto } from './dto/create-announcement.dto.js'
import type { UpdateAnnouncementDto } from './dto/update-announcement.dto.js'
import type { QueryAnnouncementsDto } from './dto/query-announcements.dto.js'

@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name)

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly activityLogsService: ActivityLogsService,
    private readonly calendarService: CalendarService,
    private readonly mailService: MailService,
  ) {}

  // ─── 1. Cek Hak Akses Pembuatan (PSDM / Koordinator Divisi / Kormasit / Kormater / Kormanit / Admin) ─
  async getAnnouncementPermissions(user: RequestUser): Promise<{
    canCreate: boolean
    isGlobalManager: boolean
    coordinatedDivisionIds: string[]
    coordinatedSubunitIds: string[]
    isClusterCoordinator: boolean
    coordinatedCluster: string | null
  }> {
    if (user.isSuperAdmin || user.isKormanit) {
      return {
        canCreate: true,
        isGlobalManager: true,
        coordinatedDivisionIds: [],
        coordinatedSubunitIds: [],
        isClusterCoordinator: false,
        coordinatedCluster: null,
      }
    }

    // Ambil info profil user (cluster & status Kormater)
    const [userRow] = await this.db
      .select({
        cluster: usersTable.cluster,
        isClusterCoordinator: usersTable.isClusterCoordinator,
      })
      .from(usersTable)
      .where(eq(usersTable.id, user.userId))
      .limit(1)

    const isClusterCoordinator = Boolean(userRow?.isClusterCoordinator && userRow?.cluster)
    const coordinatedCluster = isClusterCoordinator ? userRow!.cluster : null

    const memberships = await this.db
      .select({
        divisionId: divisionMembersTable.divisionId,
        role: divisionMembersTable.role,
        slug: divisionsTable.slug,
      })
      .from(divisionMembersTable)
      .innerJoin(divisionsTable, eq(divisionMembersTable.divisionId, divisionsTable.id))
      .where(eq(divisionMembersTable.userId, user.userId))

    const isPsdm = memberships.some((m) => m.slug.toLowerCase() === 'psdm')
    if (isPsdm) {
      return {
        canCreate: true,
        isGlobalManager: true,
        coordinatedDivisionIds: memberships.map((m) => m.divisionId),
        coordinatedSubunitIds: [],
        isClusterCoordinator,
        coordinatedCluster,
      }
    }

    const coordinatedDivisionIds = memberships
      .filter((m) => m.role === 'COORDINATOR')
      .map((m) => m.divisionId)

    // Cek subunit yang dikoordinasikan (Kormasit)
    const coordinatedSubunits = await this.db
      .select({ subunitId: subunitMembersTable.subunitId })
      .from(subunitMembersTable)
      .where(
        and(
          eq(subunitMembersTable.userId, user.userId),
          eq(subunitMembersTable.role, 'COORDINATOR'),
        ),
      )

    const coordinatedSubunitIds = coordinatedSubunits.map((s) => s.subunitId)

    const canCreate =
      coordinatedDivisionIds.length > 0 ||
      coordinatedSubunitIds.length > 0 ||
      isClusterCoordinator

    return {
      canCreate,
      isGlobalManager: false,
      coordinatedDivisionIds,
      coordinatedSubunitIds,
      isClusterCoordinator,
      coordinatedCluster,
    }
  }

  async canManageAnnouncements(user: RequestUser): Promise<boolean> {
    const permissions = await this.getAnnouncementPermissions(user)
    return permissions.canCreate
  }

  // ─── 2. Buat Pengumuman ────────────────────────────────────────────────────
  async create(dto: CreateAnnouncementDto, user: RequestUser) {
    const permissions = await this.getAnnouncementPermissions(user)
    if (!permissions.canCreate) {
      throw new ForbiddenException(
        'Hanya divisi PSDM, Koordinator Divisi, Koordinator Subunit, Koordinator Klaster, Kormanit, atau Super Admin yang dapat membuat pengumuman.',
      )
    }

    const targetType = dto.targetType || 'ALL'

    // Jika bukan global manager (Super Admin, Kormanit, atau PSDM), periksa batas kewenangan
    if (!permissions.isGlobalManager) {
      if (targetType === 'ALL') {
        throw new ForbiddenException(
          'Hanya Kormanit, PSDM, atau Super Admin yang dapat membuat pengumuman untuk seluruh tim KKN.',
        )
      }

      if (targetType === 'DIVISION') {
        if (!dto.targetDivisionId || !permissions.coordinatedDivisionIds.includes(dto.targetDivisionId)) {
          throw new ForbiddenException(
            'Anda hanya dapat membuat pengumuman untuk divisi yang Anda koordinasikan.',
          )
        }
      } else if (targetType === 'SUBUNIT') {
        if (!dto.targetSubunitId || !permissions.coordinatedSubunitIds.includes(dto.targetSubunitId)) {
          throw new ForbiddenException(
            'Anda hanya dapat membuat pengumuman untuk posko / subunit yang Anda koordinasikan.',
          )
        }
      } else if (targetType === 'CLUSTER') {
        if (
          !permissions.isClusterCoordinator ||
          !permissions.coordinatedCluster ||
          dto.targetCluster !== permissions.coordinatedCluster
        ) {
          throw new ForbiddenException(
            'Anda hanya dapat membuat pengumuman untuk klaster keilmuan yang Anda koordinasikan.',
          )
        }
      }
    }

    if (targetType === 'DIVISION' && !dto.targetDivisionId) {
      throw new BadRequestException('Target divisi wajib dipilih jika target type DIVISION.')
    }

    if (targetType === 'SUBUNIT' && !dto.targetSubunitId) {
      throw new BadRequestException('Target posko/subunit wajib dipilih jika target type SUBUNIT.')
    }

    if (targetType === 'CLUSTER' && !dto.targetCluster) {
      throw new BadRequestException('Target klaster wajib dipilih jika target type CLUSTER.')
    }

    const announcementId = randomUUID()
    const startDate = dto.eventStartDate ? new Date(dto.eventStartDate) : null
    const endDate = dto.eventEndDate ? new Date(dto.eventEndDate) : null

    if (startDate && endDate && endDate < startDate) {
      throw new BadRequestException('Waktu selesai agenda tidak boleh lebih awal dari waktu mulai.')
    }

    const [created] = await this.db
      .insert(announcementsTable)
      .values({
        id: announcementId,
        title: dto.title.trim(),
        content: dto.content,
        category: dto.category || 'INFO',
        targetType,
        targetDivisionId: targetType === 'DIVISION' ? dto.targetDivisionId || null : null,
        targetSubunitId: targetType === 'SUBUNIT' ? dto.targetSubunitId || null : null,
        targetCluster: targetType === 'CLUSTER' ? dto.targetCluster || null : null,
        isPinned: dto.isPinned ?? false,
        eventStartDate: startDate,
        eventEndDate: endDate,
        location: dto.location || null,
        authorId: user.userId,
      })
      .returning()

    if (!created) {
      throw new BadRequestException('Gagal membuat pengumuman.')
    }

    await this.activityLogsService.record({
      entityType: 'ANNOUNCEMENT',
      entityId: announcementId,
      action: 'ANNOUNCEMENT_CREATED',
      actorId: user.userId,
      before: null,
      after: {
        id: announcementId,
        title: created.title,
        category: created.category,
        targetType: created.targetType,
      },
    })

    // Sinkronisasi ke Google Calendar jika memiliki jadwal kegiatan
    this.calendarService.syncAnnouncementEvent(announcementId).catch((err) => {
      this.logger.error(`Failed to sync calendar for announcement ${announcementId}: ${err.message}`)
    })

    // Kirim notifikasi email ke target audiens jika sendEmail true (default true)
    const shouldSendEmail = dto.sendEmail ?? true
    if (shouldSendEmail) {
      this.sendAnnouncementNotification(created, user, false).catch((err) => {
        this.logger.error(`Failed to send email for announcement ${announcementId}: ${err.message}`)
      })
    }

    return this.findOne(announcementId, user)
  }

  // ─── 3. Ambil Daftar Pengumuman ────────────────────────────────────────────
  async findAll(query: QueryAnnouncementsDto, user: RequestUser) {
    const isPrivileged = Boolean(user.isSuperAdmin || user.isKormanit)

    const userDivisions = await this.db
      .select({ divisionId: divisionMembersTable.divisionId })
      .from(divisionMembersTable)
      .where(eq(divisionMembersTable.userId, user.userId))

    const userDivisionIds = userDivisions.map((d) => d.divisionId)

    const userSubunits = await this.db
      .select({ subunitId: subunitMembersTable.subunitId })
      .from(subunitMembersTable)
      .where(eq(subunitMembersTable.userId, user.userId))

    const userSubunitIds = userSubunits.map((s) => s.subunitId)

    const [userProfile] = await this.db
      .select({ cluster: usersTable.cluster })
      .from(usersTable)
      .where(eq(usersTable.id, user.userId))
      .limit(1)

    const userCluster = userProfile?.cluster

    const conditions: (SQL | undefined)[] = []

    // Access control: anggota biasa hanya melihat 'ALL', divisinya, subunitnya, atau klasternya
    if (!isPrivileged) {
      const audienceConditions: SQL[] = [eq(announcementsTable.targetType, 'ALL')]
      if (userDivisionIds.length > 0) {
        audienceConditions.push(
          and(
            eq(announcementsTable.targetType, 'DIVISION'),
            inArray(announcementsTable.targetDivisionId, userDivisionIds)!,
          )!,
        )
      }
      if (userSubunitIds.length > 0) {
        audienceConditions.push(
          and(
            eq(announcementsTable.targetType, 'SUBUNIT'),
            inArray(announcementsTable.targetSubunitId, userSubunitIds)!,
          )!,
        )
      }
      if (userCluster) {
        audienceConditions.push(
          and(
            eq(announcementsTable.targetType, 'CLUSTER'),
            eq(announcementsTable.targetCluster, userCluster)!,
          )!,
        )
      }
      conditions.push(or(...audienceConditions))
    }

    if (query.category) {
      conditions.push(eq(announcementsTable.category, query.category))
    }

    if (query.targetType) {
      conditions.push(eq(announcementsTable.targetType, query.targetType))
    }

    if (query.divisionId) {
      conditions.push(eq(announcementsTable.targetDivisionId, query.divisionId))
    }

    if (query.subunitId) {
      conditions.push(eq(announcementsTable.targetSubunitId, query.subunitId))
    }

    if (query.cluster) {
      conditions.push(eq(announcementsTable.targetCluster, query.cluster as any))
    }

    if (query.search?.trim()) {
      conditions.push(ilike(announcementsTable.title, `%${query.search.trim()}%`))
    }

    const rows = await this.db
      .select({
        announcement: announcementsTable,
        author: {
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
        },
        targetDivision: {
          id: divisionsTable.id,
          name: divisionsTable.name,
          slug: divisionsTable.slug,
        },
        targetSubunit: {
          id: subunitsTable.id,
          name: subunitsTable.name,
          slug: subunitsTable.slug,
        },
      })
      .from(announcementsTable)
      .innerJoin(usersTable, eq(announcementsTable.authorId, usersTable.id))
      .leftJoin(divisionsTable, eq(announcementsTable.targetDivisionId, divisionsTable.id))
      .leftJoin(subunitsTable, eq(announcementsTable.targetSubunitId, subunitsTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(announcementsTable.isPinned), desc(announcementsTable.createdAt))

    return rows.map((r) => ({
      ...r.announcement,
      author: r.author,
      targetDivision: r.targetDivision?.id ? r.targetDivision : null,
      targetSubunit: r.targetSubunit?.id ? r.targetSubunit : null,
    }))
  }

  // ─── 4. Ambil Detail Pengumuman ───────────────────────────────────────────
  async findOne(id: string, user: RequestUser) {
    const [row] = await this.db
      .select({
        announcement: announcementsTable,
        author: {
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
        },
        targetDivision: {
          id: divisionsTable.id,
          name: divisionsTable.name,
          slug: divisionsTable.slug,
        },
        targetSubunit: {
          id: subunitsTable.id,
          name: subunitsTable.name,
          slug: subunitsTable.slug,
        },
      })
      .from(announcementsTable)
      .innerJoin(usersTable, eq(announcementsTable.authorId, usersTable.id))
      .leftJoin(divisionsTable, eq(announcementsTable.targetDivisionId, divisionsTable.id))
      .leftJoin(subunitsTable, eq(announcementsTable.targetSubunitId, subunitsTable.id))
      .where(eq(announcementsTable.id, id))
      .limit(1)

    if (!row) {
      throw new NotFoundException('Pengumuman tidak ditemukan.')
    }

    const isPrivileged = Boolean(user.isSuperAdmin || user.isKormanit)
    if (!isPrivileged) {
      if (row.announcement.targetType === 'DIVISION') {
        const isMember = await this.isMemberOfDivision(user.userId, row.announcement.targetDivisionId)
        if (!isMember) {
          throw new ForbiddenException('Anda tidak memiliki wewenang melihat pengumuman divisi ini.')
        }
      } else if (row.announcement.targetType === 'SUBUNIT') {
        const isMember = await this.isMemberOfSubunit(user.userId, row.announcement.targetSubunitId)
        if (!isMember) {
          throw new ForbiddenException('Anda tidak memiliki wewenang melihat pengumuman posko/subunit ini.')
        }
      } else if (row.announcement.targetType === 'CLUSTER') {
        const [u] = await this.db
          .select({ cluster: usersTable.cluster })
          .from(usersTable)
          .where(eq(usersTable.id, user.userId))
          .limit(1)
        if (!u?.cluster || u.cluster !== row.announcement.targetCluster) {
          throw new ForbiddenException('Anda tidak memiliki wewenang melihat pengumuman klaster ini.')
        }
      }
    }

    return {
      ...row.announcement,
      author: row.author,
      targetDivision: row.targetDivision?.id ? row.targetDivision : null,
      targetSubunit: row.targetSubunit?.id ? row.targetSubunit : null,
    }
  }

  // ─── 5. Perbarui Pengumuman ────────────────────────────────────────────────
  async update(id: string, dto: UpdateAnnouncementDto, user: RequestUser) {
    const [existing] = await this.db
      .select()
      .from(announcementsTable)
      .where(eq(announcementsTable.id, id))
      .limit(1)

    if (!existing) {
      throw new NotFoundException('Pengumuman tidak ditemukan.')
    }

    const isAuthor = existing.authorId === user.userId
    const isPrivileged = Boolean(user.isSuperAdmin || user.isKormanit)

    if (!isAuthor && !isPrivileged) {
      throw new ForbiddenException(
        'Hanya pembuat pengumuman, Kormanit, atau Super Admin yang dapat mengubah pengumuman ini.',
      )
    }

    const permissions = await this.getAnnouncementPermissions(user)
    const newTargetType = dto.targetType !== undefined ? dto.targetType : existing.targetType

    if (!permissions.isGlobalManager) {
      if (newTargetType === 'ALL') {
        throw new ForbiddenException(
          'Hanya Kormanit, PSDM, atau Super Admin yang dapat mengarahkan pengumuman ke seluruh tim KKN.',
        )
      }
      if (newTargetType === 'DIVISION') {
        const divisionId = dto.targetDivisionId || existing.targetDivisionId
        if (!divisionId || !permissions.coordinatedDivisionIds.includes(divisionId)) {
          throw new ForbiddenException(
            'Anda hanya dapat mengarahkan pengumuman ke divisi yang Anda koordinasikan.',
          )
        }
      } else if (newTargetType === 'SUBUNIT') {
        const subunitId = dto.targetSubunitId || existing.targetSubunitId
        if (!subunitId || !permissions.coordinatedSubunitIds.includes(subunitId)) {
          throw new ForbiddenException(
            'Anda hanya dapat mengarahkan pengumuman ke posko/subunit yang Anda koordinasikan.',
          )
        }
      } else if (newTargetType === 'CLUSTER') {
        const cluster = dto.targetCluster || existing.targetCluster
        if (
          !permissions.isClusterCoordinator ||
          !permissions.coordinatedCluster ||
          cluster !== permissions.coordinatedCluster
        ) {
          throw new ForbiddenException(
            'Anda hanya dapat mengarahkan pengumuman ke klaster yang Anda koordinasikan.',
          )
        }
      }
    }

    const updates: Record<string, any> = {
      updatedAt: new Date(),
    }

    if (dto.title !== undefined) updates.title = dto.title.trim()
    if (dto.content !== undefined) updates.content = dto.content
    if (dto.category !== undefined) updates.category = dto.category
    if (dto.isPinned !== undefined) updates.isPinned = dto.isPinned
    if (dto.location !== undefined) updates.location = dto.location || null

    if (dto.targetType !== undefined) {
      updates.targetType = dto.targetType
      updates.targetDivisionId =
        dto.targetType === 'DIVISION' ? dto.targetDivisionId || existing.targetDivisionId : null
      updates.targetSubunitId =
        dto.targetType === 'SUBUNIT' ? dto.targetSubunitId || existing.targetSubunitId : null
      updates.targetCluster =
        dto.targetType === 'CLUSTER' ? dto.targetCluster || existing.targetCluster : null
    } else {
      if (dto.targetDivisionId !== undefined) updates.targetDivisionId = dto.targetDivisionId || null
      if (dto.targetSubunitId !== undefined) updates.targetSubunitId = dto.targetSubunitId || null
      if (dto.targetCluster !== undefined) updates.targetCluster = dto.targetCluster || null
    }

    if (dto.eventStartDate !== undefined) {
      updates.eventStartDate = dto.eventStartDate ? new Date(dto.eventStartDate) : null
    }
    if (dto.eventEndDate !== undefined) {
      updates.eventEndDate = dto.eventEndDate ? new Date(dto.eventEndDate) : null
    }

    const finalStart = updates.eventStartDate !== undefined ? updates.eventStartDate : existing.eventStartDate
    const finalEnd = updates.eventEndDate !== undefined ? updates.eventEndDate : existing.eventEndDate

    if (finalStart && finalEnd && finalEnd < finalStart) {
      throw new BadRequestException('Waktu selesai agenda tidak boleh lebih awal dari waktu mulai.')
    }

    await this.db
      .update(announcementsTable)
      .set(updates)
      .where(eq(announcementsTable.id, id))

    await this.activityLogsService.record({
      entityType: 'ANNOUNCEMENT',
      entityId: id,
      action: 'ANNOUNCEMENT_UPDATED',
      actorId: user.userId,
      before: { title: existing.title, isPinned: existing.isPinned },
      after: { title: updates.title ?? existing.title, isPinned: updates.isPinned ?? existing.isPinned },
    })

    // Sinkronisasi ke Google Calendar
    this.calendarService.syncAnnouncementEvent(id).catch((err) => {
      this.logger.error(`Failed to sync calendar for updated announcement ${id}: ${err.message}`)
    })

    // Kirim notifikasi email pembaruan jika sendEmail true (default false pada update)
    if (dto.sendEmail) {
      this.sendAnnouncementNotification(
        { ...existing, ...updates, id } as any,
        user,
        true,
      ).catch((err) => {
        this.logger.error(`Failed to send update email for announcement ${id}: ${err.message}`)
      })
    }

    return this.findOne(id, user)
  }

  // ─── 6. Hapus Pengumuman ───────────────────────────────────────────────────
  async delete(id: string, user: RequestUser) {
    const [existing] = await this.db
      .select()
      .from(announcementsTable)
      .where(eq(announcementsTable.id, id))
      .limit(1)

    if (!existing) {
      throw new NotFoundException('Pengumuman tidak ditemukan.')
    }

    const isAuthor = existing.authorId === user.userId
    const isPrivileged = Boolean(user.isSuperAdmin || user.isKormanit)

    if (!isAuthor && !isPrivileged) {
      throw new ForbiddenException(
        'Hanya pembuat pengumuman, Kormanit, atau Super Admin yang dapat menghapus pengumuman ini.',
      )
    }

    // Bersihkan dari Google Calendar
    await this.calendarService.syncAnnouncementEvent(id, true).catch(() => {})

    await this.db.delete(announcementsTable).where(eq(announcementsTable.id, id))

    await this.activityLogsService.record({
      entityType: 'ANNOUNCEMENT',
      entityId: id,
      action: 'ANNOUNCEMENT_DELETED',
      actorId: user.userId,
      before: { title: existing.title },
      after: null,
    })

    return { success: true, message: 'Pengumuman berhasil dihapus.' }
  }

  // ─── Helper: Cek Keanggotaan Divisi & Subunit ──────────────────────────────
  private async isMemberOfDivision(userId: string, divisionId: string | null): Promise<boolean> {
    if (!divisionId) return false
    const [membership] = await this.db
      .select()
      .from(divisionMembersTable)
      .where(
        and(
          eq(divisionMembersTable.userId, userId),
          eq(divisionMembersTable.divisionId, divisionId),
        ),
      )
      .limit(1)
    return Boolean(membership)
  }

  private async isMemberOfSubunit(userId: string, subunitId: string | null): Promise<boolean> {
    if (!subunitId) return false
    const [membership] = await this.db
      .select()
      .from(subunitMembersTable)
      .where(
        and(
          eq(subunitMembersTable.userId, userId),
          eq(subunitMembersTable.subunitId, subunitId),
        ),
      )
      .limit(1)
    return Boolean(membership)
  }

  private extractContentDetails(content: Record<string, unknown>): {
    bodyHtml?: string
    summaryText: string
  } {
    if (!content || typeof content !== 'object') {
      return { summaryText: '' }
    }

    try {
      // 1. Format dari editor rich-text TipTap pada frontend: { html: "<p>...</p>" }
      const contentAny = content as any
      if (typeof contentAny.html === 'string' && contentAny.html.trim().length > 0) {
        const rawHtml = contentAny.html as string

        // Format email-friendly HTML dengan inline-style dasar
        const styledHtml = rawHtml
          .replace(/<p\b([^>]*)>/gi, '<p style="margin: 0 0 12px 0; line-height: 1.6; color: #334155;"$1>')
          .replace(/<ul\b([^>]*)>/gi, '<ul style="margin: 0 0 12px 0; padding-left: 20px; color: #334155; line-height: 1.6;"$1>')
          .replace(/<ol\b([^>]*)>/gi, '<ol style="margin: 0 0 12px 0; padding-left: 20px; color: #334155; line-height: 1.6;"$1>')
          .replace(/<li\b([^>]*)>/gi, '<li style="margin-bottom: 4px;"$1>')
          .replace(/<blockquote\b([^>]*)>/gi, '<blockquote style="margin: 12px 0; padding: 8px 16px; border-left: 3px solid #6366f1; background: #ffffff; color: #475569;"$1>')
          .replace(/<img\b([^>]*)>/gi, '<img style="max-width: 100%; height: auto; border-radius: 6px; margin: 12px 0; display: block;"$1>')

        const plainText = rawHtml
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<li>/gi, '• ')
          .replace(/<\/li>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/\n{3,}/g, '\n\n')
          .trim()

        return {
          bodyHtml: styledHtml,
          summaryText: plainText,
        }
      }

      // 2. Fallback format node-tree ProseMirror/TipTap: { type: 'doc', content: [...] }
      const texts: string[] = []
      const traverse = (node: any) => {
        if (!node) return
        if (node.text) texts.push(node.text)
        if (Array.isArray(node.content)) {
          for (const child of node.content) traverse(child)
        }
      }
      traverse(content)
      const plainText = texts.join(' ').trim()

      return {
        summaryText: plainText,
      }
    } catch {
      return { summaryText: '' }
    }
  }

  private async sendAnnouncementNotification(
    announcement: typeof announcementsTable.$inferSelect,
    authorUser: RequestUser,
    isUpdate = false,
  ): Promise<void> {
    try {
      let recipients: { id: string; name: string; email: string }[] = []
      let divisionName: string | undefined
      let subunitName: string | undefined
      let clusterName: string | undefined

      if (announcement.targetType === 'ALL') {
        recipients = await this.db
          .select({
            id: usersTable.id,
            name: usersTable.name,
            email: usersTable.email,
          })
          .from(usersTable)
          .where(eq(usersTable.status, 'ACTIVE'))
      } else if (announcement.targetType === 'DIVISION' && announcement.targetDivisionId) {
        recipients = await this.db
          .select({
            id: usersTable.id,
            name: usersTable.name,
            email: usersTable.email,
          })
          .from(divisionMembersTable)
          .innerJoin(usersTable, eq(divisionMembersTable.userId, usersTable.id))
          .where(
            and(
              eq(divisionMembersTable.divisionId, announcement.targetDivisionId),
              eq(usersTable.status, 'ACTIVE'),
            ),
          )

        const [div] = await this.db
          .select({ name: divisionsTable.name })
          .from(divisionsTable)
          .where(eq(divisionsTable.id, announcement.targetDivisionId))
        divisionName = div?.name
      } else if (announcement.targetType === 'SUBUNIT' && announcement.targetSubunitId) {
        recipients = await this.db
          .select({
            id: usersTable.id,
            name: usersTable.name,
            email: usersTable.email,
          })
          .from(subunitMembersTable)
          .innerJoin(usersTable, eq(subunitMembersTable.userId, usersTable.id))
          .where(
            and(
              eq(subunitMembersTable.subunitId, announcement.targetSubunitId),
              eq(usersTable.status, 'ACTIVE'),
            ),
          )

        const [sub] = await this.db
          .select({ name: subunitsTable.name })
          .from(subunitsTable)
          .where(eq(subunitsTable.id, announcement.targetSubunitId))
        subunitName = sub?.name
      } else if (announcement.targetType === 'CLUSTER' && announcement.targetCluster) {
        recipients = await this.db
          .select({
            id: usersTable.id,
            name: usersTable.name,
            email: usersTable.email,
          })
          .from(usersTable)
          .where(
            and(
              eq(usersTable.cluster, announcement.targetCluster),
              eq(usersTable.status, 'ACTIVE'),
            ),
          )

        clusterName = announcement.targetCluster
      }

      // Filter out author themselves
      const targetRecipients = recipients.filter((r) => r.id !== authorUser.userId)
      if (targetRecipients.length === 0) return

      const [author] = await this.db
        .select({ name: usersTable.name })
        .from(usersTable)
        .where(eq(usersTable.id, authorUser.userId))

      const { bodyHtml, summaryText } = this.extractContentDetails(announcement.content as any)

      await this.mailService.sendAnnouncement(
        targetRecipients,
        {
          id: announcement.id,
          title: announcement.title,
          category: announcement.category,
          authorName: author?.name ?? 'Admin',
          targetType: announcement.targetType,
          divisionName,
          subunitName,
          clusterName,
          eventStartDate: announcement.eventStartDate,
          location: announcement.location,
          summaryText,
          bodyHtml,
        },
        isUpdate,
      )
    } catch (err: any) {
      this.logger.error(`Failed to send announcement email: ${err.message}`)
    }
  }
}

