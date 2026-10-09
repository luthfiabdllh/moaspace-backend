import { boolean, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'
import { usersTable } from './users.schema'

export const userCalendarIntegrationsTable = pgTable('user_calendar_integrations', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  googleRefreshToken: text('google_refresh_token').notNull(),
  calendarId: text('calendar_id').notNull(),
  calendarName: varchar('calendar_name', { length: 255 })
    .notNull()
    .default('MoaSpace - Tim KKN'),
  syncEnabled: boolean('sync_enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export const calendarEventsTable = pgTable('calendar_events', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  entityType: varchar('entity_type', { length: 50 }).notNull(), // 'TASK' | 'REQUEST'
  entityId: text('entity_id').notNull(),
  googleEventId: text('google_event_id').notNull(),
  calendarId: text('calendar_id').notNull(),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }).notNull().defaultNow(),
})

export type UserCalendarIntegration = typeof userCalendarIntegrationsTable.$inferSelect
export type InsertUserCalendarIntegration = typeof userCalendarIntegrationsTable.$inferInsert
export type CalendarEvent = typeof calendarEventsTable.$inferSelect
export type InsertCalendarEvent = typeof calendarEventsTable.$inferInsert
