import { date, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core'
import { usersTable } from './users.schema'
import { tasksTable } from './tasks.schema'

export const capacityRequestStatusEnum = pgEnum('capacity_request_status', [
  'NONE',
  'PENDING',
  'APPROVED',
  'REJECTED',
])

export const memberCapacitiesTable = pgTable(
  'member_capacities',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    weekStart: date('week_start').notNull(), // Format YYYY-MM-DD (Senin)
    capacitySp: integer('capacity_sp').notNull().default(10), // Default kapasitas
    note: text('note'),
    updatedById: text('updated_by_id').references(() => usersTable.id),
    requestedSp: integer('requested_sp'),
    requestStatus: capacityRequestStatusEnum('request_status').notNull().default('NONE'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex('uniq_user_week').on(t.userId, t.weekStart)],
)

export const taskSpLogsTable = pgTable('task_sp_logs', {
  id: text('id').primaryKey(),
  taskId: text('task_id')
    .notNull()
    .references(() => tasksTable.id, { onDelete: 'cascade' }),
  oldSp: integer('old_sp'),
  newSp: integer('new_sp').notNull(),
  changedById: text('changed_by_id')
    .notNull()
    .references(() => usersTable.id),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const assignmentOverridesTable = pgTable('assignment_overrides', {
  id: text('id').primaryKey(),
  taskId: text('task_id')
    .notNull()
    .references(() => tasksTable.id, { onDelete: 'cascade' }),
  assigneeId: text('assignee_id')
    .notNull()
    .references(() => usersTable.id),
  utilizationAtAssign: integer('utilization_at_assign').notNull(), // Dalam persen
  overriddenById: text('overridden_by_id')
    .notNull()
    .references(() => usersTable.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const systemSettingsTable = pgTable('system_settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: jsonb('value').notNull(),
})

export type MemberCapacity = typeof memberCapacitiesTable.$inferSelect
export type InsertMemberCapacity = typeof memberCapacitiesTable.$inferInsert
export type TaskSpLog = typeof taskSpLogsTable.$inferSelect
export type AssignmentOverride = typeof assignmentOverridesTable.$inferSelect
export type SystemSetting = typeof systemSettingsTable.$inferSelect
