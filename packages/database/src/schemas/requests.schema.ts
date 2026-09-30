import { jsonb, pgEnum, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'
import { divisionsTable } from './divisions.schema.js'
import { usersTable } from './users.schema.js'
import { storiesTable } from './stories.schema.js'
import { tasksTable } from './tasks.schema.js'

export const requestStatusEnum = pgEnum('request_status', [
  'DRAFT',
  'WAITING_ORIGIN_APPROVAL',
  'SUBMITTED',
  'NEED_INFO',
  'REJECTED',
  'ACCEPTED',
  'IN_PROGRESS',
  'DELIVERED',
  'REVISION',
  'CONFIRMED',
])

export interface TemplateFieldDefinition {
  key: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'date' | 'number'
  required: boolean
  options?: string[]
  placeholder?: string
}

export const requestTemplatesTable = pgTable('request_templates', {
  id: text('id').primaryKey(),
  divisionId: text('division_id')
    .notNull()
    .references(() => divisionsTable.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  fields: jsonb('fields').$type<TemplateFieldDefinition[]>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export interface DeliveryAttachment {
  title: string
  url: string
}

export const requestsTable = pgTable('requests', {
  id: text('id').primaryKey(),
  fromDivisionId: text('from_division_id')
    .notNull()
    .references(() => divisionsTable.id),
  toDivisionId: text('to_division_id')
    .notNull()
    .references(() => divisionsTable.id),
  requesterId: text('requester_id')
    .notNull()
    .references(() => usersTable.id),
  templateId: text('template_id').references(() => requestTemplatesTable.id, {
    onDelete: 'set null',
  }),
  title: varchar('title', { length: 255 }).notNull(),
  brief: jsonb('brief').$type<Record<string, unknown>>().notNull(),
  deadline: timestamp('deadline', { withTimezone: true }),
  status: requestStatusEnum('status').notNull().default('DRAFT'),
  reason: text('reason'), // Alasan penolakan, permintaan info tambahan, atau catatan revisi
  deliveryNotes: text('delivery_notes'),
  deliveryAttachments: jsonb('delivery_attachments').$type<DeliveryAttachment[]>(),
  linkedStoryId: text('linked_story_id').references(() => storiesTable.id, {
    onDelete: 'set null',
  }),
  sourceTaskId: text('source_task_id').references(() => tasksTable.id, {
    onDelete: 'set null',
  }),
  sourceStoryId: text('source_story_id').references(() => storiesTable.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export const requestEventsTable = pgTable('request_events', {
  id: text('id').primaryKey(),
  requestId: text('request_id')
    .notNull()
    .references(() => requestsTable.id, { onDelete: 'cascade' }),
  fromStatus: requestStatusEnum('from_status'),
  toStatus: requestStatusEnum('to_status').notNull(),
  actorId: text('actor_id')
    .notNull()
    .references(() => usersTable.id),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type RequestTemplate = typeof requestTemplatesTable.$inferSelect
export type InsertRequestTemplate = typeof requestTemplatesTable.$inferInsert
export type CrossDivisionRequest = typeof requestsTable.$inferSelect
export type InsertCrossDivisionRequest = typeof requestsTable.$inferInsert
export type RequestEvent = typeof requestEventsTable.$inferSelect
export type InsertRequestEvent = typeof requestEventsTable.$inferInsert
