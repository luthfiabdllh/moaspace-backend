import { Inject, Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { and, eq, isNotNull, ne } from 'drizzle-orm'
import { DATABASE_CONNECTION } from '../database/database.provider.js'
import type { Database } from '../database/database.provider.js'
import {
  tasksTable,
  storiesTable,
  requestsTable,
  usersTable,
  divisionsTable,
  divisionMembersTable,
} from '@moaspace/database'
import { MailService } from '../mail/mail.service.js'

@Injectable()
export class DeadlineReminderService {
  private readonly logger = new Logger(DeadlineReminderService.name)

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly mailService: MailService,
  ) {}

  // Cron schedule: 01:00 UTC = 08:00 WIB (UTC+7) every day
  @Cron('0 1 * * *')
  async handleDailyDeadlineReminders(): Promise<void> {
    this.logger.log('Executing daily deadline reminder check (08:00 WIB)...')
    await this.checkAndSendDeadlines()
  }

  async checkAndSendDeadlines(): Promise<{ tasksNotified: number; requestsNotified: number }> {
    let tasksNotified = 0
    let requestsNotified = 0

    const now = new Date()

    // Determine Today and Tomorrow dates in WIB (UTC+7)
    // Offset for UTC+7 is 7 * 60 minutes = 420 minutes
    const wibOffsetMs = 7 * 60 * 60 * 1000
    const wibNow = new Date(now.getTime() + wibOffsetMs)

    const todayStr = wibNow.toISOString().slice(0, 10) // YYYY-MM-DD
    const tomorrowDate = new Date(wibNow.getTime() + 24 * 60 * 60 * 1000)
    const tomorrowStr = tomorrowDate.toISOString().slice(0, 10) // YYYY-MM-DD

    // ─── 1. Check Tasks ────────────────────────────────────────────────────────
    try {
      const activeTasks = await this.db
        .select({
          task: tasksTable,
          assignee: {
            id: usersTable.id,
            name: usersTable.name,
            email: usersTable.email,
          },
          division: {
            id: divisionsTable.id,
            name: divisionsTable.name,
          },
        })
        .from(tasksTable)
        .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
        .innerJoin(storiesTable, eq(tasksTable.storyId, storiesTable.id))
        .leftJoin(divisionsTable, eq(storiesTable.divisionId, divisionsTable.id))
        .where(
          and(
            ne(tasksTable.status, 'DONE'),
            isNotNull(tasksTable.dueDate),
            isNotNull(tasksTable.assigneeId),
          ),
        )

      for (const row of activeTasks) {
        if (!row.task.dueDate || !row.assignee?.email) continue

        const taskDueDateWib = new Date(new Date(row.task.dueDate).getTime() + wibOffsetMs)
          .toISOString()
          .slice(0, 10)

        const isToday = taskDueDateWib === todayStr
        const isTomorrow = taskDueDateWib === tomorrowStr

        if (isToday || isTomorrow) {
          await this.mailService.sendTaskDeadlineReminder(
            {
              email: row.assignee.email,
              name: row.assignee.name,
            },
            {
              id: row.task.id,
              title: row.task.title,
              divisionName: row.division?.name,
              priority: row.task.priority,
              dueDate: row.task.dueDate,
            },
            isToday,
          )
          tasksNotified++
        }
      }
    } catch (err) {
      this.logger.error('Error checking task deadlines:', err)
    }

    // ─── 2. Check Requests ─────────────────────────────────────────────────────
    try {
      const terminalStatuses = ['CONFIRMED', 'REJECTED'] as const
      const activeRequests = await this.db
        .select({
          request: requestsTable,
          toDivision: {
            id: divisionsTable.id,
            name: divisionsTable.name,
          },
        })
        .from(requestsTable)
        .leftJoin(divisionsTable, eq(requestsTable.toDivisionId, divisionsTable.id))
        .where(isNotNull(requestsTable.deadline))

      for (const row of activeRequests) {
        // Skip terminal statuses
        if (terminalStatuses.includes(row.request.status as any)) continue
        if (!row.request.deadline || !row.toDivision?.name) continue

        const reqDeadlineWib = new Date(new Date(row.request.deadline).getTime() + wibOffsetMs)
          .toISOString()
          .slice(0, 10)

        const isToday = reqDeadlineWib === todayStr
        const isTomorrow = reqDeadlineWib === tomorrowStr

        if (isToday || isTomorrow) {
          // Find coordinators of target division
          const coordinators = await this.db
            .select({
              id: usersTable.id,
              name: usersTable.name,
              email: usersTable.email,
            })
            .from(divisionMembersTable)
            .innerJoin(usersTable, eq(divisionMembersTable.userId, usersTable.id))
            .where(
              and(
                eq(divisionMembersTable.divisionId, row.request.toDivisionId),
                eq(divisionMembersTable.role, 'COORDINATOR'),
                eq(usersTable.status, 'ACTIVE'),
              ),
            )

          const recipients = coordinators.length > 0 ? coordinators : await this.getDivisionMembers(row.request.toDivisionId)

          for (const recipient of recipients) {
            await this.mailService.sendRequestDeadlineReminder(
              recipient,
              {
                id: row.request.id,
                title: row.request.title,
                toDivisionName: row.toDivision.name,
                deadline: row.request.deadline,
              },
              isToday,
            )
            requestsNotified++
          }
        }
      }
    } catch (err) {
      this.logger.error('Error checking request deadlines:', err)
    }

    this.logger.log(
      `Deadline check finished. Notified ${tasksNotified} tasks and ${requestsNotified} requests.`,
    )

    return { tasksNotified, requestsNotified }
  }

  private async getDivisionMembers(divisionId: string): Promise<{ id: string; name: string; email: string }[]> {
    return this.db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
      })
      .from(divisionMembersTable)
      .innerJoin(usersTable, eq(divisionMembersTable.userId, usersTable.id))
      .where(
        and(
          eq(divisionMembersTable.divisionId, divisionId),
          eq(usersTable.status, 'ACTIVE'),
        ),
      )
  }
}
