import { pgEnum, pgTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core'
import { usersTable } from './users.schema'

export const subunitRoleEnum = pgEnum('subunit_role', ['MEMBER', 'COORDINATOR'])

export const subunitsTable = pgTable('subunits', {
  id: text('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  location: text('location'),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export const subunitMembersTable = pgTable(
  'subunit_members',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    subunitId: text('subunit_id')
      .notNull()
      .references(() => subunitsTable.id, { onDelete: 'cascade' }),
    role: subunitRoleEnum('role').notNull().default('MEMBER'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex('uniq_user_subunit').on(t.userId)],
)

export type Subunit = typeof subunitsTable.$inferSelect
export type InsertSubunit = typeof subunitsTable.$inferInsert
export type SubunitMember = typeof subunitMembersTable.$inferSelect
export type InsertSubunitMember = typeof subunitMembersTable.$inferInsert
