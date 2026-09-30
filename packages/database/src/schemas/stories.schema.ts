import { pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'
import { epicsTable } from './epics.schema'
import { divisionsTable } from './divisions.schema'

export const storiesTable = pgTable('stories', {
  id: text('id').primaryKey(),
  epicId: text('epic_id').references(() => epicsTable.id, {
    onDelete: 'set null',
  }),
  divisionId: text('division_id')
    .notNull()
    .references(() => divisionsTable.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  doneCriteria: text('done_criteria'),
  targetDate: timestamp('target_date', { withTimezone: true }),
  prokerTag: varchar('proker_tag', { length: 100 }),
  sourceRequestId: text('source_request_id'),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export type Story = typeof storiesTable.$inferSelect
export type InsertStory = typeof storiesTable.$inferInsert
