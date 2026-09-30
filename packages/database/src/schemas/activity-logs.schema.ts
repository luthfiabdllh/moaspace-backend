import { jsonb, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'
import { usersTable } from './users.schema'

export const activityLogsTable = pgTable('activity_logs', {
  id: text('id').primaryKey(),
  entityType: varchar('entity_type', { length: 50 }).notNull(), // 'USER', 'DIVISION_MEMBER', 'EPIC', 'STORY', 'TASK'
  entityId: text('entity_id').notNull(),
  action: varchar('action', { length: 100 }).notNull(), // 'USER_CREATED', 'ROLE_CHANGED', 'DIVISION_ADDED', 'DIVISION_REMOVED', 'DIVISION_MOVED', 'STATUS_CHANGED', 'GLOBAL_ROLE_CHANGED'
  actorId: text('actor_id').references(() => usersTable.id, { onDelete: 'set null' }),
  before: jsonb('before'),
  after: jsonb('after'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type ActivityLog = typeof activityLogsTable.$inferSelect
export type InsertActivityLog = typeof activityLogsTable.$inferInsert
