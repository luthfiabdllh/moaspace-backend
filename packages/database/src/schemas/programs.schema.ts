import { pgEnum, pgTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core'
import { usersTable } from './users.schema'
import { subunitsTable } from './subunits.schema'

export const programScopeEnum = pgEnum('program_scope', ['UNIT', 'SUBUNIT'])
export const programClusterEnum = pgEnum('program_cluster', [
  'SAINTEK',
  'SOSHUM',
  'MEDIKA',
  'AGRO',
  'UNIT_SHARED',
])
export const programStatusEnum = pgEnum('program_status', [
  'PROPOSED',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
])
export const programApprovalStatusEnum = pgEnum('program_approval_status', [
  'PENDING',
  'APPROVED',
  'REJECTED',
])
export const programMemberRoleEnum = pgEnum('program_member_role', ['CO_PIC', 'MEMBER'])

export const programsTable = pgTable('programs', {
  id: text('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  scope: programScopeEnum('scope').notNull().default('SUBUNIT'),
  subunitId: text('subunit_id').references(() => subunitsTable.id, { onDelete: 'set null' }),
  cluster: programClusterEnum('cluster').notNull().default('UNIT_SHARED'),
  primaryPicId: text('primary_pic_id')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'restrict' }),
  startDate: timestamp('start_date', { withTimezone: true }),
  endDate: timestamp('end_date', { withTimezone: true }),
  status: programStatusEnum('status').notNull().default('PROPOSED'),

  // Parallel review: Aspek Keilmuan (Kormater)
  clusterApprovalStatus: programApprovalStatusEnum('cluster_approval_status')
    .notNull()
    .default('PENDING'),
  clusterApprovedById: text('cluster_approved_by_id').references(() => usersTable.id, {
    onDelete: 'set null',
  }),
  clusterApprovedAt: timestamp('cluster_approved_at', { withTimezone: true }),
  clusterRejectionReason: text('cluster_rejection_reason'),

  // Parallel review: Aspek Tata Kelola/Wilayah (Kormasit untuk SUBUNIT, Kormanit untuk UNIT)
  governanceApprovalStatus: programApprovalStatusEnum('governance_approval_status')
    .notNull()
    .default('PENDING'),
  governanceApprovedById: text('governance_approved_by_id').references(() => usersTable.id, {
    onDelete: 'set null',
  }),
  governanceApprovedAt: timestamp('governance_approved_at', { withTimezone: true }),
  governanceRejectionReason: text('governance_rejection_reason'),

  createdById: text('created_by_id')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export const programMembersTable = pgTable(
  'program_members',
  {
    id: text('id').primaryKey(),
    programId: text('program_id')
      .notNull()
      .references(() => programsTable.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    role: programMemberRoleEnum('role').notNull().default('MEMBER'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex('uniq_program_user').on(t.programId, t.userId)],
)

export type Program = typeof programsTable.$inferSelect
export type InsertProgram = typeof programsTable.$inferInsert
export type ProgramMember = typeof programMembersTable.$inferSelect
export type InsertProgramMember = typeof programMembersTable.$inferInsert
