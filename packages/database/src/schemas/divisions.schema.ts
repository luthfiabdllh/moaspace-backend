import { boolean, pgEnum, pgTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core'
import { usersTable } from './users.schema'

export const divisionRoleEnum = pgEnum('division_role', ['MEMBER', 'COORDINATOR'])

export const divisionsTable = pgTable('divisions', {
  id: text('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  requestApprovalEnabled: boolean('request_approval_enabled').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export const divisionMembersTable = pgTable(
  'division_members',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    divisionId: text('division_id')
      .notNull()
      .references(() => divisionsTable.id, { onDelete: 'cascade' }),
    role: divisionRoleEnum('role').notNull().default('MEMBER'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex('uniq_user_division').on(t.userId, t.divisionId)],
)

export type Division = typeof divisionsTable.$inferSelect
export type InsertDivision = typeof divisionsTable.$inferInsert
export type DivisionMember = typeof divisionMembersTable.$inferSelect
export type InsertDivisionMember = typeof divisionMembersTable.$inferInsert
