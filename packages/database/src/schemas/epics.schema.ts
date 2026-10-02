import { pgEnum, pgTable, primaryKey, text, timestamp, varchar } from 'drizzle-orm/pg-core'
import { usersTable } from './users.schema'
import { divisionsTable } from './divisions.schema'

export const epicScopeEnum = pgEnum('epic_scope', ['DIVISION', 'CROSS'])

export const epicsTable = pgTable('epics', {
  id: text('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  startDate: timestamp('start_date', { withTimezone: true }),
  endDate: timestamp('end_date', { withTimezone: true }),
  prokerTag: varchar('proker_tag', { length: 100 }),
  scope: epicScopeEnum('scope').notNull().default('DIVISION'),
  ownerDivisionId: text('owner_division_id').references(() => divisionsTable.id, {
    onDelete: 'set null',
  }),
  createdById: text('created_by_id')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  sourceRequestId: text('source_request_id'),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export const epicDivisionsTable = pgTable(
  'epic_divisions',
  {
    epicId: text('epic_id')
      .notNull()
      .references(() => epicsTable.id, { onDelete: 'cascade' }),
    divisionId: text('division_id')
      .notNull()
      .references(() => divisionsTable.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.epicId, t.divisionId] })],
)

export type Epic = typeof epicsTable.$inferSelect
export type InsertEpic = typeof epicsTable.$inferInsert
export type EpicDivision = typeof epicDivisionsTable.$inferSelect
export type InsertEpicDivision = typeof epicDivisionsTable.$inferInsert
