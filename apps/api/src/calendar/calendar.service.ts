import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { and, eq, inArray } from 'drizzle-orm'
import { OAuth2Client } from 'google-auth-library'
import { randomUUID } from 'node:crypto'
import {
  announcementsTable,
  calendarEventsTable,
  divisionMembersTable,
  requestsTable,
  tasksTable,
  userCalendarIntegrationsTable,
  usersTable,
} from '@moaspace/database'
import { DATABASE_CONNECTION, type Database } from '../database/database.provider.js'

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name)
  private readonly googleClientId: string
  private readonly googleClientSecret: string
  private readonly defaultRedirectUri: string

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly configService: ConfigService,
  ) {
    this.googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID', '')
    this.googleClientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET', '')
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3001')
    this.defaultRedirectUri = this.configService.get<string>(
      'GOOGLE_CALENDAR_REDIRECT_URL',
      `${frontendUrl}/api/calendar/callback`,
    )
  }

  private createOAuth2Client(redirectUri?: string): OAuth2Client {
    return new OAuth2Client(
      this.googleClientId,
      this.googleClientSecret,
      redirectUri || this.defaultRedirectUri,
    )
  }

  private getClientForUser(refreshToken: string): OAuth2Client {
    const client = new OAuth2Client(this.googleClientId, this.googleClientSecret)
    client.setCredentials({ refresh_token: refreshToken })
    return client
  }

  // ─── 1. Auth URL ───────────────────────────────────────────────────────────
  getAuthUrl(userId: string, redirectUri?: string): string {
    const client = this.createOAuth2Client(redirectUri)
    return client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar'],
      prompt: 'consent',
      state: userId,
    })
  }

  // ─── 2. Handle Callback ───────────────────────────────────────────────────
  async handleCallback(userId: string, code: string, redirectUri?: string) {
    const [user] = await this.db
      .select({ status: usersTable.status })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1)

    if (!user || user.status !== 'ACTIVE') {
      throw new BadRequestException('Akun nonaktif tidak dapat mengintegrasikan Google Calendar.')
    }

    const client = this.createOAuth2Client(redirectUri)
    const { tokens } = await client.getToken(code)

    let refreshToken = tokens.refresh_token
    if (!refreshToken) {
      const [existing] = await this.db
        .select()
        .from(userCalendarIntegrationsTable)
        .where(eq(userCalendarIntegrationsTable.userId, userId))
        .limit(1)

      if (existing?.googleRefreshToken) {
        refreshToken = existing.googleRefreshToken
      } else {
        throw new BadRequestException(
          'Gagal mendapatkan refresh token dari Google. Pastikan memberikan izin sinkronisasi.',
        )
      }
    }

    client.setCredentials({ refresh_token: refreshToken })

    // Ensure secondary calendar "MoaSpace - Tim KKN" exists
    const calendarId = await this.ensureMoaCalendar(client)

    // Upsert integration
    const [existing] = await this.db
      .select()
      .from(userCalendarIntegrationsTable)
      .where(eq(userCalendarIntegrationsTable.userId, userId))
      .limit(1)

    if (existing) {
      await this.db
        .update(userCalendarIntegrationsTable)
        .set({
          googleRefreshToken: refreshToken,
          calendarId,
          calendarName: 'MoaSpace - Tim KKN',
          syncEnabled: true,
          updatedAt: new Date(),
        })
        .where(eq(userCalendarIntegrationsTable.id, existing.id))
    } else {
      await this.db.insert(userCalendarIntegrationsTable).values({
        id: randomUUID(),
        userId,
        googleRefreshToken: refreshToken,
        calendarId,
        calendarName: 'MoaSpace - Tim KKN',
        syncEnabled: true,
      })
    }

    // Trigger initial sync in the background
    this.syncAllUserItems(userId).catch((err) => {
      this.logger.error(`Initial calendar sync failed for user ${userId}: ${err.message}`, err.stack)
    })

    return {
      success: true,
      calendarName: 'MoaSpace - Tim KKN',
    }
  }

  // ─── 3. Get Integration Status ─────────────────────────────────────────────
  async getStatus(userId: string) {
    const [integration] = await this.db
      .select()
      .from(userCalendarIntegrationsTable)
      .where(eq(userCalendarIntegrationsTable.userId, userId))
      .limit(1)

    if (!integration) {
      return {
        isConnected: false,
        syncEnabled: false,
        calendarName: null,
        updatedAt: null,
      }
    }

    return {
      isConnected: true,
      syncEnabled: integration.syncEnabled,
      calendarName: integration.calendarName,
      updatedAt: integration.updatedAt,
    }
  }

  // ─── 4. Toggle Sync ────────────────────────────────────────────────────────
  async toggleSync(userId: string, enabled: boolean) {
    const [user] = await this.db
      .select({ status: usersTable.status })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1)

    if (!user || user.status !== 'ACTIVE') {
      throw new BadRequestException('Akun nonaktif tidak dapat mengubah sinkronisasi Google Calendar.')
    }

    const [integration] = await this.db
      .select()
      .from(userCalendarIntegrationsTable)
      .where(eq(userCalendarIntegrationsTable.userId, userId))
      .limit(1)

    if (!integration) {
      throw new NotFoundException('Integrasi Google Calendar belum terhubung')
    }

    await this.db
      .update(userCalendarIntegrationsTable)
      .set({
        syncEnabled: enabled,
        updatedAt: new Date(),
      })
      .where(eq(userCalendarIntegrationsTable.id, integration.id))

    return {
      isConnected: true,
      syncEnabled: enabled,
      calendarName: integration.calendarName,
      updatedAt: new Date(),
    }
  }

  // ─── 5. Disconnect ─────────────────────────────────────────────────────────
  async disconnect(userId: string) {
    const [integration] = await this.db
      .select()
      .from(userCalendarIntegrationsTable)
      .where(eq(userCalendarIntegrationsTable.userId, userId))
      .limit(1)

    if (!integration) {
      return { success: true }
    }

    // Clean up calendar events rows in DB for this user
    await this.db
      .delete(calendarEventsTable)
      .where(eq(calendarEventsTable.userId, userId))

    // Remove user integration record
    await this.db
      .delete(userCalendarIntegrationsTable)
      .where(eq(userCalendarIntegrationsTable.id, integration.id))

    return { success: true }
  }

  // ─── Helper: Ensure Dedicated Calendar ────────────────────────────────────
  private async ensureMoaCalendar(client: OAuth2Client): Promise<string> {
    try {
      // 1. List user calendars
      const listRes = await client.request<{
        items?: Array<{ id: string; summary: string; deleted?: boolean }>
      }>({
        url: 'https://www.googleapis.com/calendar/v3/users/me/calendarList',
        method: 'GET',
      })

      const items = listRes.data.items || []
      const existing = items.find(
        (c) => c.summary === 'MoaSpace - Tim KKN' && !c.deleted,
      )

      if (existing) {
        return existing.id
      }

      // 2. Create if not found
      const createRes = await client.request<{ id: string }>({
        url: 'https://www.googleapis.com/calendar/v3/calendars',
        method: 'POST',
        data: {
          summary: 'MoaSpace - Tim KKN',
          description: 'Sinkronisasi deadline tugas dan permohonan MoaSpace',
          timeZone: 'Asia/Jakarta',
        },
      })

      return createRes.data.id
    } catch (err: any) {
      this.logger.error(`Failed to ensure MoaSpace calendar: ${err.message}`, err.stack)
      throw new BadRequestException(
        `Gagal membuat atau mengakses kalender 'MoaSpace - Tim KKN': ${err.message}`,
      )
    }
  }

  // ─── 6. Sync Task Event ────────────────────────────────────────────────────
  async syncTaskEvent(taskId: string, isDelete = false): Promise<void> {
    try {
      const [task] = await this.db
        .select()
        .from(tasksTable)
        .where(eq(tasksTable.id, taskId))
        .limit(1)

      const existingRecords = await this.db
        .select()
        .from(calendarEventsTable)
        .where(
          and(
            eq(calendarEventsTable.entityType, 'TASK'),
            eq(calendarEventsTable.entityId, taskId),
          ),
        )

      // If deleted or task missing or dueDate missing or no assignee:
      if (isDelete || !task || !task.dueDate || !task.assigneeId) {
        for (const record of existingRecords) {
          await this.deleteGoogleEvent(record.userId, record.calendarId, record.googleEventId)
          await this.db
            .delete(calendarEventsTable)
            .where(eq(calendarEventsTable.id, record.id))
        }
        return
      }

      // If assignee changed, remove event from old assignee(s)
      for (const record of existingRecords) {
        if (record.userId !== task.assigneeId) {
          await this.deleteGoogleEvent(record.userId, record.calendarId, record.googleEventId)
          await this.db
            .delete(calendarEventsTable)
            .where(eq(calendarEventsTable.id, record.id))
        }
      }

      // Check if current assignee is active
      const [assigneeUser] = await this.db
        .select({ id: usersTable.id, status: usersTable.status })
        .from(usersTable)
        .where(eq(usersTable.id, task.assigneeId))
        .limit(1)

      if (!assigneeUser || assigneeUser.status !== 'ACTIVE') {
        for (const record of existingRecords) {
          await this.deleteGoogleEvent(record.userId, record.calendarId, record.googleEventId)
          await this.db
            .delete(calendarEventsTable)
            .where(eq(calendarEventsTable.id, record.id))
        }
        return
      }

      // Check if current assignee has active calendar sync
      const [integration] = await this.db
        .select()
        .from(userCalendarIntegrationsTable)
        .where(eq(userCalendarIntegrationsTable.userId, task.assigneeId))
        .limit(1)

      if (!integration || !integration.syncEnabled) {
        return
      }

      const client = this.getClientForUser(integration.googleRefreshToken)
      const isDone = task.status === 'DONE'
      const summary = `${isDone ? '[SELESAI] ' : ''}[TUGAS] ${task.title}`
      const end = new Date(task.dueDate)
      const start = new Date(end.getTime() - 60 * 60 * 1000)

      const description = [
        `Tugas MoaSpace: ${task.title}`,
        `Status: ${task.status}`,
        `Prioritas: ${task.priority}`,
        task.description ? `\nDeskripsi:\n${task.description}` : '',
      ]
        .filter(Boolean)
        .join('\n')

      const eventPayload = {
        summary,
        description,
        start: {
          dateTime: start.toISOString(),
          timeZone: 'Asia/Jakarta',
        },
        end: {
          dateTime: end.toISOString(),
          timeZone: 'Asia/Jakarta',
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 1440 }, // 24 hours before
            { method: 'popup', minutes: 60 },   // 1 hour before
          ],
        },
      }

      const currentRecord = existingRecords.find((r) => r.userId === task.assigneeId)

      if (currentRecord) {
        try {
          await client.request({
            url: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
              integration.calendarId,
            )}/events/${encodeURIComponent(currentRecord.googleEventId)}`,
            method: 'PATCH',
            data: eventPayload,
          })

          await this.db
            .update(calendarEventsTable)
            .set({ lastSyncedAt: new Date() })
            .where(eq(calendarEventsTable.id, currentRecord.id))
        } catch (patchErr: any) {
          if (patchErr.status === 404 || patchErr.status === 410) {
            // Event was deleted in Google Calendar, re-create it
            const createRes = await client.request<{ id: string }>({
              url: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
                integration.calendarId,
              )}/events`,
              method: 'POST',
              data: eventPayload,
            })

            await this.db
              .update(calendarEventsTable)
              .set({
                googleEventId: createRes.data.id,
                lastSyncedAt: new Date(),
              })
              .where(eq(calendarEventsTable.id, currentRecord.id))
          } else {
            throw patchErr
          }
        }
      } else {
        const createRes = await client.request<{ id: string }>({
          url: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
            integration.calendarId,
          )}/events`,
          method: 'POST',
          data: eventPayload,
        })

        await this.db.insert(calendarEventsTable).values({
          id: randomUUID(),
          userId: task.assigneeId,
          entityType: 'TASK',
          entityId: taskId,
          googleEventId: createRes.data.id,
          calendarId: integration.calendarId,
          lastSyncedAt: new Date(),
        })
      }
    } catch (err: any) {
      this.logger.error(`Error syncing task ${taskId} to Google Calendar: ${err.message}`, err.stack)
    }
  }

  // ─── 7. Sync Request Event ─────────────────────────────────────────────────
  async syncRequestEvent(requestId: string, isDelete = false): Promise<void> {
    try {
      const [request] = await this.db
        .select()
        .from(requestsTable)
        .where(eq(requestsTable.id, requestId))
        .limit(1)

      const existingRecords = await this.db
        .select()
        .from(calendarEventsTable)
        .where(
          and(
            eq(calendarEventsTable.entityType, 'REQUEST'),
            eq(calendarEventsTable.entityId, requestId),
          ),
        )

      // If deleted, missing, no deadline, draft, or rejected:
      if (
        isDelete ||
        !request ||
        !request.deadline ||
        request.status === 'DRAFT' ||
        request.status === 'REJECTED'
      ) {
        for (const record of existingRecords) {
          await this.deleteGoogleEvent(record.userId, record.calendarId, record.googleEventId)
          await this.db
            .delete(calendarEventsTable)
            .where(eq(calendarEventsTable.id, record.id))
        }
        return
      }

      // Find active coordinators of destination division
      const coordinators = await this.db
        .select({ userId: divisionMembersTable.userId })
        .from(divisionMembersTable)
        .innerJoin(usersTable, eq(divisionMembersTable.userId, usersTable.id))
        .where(
          and(
            eq(divisionMembersTable.divisionId, request.toDivisionId),
            eq(divisionMembersTable.role, 'COORDINATOR'),
            eq(usersTable.status, 'ACTIVE'),
          ),
        )

      // Check if requester is active
      const [requester] = await this.db
        .select({ id: usersTable.id, status: usersTable.status })
        .from(usersTable)
        .where(eq(usersTable.id, request.requesterId))
        .limit(1)

      const activeUserIds: string[] = []
      if (requester && requester.status === 'ACTIVE') {
        activeUserIds.push(requester.id)
      }
      for (const c of coordinators) {
        activeUserIds.push(c.userId)
      }

      const targetUserIds = Array.from(new Set(activeUserIds))

      // Clean up records for users no longer in target set
      for (const record of existingRecords) {
        if (!targetUserIds.includes(record.userId)) {
          await this.deleteGoogleEvent(record.userId, record.calendarId, record.googleEventId)
          await this.db
            .delete(calendarEventsTable)
            .where(eq(calendarEventsTable.id, record.id))
        }
      }

      const isDone = request.status === 'CONFIRMED'
      const summary = `${isDone ? '[SELESAI] ' : ''}[PERMOHONAN] ${request.title}`
      const end = new Date(request.deadline)
      const start = new Date(end.getTime() - 60 * 60 * 1000)

      const briefText =
        request.brief && typeof request.brief === 'object'
          ? (request.brief.ringkasan as string) ||
            (request.brief.description as string) ||
            ''
          : ''

      const description = [
        `Permohonan Antar-Divisi MoaSpace: ${request.title}`,
        `Status: ${request.status}`,
        briefText ? `\nRingkasan:\n${briefText}` : '',
        request.reason ? `\nCatatan:\n${request.reason}` : '',
      ]
        .filter(Boolean)
        .join('\n')

      const eventPayload = {
        summary,
        description,
        start: {
          dateTime: start.toISOString(),
          timeZone: 'Asia/Jakarta',
        },
        end: {
          dateTime: end.toISOString(),
          timeZone: 'Asia/Jakarta',
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 1440 },
            { method: 'popup', minutes: 60 },
          ],
        },
      }

      for (const targetUserId of targetUserIds) {
        const [integration] = await this.db
          .select()
          .from(userCalendarIntegrationsTable)
          .where(eq(userCalendarIntegrationsTable.userId, targetUserId))
          .limit(1)

        if (!integration || !integration.syncEnabled) {
          continue
        }

        const client = this.getClientForUser(integration.googleRefreshToken)
        const currentRecord = existingRecords.find((r) => r.userId === targetUserId)

        if (currentRecord) {
          try {
            await client.request({
              url: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
                integration.calendarId,
              )}/events/${encodeURIComponent(currentRecord.googleEventId)}`,
              method: 'PATCH',
              data: eventPayload,
            })

            await this.db
              .update(calendarEventsTable)
              .set({ lastSyncedAt: new Date() })
              .where(eq(calendarEventsTable.id, currentRecord.id))
          } catch (patchErr: any) {
            if (patchErr.status === 404 || patchErr.status === 410) {
              const createRes = await client.request<{ id: string }>({
                url: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
                  integration.calendarId,
                )}/events`,
                method: 'POST',
                data: eventPayload,
              })

              await this.db
                .update(calendarEventsTable)
                .set({
                  googleEventId: createRes.data.id,
                  lastSyncedAt: new Date(),
                })
                .where(eq(calendarEventsTable.id, currentRecord.id))
            } else {
              this.logger.error(
                `Failed to patch request event for user ${targetUserId}: ${patchErr.message}`,
              )
            }
          }
        } else {
          try {
            const createRes = await client.request<{ id: string }>({
              url: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
                integration.calendarId,
              )}/events`,
              method: 'POST',
              data: eventPayload,
            })

            await this.db.insert(calendarEventsTable).values({
              id: randomUUID(),
              userId: targetUserId,
              entityType: 'REQUEST',
              entityId: requestId,
              googleEventId: createRes.data.id,
              calendarId: integration.calendarId,
              lastSyncedAt: new Date(),
            })
          } catch (createErr: any) {
            this.logger.error(
              `Failed to create request event for user ${targetUserId}: ${createErr.message}`,
            )
          }
        }
      }
    } catch (err: any) {
      this.logger.error(
        `Error syncing request ${requestId} to Google Calendar: ${err.message}`,
        err.stack,
      )
    }
  }

  // ─── 8. Sync Announcement Event ────────────────────────────────────────────
  async syncAnnouncementEvent(announcementId: string, isDelete = false): Promise<void> {
    try {
      const [announcement] = await this.db
        .select()
        .from(announcementsTable)
        .where(eq(announcementsTable.id, announcementId))
        .limit(1)

      const existingRecords = await this.db
        .select()
        .from(calendarEventsTable)
        .where(
          and(
            eq(calendarEventsTable.entityType, 'ANNOUNCEMENT'),
            eq(calendarEventsTable.entityId, announcementId),
          ),
        )

      // If deleted, missing, or no eventStartDate:
      if (isDelete || !announcement || !announcement.eventStartDate) {
        for (const record of existingRecords) {
          await this.deleteGoogleEvent(record.userId, record.calendarId, record.googleEventId)
          await this.db
            .delete(calendarEventsTable)
            .where(eq(calendarEventsTable.id, record.id))
        }
        return
      }

      // Determine target users with active calendar integration
      let targetUserIntegrations: { userId: string; calendarId: string; googleRefreshToken: string }[] = []

      if (announcement.targetType === 'ALL') {
        targetUserIntegrations = await this.db
          .select({
            userId: userCalendarIntegrationsTable.userId,
            calendarId: userCalendarIntegrationsTable.calendarId,
            googleRefreshToken: userCalendarIntegrationsTable.googleRefreshToken,
          })
          .from(userCalendarIntegrationsTable)
          .innerJoin(usersTable, eq(userCalendarIntegrationsTable.userId, usersTable.id))
          .where(
            and(
              eq(userCalendarIntegrationsTable.syncEnabled, true),
              eq(usersTable.status, 'ACTIVE'),
            ),
          )
      } else if (announcement.targetType === 'DIVISION' && announcement.targetDivisionId) {
        targetUserIntegrations = await this.db
          .select({
            userId: userCalendarIntegrationsTable.userId,
            calendarId: userCalendarIntegrationsTable.calendarId,
            googleRefreshToken: userCalendarIntegrationsTable.googleRefreshToken,
          })
          .from(userCalendarIntegrationsTable)
          .innerJoin(
            divisionMembersTable,
            eq(userCalendarIntegrationsTable.userId, divisionMembersTable.userId),
          )
          .innerJoin(usersTable, eq(userCalendarIntegrationsTable.userId, usersTable.id))
          .where(
            and(
              eq(divisionMembersTable.divisionId, announcement.targetDivisionId),
              eq(userCalendarIntegrationsTable.syncEnabled, true),
              eq(usersTable.status, 'ACTIVE'),
            ),
          )
      }

      const targetUserIds = targetUserIntegrations.map((u) => u.userId)

      // Clean up records for users who are no longer target
      for (const record of existingRecords) {
        if (!targetUserIds.includes(record.userId)) {
          await this.deleteGoogleEvent(record.userId, record.calendarId, record.googleEventId)
          await this.db
            .delete(calendarEventsTable)
            .where(eq(calendarEventsTable.id, record.id))
        }
      }

      // Determine category prefix
      let categoryPrefix = '[PENGUMUMAN]'
      if (announcement.category === 'MEETING') categoryPrefix = '[RAPAT]'
      else if (announcement.category === 'URGENT') categoryPrefix = '[PENTING]'
      else if (announcement.category === 'ACTIVITY') categoryPrefix = '[KEGIATAN]'

      const summary = `${categoryPrefix} ${announcement.title}`
      const start = new Date(announcement.eventStartDate)
      const end = announcement.eventEndDate
        ? new Date(announcement.eventEndDate)
        : new Date(start.getTime() + 60 * 60 * 1000)

      const description = [
        `Pengumuman MoaSpace: ${announcement.title}`,
        `Kategori: ${announcement.category}`,
        announcement.location ? `Lokasi: ${announcement.location}` : '',
      ]
        .filter(Boolean)
        .join('\n')

      const eventPayload = {
        summary,
        description,
        location: announcement.location || undefined,
        start: {
          dateTime: start.toISOString(),
          timeZone: 'Asia/Jakarta',
        },
        end: {
          dateTime: end.toISOString(),
          timeZone: 'Asia/Jakarta',
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 1440 }, // 24 hours before
            { method: 'popup', minutes: 60 },   // 1 hour before
          ],
        },
      }

      for (const target of targetUserIntegrations) {
        const client = this.getClientForUser(target.googleRefreshToken)
        const currentRecord = existingRecords.find((r) => r.userId === target.userId)

        if (currentRecord) {
          try {
            await client.request({
              url: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
                target.calendarId,
              )}/events/${encodeURIComponent(currentRecord.googleEventId)}`,
              method: 'PATCH',
              data: eventPayload,
            })

            await this.db
              .update(calendarEventsTable)
              .set({ lastSyncedAt: new Date() })
              .where(eq(calendarEventsTable.id, currentRecord.id))
          } catch (patchErr: any) {
            if (patchErr.status === 404 || patchErr.status === 410) {
              const createRes = await client.request<{ id: string }>({
                url: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
                  target.calendarId,
                )}/events`,
                method: 'POST',
                data: eventPayload,
              })

              await this.db
                .update(calendarEventsTable)
                .set({
                  googleEventId: createRes.data.id,
                  lastSyncedAt: new Date(),
                })
                .where(eq(calendarEventsTable.id, currentRecord.id))
            } else {
              this.logger.error(
                `Failed to patch announcement event for user ${target.userId}: ${patchErr.message}`,
              )
            }
          }
        } else {
          try {
            const createRes = await client.request<{ id: string }>({
              url: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
                target.calendarId,
              )}/events`,
              method: 'POST',
              data: eventPayload,
            })

            await this.db.insert(calendarEventsTable).values({
              id: randomUUID(),
              userId: target.userId,
              entityType: 'ANNOUNCEMENT',
              entityId: announcementId,
              googleEventId: createRes.data.id,
              calendarId: target.calendarId,
              lastSyncedAt: new Date(),
            })
          } catch (createErr: any) {
            this.logger.error(
              `Failed to create announcement event for user ${target.userId}: ${createErr.message}`,
            )
          }
        }
      }
    } catch (err: any) {
      this.logger.error(
        `Error syncing announcement ${announcementId} to Google Calendar: ${err.message}`,
        err.stack,
      )
    }
  }

  // ─── Helper: Delete Google Event ───────────────────────────────────────────
  private async deleteGoogleEvent(
    userId: string,
    calendarId: string,
    googleEventId: string,
  ): Promise<void> {
    try {
      const [integration] = await this.db
        .select()
        .from(userCalendarIntegrationsTable)
        .where(eq(userCalendarIntegrationsTable.userId, userId))
        .limit(1)

      if (!integration) return

      const client = this.getClientForUser(integration.googleRefreshToken)
      await client.request({
        url: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
          calendarId,
        )}/events/${encodeURIComponent(googleEventId)}`,
        method: 'DELETE',
      })
    } catch (err: any) {
      // Ignore 404/410 not found
      if (err.status !== 404 && err.status !== 410) {
        this.logger.warn(`Failed to delete Google event ${googleEventId}: ${err.message}`)
      }
    }
  }

  // ─── 9. Sync All User Items (Initial or Full Sync) ──────────────────────────
  async syncAllUserItems(userId: string): Promise<void> {
    const [user] = await this.db
      .select({ id: usersTable.id, status: usersTable.status })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1)

    if (!user || user.status !== 'ACTIVE') {
      return
    }

    // 1. Sync tasks where user is assignee and dueDate is not null
    const userTasks = await this.db
      .select({ id: tasksTable.id })
      .from(tasksTable)
      .where(eq(tasksTable.assigneeId, userId))

    for (const t of userTasks) {
      await this.syncTaskEvent(t.id)
    }

    // 2. Sync requests where user is requester
    const requesterRequests = await this.db
      .select({ id: requestsTable.id })
      .from(requestsTable)
      .where(eq(requestsTable.requesterId, userId))

    for (const r of requesterRequests) {
      await this.syncRequestEvent(r.id)
    }

    // 3. Sync requests where user is coordinator in destination division
    const userCoordinatorDivisions = await this.db
      .select({ divisionId: divisionMembersTable.divisionId })
      .from(divisionMembersTable)
      .where(
        and(
          eq(divisionMembersTable.userId, userId),
          eq(divisionMembersTable.role, 'COORDINATOR'),
        ),
      )

    if (userCoordinatorDivisions.length > 0) {
      const divisionIds = userCoordinatorDivisions.map((d) => d.divisionId)
      const coordRequests = await this.db
        .select({ id: requestsTable.id })
        .from(requestsTable)
        .where(inArray(requestsTable.toDivisionId, divisionIds))

      for (const r of coordRequests) {
        await this.syncRequestEvent(r.id)
      }
    }

    // 4. Sync announcements where targetType = 'ALL' or user's division is target
    const userDivisions = await this.db
      .select({ divisionId: divisionMembersTable.divisionId })
      .from(divisionMembersTable)
      .where(eq(divisionMembersTable.userId, userId))

    const userDivisionIds = userDivisions.map((d) => d.divisionId)

    const allAnnouncements = await this.db
      .select({
        id: announcementsTable.id,
        targetType: announcementsTable.targetType,
        targetDivisionId: announcementsTable.targetDivisionId,
      })
      .from(announcementsTable)

    for (const a of allAnnouncements) {
      if (
        a.targetType === 'ALL' ||
        (a.targetDivisionId && userDivisionIds.includes(a.targetDivisionId))
      ) {
        await this.syncAnnouncementEvent(a.id)
      }
    }
  }

  // ─── 10. Handle User Deactivation (Clean up Calendar) ──────────────────────
  async handleUserDeactivation(userId: string): Promise<void> {
    try {
      const [integration] = await this.db
        .select()
        .from(userCalendarIntegrationsTable)
        .where(eq(userCalendarIntegrationsTable.userId, userId))
        .limit(1)

      const userEvents = await this.db
        .select()
        .from(calendarEventsTable)
        .where(eq(calendarEventsTable.userId, userId))

      if (integration) {
        for (const record of userEvents) {
          await this.deleteGoogleEvent(record.userId, record.calendarId, record.googleEventId)
        }

        await this.db
          .update(userCalendarIntegrationsTable)
          .set({ syncEnabled: false, updatedAt: new Date() })
          .where(eq(userCalendarIntegrationsTable.id, integration.id))
      }

      await this.db
        .delete(calendarEventsTable)
        .where(eq(calendarEventsTable.userId, userId))
    } catch (err: any) {
      this.logger.error(
        `Failed to cleanup calendar for deactivated user ${userId}: ${err.message}`,
        err.stack,
      )
    }
  }
}
