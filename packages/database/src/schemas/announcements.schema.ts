import { boolean, jsonb, pgEnum, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'
import { usersTable, academicClusterEnum } from './users.schema'
import { divisionsTable } from './divisions.schema'
import { subunitsTable } from './subunits.schema'

export const announcementCategoryEnum = pgEnum('announcement_category', [
  'URGENT',   // Penting / Mendesak
  'MEETING',  // Rapat / Briefing
  'INFO',     // Informasi Umum
  'ACTIVITY', // Kegiatan Lapangan
])

export const announcementTargetEnum = pgEnum('announcement_target', [
  'ALL',      // Seluruh Tim KKN
  'DIVISION', // Divisi Tertentu
  'SUBUNIT',  // Posko / Subunit Tertentu
  'CLUSTER',  // Klaster Tertentu (Saintek/Soshum/Medika/Agro)
])

export const announcementsTable = pgTable('announcements', {
  id: text('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  content: jsonb('content').$type<Record<string, unknown>>().notNull(),
  category: announcementCategoryEnum('category').notNull().default('INFO'),
  targetType: announcementTargetEnum('target_type').notNull().default('ALL'),
  targetDivisionId: text('target_division_id').references(() => divisionsTable.id, {
    onDelete: 'set null',
  }),
  targetSubunitId: text('target_subunit_id').references(() => subunitsTable.id, {
    onDelete: 'set null',
  }),
  targetCluster: academicClusterEnum('target_cluster'),
  isPinned: boolean('is_pinned').notNull().default(false),
  eventStartDate: timestamp('event_start_date', { withTimezone: true }),
  eventEndDate: timestamp('event_end_date', { withTimezone: true }),
  location: varchar('location', { length: 255 }),
  authorId: text('author_id')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export type Announcement = typeof announcementsTable.$inferSelect
export type InsertAnnouncement = typeof announcementsTable.$inferInsert
