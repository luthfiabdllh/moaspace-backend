import { boolean, pgEnum, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'

export const userStatusEnum = pgEnum('user_status', ['ACTIVE', 'INACTIVE'])
export const tokenTypeEnum = pgEnum('token_type', ['ACTIVATION', 'RESET_PASSWORD'])

export const usersTable = pgTable('users', {
  id: text('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash'),
  googleId: varchar('google_id', { length: 255 }),
  isSuperAdmin: boolean('is_super_admin').notNull().default(false),
  isKormanit: boolean('is_kormanit').notNull().default(false),
  status: userStatusEnum('status').notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export const authTokensTable = pgTable('auth_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  type: tokenTypeEnum('type').notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const sessionsTable = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  refreshTokenHash: text('refresh_token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type User = typeof usersTable.$inferSelect
export type InsertUser = typeof usersTable.$inferInsert
export type AuthToken = typeof authTokensTable.$inferSelect
export type InsertAuthToken = typeof authTokensTable.$inferInsert
export type Session = typeof sessionsTable.$inferSelect
export type InsertSession = typeof sessionsTable.$inferInsert
