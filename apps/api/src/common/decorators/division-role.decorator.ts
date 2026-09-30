import { SetMetadata } from '@nestjs/common'

export const DIVISION_ROLE_KEY = 'division_role'
export type DivisionRoleRequired = 'MEMBER' | 'COORDINATOR'

export const DivisionRole = (role: DivisionRoleRequired = 'COORDINATOR') =>
  SetMetadata(DIVISION_ROLE_KEY, role)
