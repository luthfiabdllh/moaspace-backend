import { pgEnum, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'

export const userRoleEnum = pgEnum('user_role', ['ADMIN', 'USER'])

export const usersTable = pgTable('users', {
  id: text('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: text('password'),
  role: userRoleEnum('role').notNull().default('USER'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export type User = typeof usersTable.$inferSelect
export type InsertUser = typeof usersTable.$inferInsert
