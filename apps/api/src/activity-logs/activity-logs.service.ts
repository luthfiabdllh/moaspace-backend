import crypto from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import { activityLogsTable, usersTable } from '@moaspace/database'
import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm'
import {
  DATABASE_CONNECTION,
  type Database,
} from '../database/database.provider.js'
import type { QueryActivityLogsDto } from './dto/query-activity-logs.dto.js'

export interface RecordActivityLogParams {
  entityType:
    | 'USER'
    | 'DIVISION'
    | 'DIVISION_MEMBER'
    | 'EPIC'
    | 'STORY'
    | 'TASK'
    | 'REQUEST'
    | 'MEMBER_CAPACITY'
    | 'ANNOUNCEMENT'
    | 'SUBUNIT'
    | 'PROGRAM'
  entityId: string
  action: string
  actorId?: string | null
  before?: Record<string, any> | null
  after?: Record<string, any> | null
}

@Injectable()
export class ActivityLogsService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async record(params: RecordActivityLogParams, tx?: any) {
    const dbClient = tx || this.db
    const logId = crypto.randomUUID()

    await dbClient.insert(activityLogsTable).values({
      id: logId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      actorId: params.actorId || null,
      before: params.before || null,
      after: params.after || null,
    })

    return { id: logId }
  }

  async findAll(query: QueryActivityLogsDto) {
    const {
      search,
      action,
      entityType,
      entityId,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = query

    const conditions: any[] = []

    if (entityType) {
      conditions.push(eq(activityLogsTable.entityType, entityType))
    }

    if (entityId) {
      conditions.push(eq(activityLogsTable.entityId, entityId))
    }

    if (action && action !== 'ALL') {
      conditions.push(eq(activityLogsTable.action, action))
    }

    if (search && search.trim()) {
      const pattern = `%${search.trim()}%`
      conditions.push(
        or(
          ilike(usersTable.name, pattern),
          ilike(usersTable.email, pattern),
          ilike(activityLogsTable.action, pattern),
          sql`CAST(${activityLogsTable.after} AS TEXT) ILIKE ${pattern}`,
          sql`CAST(${activityLogsTable.before} AS TEXT) ILIKE ${pattern}`,
        ),
      )
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // 1. Total count
    const [totalRow] = await this.db
      .select({ total: count() })
      .from(activityLogsTable)
      .leftJoin(usersTable, eq(activityLogsTable.actorId, usersTable.id))
      .where(whereClause)

    const total = Number(totalRow?.total ?? 0)

    // 2. Sorting
    let orderDirection: any
    if (sortBy === 'action') {
      orderDirection =
        sortOrder === 'asc'
          ? asc(activityLogsTable.action)
          : desc(activityLogsTable.action)
    } else if (sortBy === 'actorName') {
      orderDirection =
        sortOrder === 'asc' ? asc(usersTable.name) : desc(usersTable.name)
    } else {
      orderDirection =
        sortOrder === 'asc'
          ? asc(activityLogsTable.createdAt)
          : desc(activityLogsTable.createdAt)
    }

    // 3. Paginated items
    const safePage = Math.max(1, page)
    const safeLimit = Math.max(1, Math.min(100, limit))
    const offset = (safePage - 1) * safeLimit

    const items = await this.db
      .select({
        id: activityLogsTable.id,
        entityType: activityLogsTable.entityType,
        entityId: activityLogsTable.entityId,
        action: activityLogsTable.action,
        actorId: activityLogsTable.actorId,
        actorName: usersTable.name,
        actorEmail: usersTable.email,
        before: activityLogsTable.before,
        after: activityLogsTable.after,
        createdAt: activityLogsTable.createdAt,
      })
      .from(activityLogsTable)
      .leftJoin(usersTable, eq(activityLogsTable.actorId, usersTable.id))
      .where(whereClause)
      .orderBy(orderDirection)
      .limit(safeLimit)
      .offset(offset)

    const totalPages = Math.ceil(total / safeLimit)
    const hasMore = offset + items.length < total

    return {
      items,
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages,
        hasMore,
      },
    }
  }

  async findByEntity(entityType: string, entityId: string) {
    const res = await this.findAll({
      entityType,
      entityId,
      limit: 100,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    })
    return res.items
  }

  async findRecent(limit = 50) {
    const res = await this.findAll({
      limit,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    })
    return res.items
  }
}
