import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { and, desc, eq, ilike, inArray, or } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import {
  announcementsTable,
  divisionMembersTable,
  divisionsTable,
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

  // ─── 1. Cek Hak Akses Pembuatan (PSDM / Kormanit / Admin) ─────────────────
  async canManageAnnouncements(user: RequestUser): Promise<boolean> {
    if (user.isSuperAdmin || user.isKormanit) {
      return true
    }

    const memberships = await this.db
      .select({ slug: divisionsTable.slug })
      .from(divisionMembersTable)
      .innerJoin(divisionsTable, eq(divisionMembersTable.divisionId, divisionsTable.id))
      .where(eq(divisionMembersTable.userId, user.userId))

    return memberships.some((m) => m.slug.toLowerCase() === 'psdm')
  }

  // ─── 2. Buat Pengumuman ────────────────────────────────────────────────────
  async create(dto: CreateAnnouncementDto, user: RequestUser) {
    const isAllowed = await this.canManageAnnouncements(user)
    if (!isAllowed) {
      throw new ForbiddenException(
        'Hanya divisi PSDM, Kormanit, atau Super Admin yang dapat membuat pengumuman.',
      )
    }

    if (dto.targetType === 'DIVISION' && !dto.targetDivisionId) {
      throw new BadRequestException('Target divisi wajib dipilih jika target type DIVISION.')
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
        targetType: dto.targetType || 'ALL',
        targetDivisionId: dto.targetType === 'DIVISION' ? dto.targetDivisionId || null : null,
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

    // Kirim notifikasi email ke target audiens
    this.sendAnnouncementNotification(created, user).catch((err) => {
      this.logger.error(`Failed to send email for announcement ${announcementId}: ${err.message}`)
    })

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

    const conditions = []

    // Access control: anggota biasa hanya melihat 'ALL' atau divisinya
    if (!isPrivileged) {
      if (userDivisionIds.length > 0) {
        conditions.push(
          or(
            eq(announcementsTable.targetType, 'ALL'),
            inArray(announcementsTable.targetDivisionId, userDivisionIds),
          ),
        )
      } else {
        conditions.push(eq(announcementsTable.targetType, 'ALL'))
      }
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
      })
      .from(announcementsTable)
      .innerJoin(usersTable, eq(announcementsTable.authorId, usersTable.id))
      .leftJoin(divisionsTable, eq(announcementsTable.targetDivisionId, divisionsTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(announcementsTable.isPinned), desc(announcementsTable.createdAt))

    return rows.map((r) => ({
      ...r.announcement,
      author: r.author,
      targetDivision: r.targetDivision?.id ? r.targetDivision : null,
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
      })
      .from(announcementsTable)
      .innerJoin(usersTable, eq(announcementsTable.authorId, usersTable.id))
      .leftJoin(divisionsTable, eq(announcementsTable.targetDivisionId, divisionsTable.id))
      .where(eq(announcementsTable.id, id))
      .limit(1)

    if (!row) {
      throw new NotFoundException('Pengumuman tidak ditemukan.')
    }

    const isPrivileged = Boolean(user.isSuperAdmin || user.isKormanit)
    if (!isPrivileged && row.announcement.targetType === 'DIVISION') {
      const isMember = await this.isMemberOfDivision(user.userId, row.announcement.targetDivisionId)
      if (!isMember) {
        throw new ForbiddenException('Anda tidak memiliki wewenang melihat pengumuman divisi ini.')
      }
    }

    return {
      ...row.announcement,
      author: row.author,
      targetDivision: row.targetDivision?.id ? row.targetDivision : null,
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
    } else if (dto.targetDivisionId !== undefined) {
      updates.targetDivisionId = dto.targetDivisionId || null
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

  // ─── Helper: Cek Keanggotaan Divisi ────────────────────────────────────────
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
  ): Promise<void> {
    try {
      let recipients: { id: string; name: string; email: string }[] = []

      if (announcement.targetType === 'ALL') {
        recipients = await this.db
          .select({
            id: usersTable.id,
            name: usersTable.name,
            email: usersTable.email,
          })
          .from(usersTable)
          .where(eq(usersTable.status, 'ACTIVE'))
      } else if (announcement.targetDivisionId) {
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
      }

      // Filter out author themselves
      const targetRecipients = recipients.filter((r) => r.id !== authorUser.userId)
      if (targetRecipients.length === 0) return

      let divisionName: string | undefined
      if (announcement.targetDivisionId) {
        const [div] = await this.db
          .select({ name: divisionsTable.name })
          .from(divisionsTable)
          .where(eq(divisionsTable.id, announcement.targetDivisionId))
        divisionName = div?.name
      }

      const [author] = await this.db
        .select({ name: usersTable.name })
        .from(usersTable)
        .where(eq(usersTable.id, authorUser.userId))

      const { bodyHtml, summaryText } = this.extractContentDetails(announcement.content as any)

      await this.mailService.sendAnnouncement(targetRecipients, {
        id: announcement.id,
        title: announcement.title,
        category: announcement.category,
        authorName: author?.name ?? 'Admin',
        targetType: announcement.targetType,
        divisionName,
        eventStartDate: announcement.eventStartDate,
        location: announcement.location,
        summaryText,
        bodyHtml,
      })
    } catch (err: any) {
      this.logger.error(`Failed to send announcement email: ${err.message}`)
    }
  }
}
