import { boolean, integer, pgEnum, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'
import { storiesTable } from './stories.schema'
import { usersTable } from './users.schema'

export const taskStatusEnum = pgEnum('task_status', [
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'REVIEW',
  'DONE',
])

export const taskPriorityEnum = pgEnum('task_priority', [
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
])

export const tasksTable = pgTable('tasks', {
  id: text('id').primaryKey(),
  storyId: text('story_id')
    .notNull()
    .references(() => storiesTable.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  assigneeId: text('assignee_id').references(() => usersTable.id, {
    onDelete: 'set null',
  }),
  status: taskStatusEnum('status').notNull().default('BACKLOG'),
  priority: taskPriorityEnum('priority').notNull().default('MEDIUM'),
  dueDate: timestamp('due_date', { withTimezone: true }),
  position: varchar('position', { length: 50 }).notNull().default('0'),
  storyPoints: integer('story_points'),
  spLockedAt: timestamp('sp_locked_at', { withTimezone: true }),
  isBlocked: boolean('is_blocked').notNull().default(false),
  blockedReason: text('blocked_reason'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  revisionCount: integer('revision_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export type Task = typeof tasksTable.$inferSelect
export type InsertTask = typeof tasksTable.$inferInsert
