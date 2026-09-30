import {
  type ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DivisionRoleGuard } from './division-role.guard.js'

describe('DivisionRoleGuard', () => {
  let guard: DivisionRoleGuard
  let reflector: Reflector
  let mockDb: any

  beforeEach(() => {
    reflector = new Reflector()
    mockDb = {
      select: vi.fn(),
    }
    guard = new DivisionRoleGuard(reflector, mockDb)
  })

  function createMockContext(user: any, params: any = {}, body: any = {}): ExecutionContext {
    return {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          params,
          body,
        }),
      }),
    } as unknown as ExecutionContext
  }

  it('should return true if no @DivisionRole decorator is present', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined)
    const ctx = createMockContext(undefined)
    const canActivate = await guard.canActivate(ctx)
    expect(canActivate).toBe(true)
  })

  it('should throw UnauthorizedException if user is missing', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue('COORDINATOR')
    const ctx = createMockContext(undefined)
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException)
  })

  it('should return true if user is super admin', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue('COORDINATOR')
    const ctx = createMockContext({ userId: 'u-1', isSuperAdmin: true })
    const canActivate = await guard.canActivate(ctx)
    expect(canActivate).toBe(true)
  })

  it('should return true if user is kormanit', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue('COORDINATOR')
    const ctx = createMockContext({ userId: 'u-1', isKormanit: true })
    const canActivate = await guard.canActivate(ctx)
    expect(canActivate).toBe(true)
  })

  it('should throw ForbiddenException if user is not member of division', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue('COORDINATOR')
    const ctx = createMockContext(
      { userId: 'u-1', isSuperAdmin: false, isKormanit: false },
      { id: 'div-1' },
    )

    mockDb.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      })

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException)
  })

  it('should throw ForbiddenException if required role is COORDINATOR but user is MEMBER', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue('COORDINATOR')
    const ctx = createMockContext(
      { userId: 'u-1', isSuperAdmin: false, isKormanit: false },
      { id: 'div-1' },
    )

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ role: 'MEMBER', divisionId: 'div-1' }]),
      }),
    })

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException)
  })

  it('should return true if required role is COORDINATOR and user is COORDINATOR', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue('COORDINATOR')
    const ctx = createMockContext(
      { userId: 'u-1', isSuperAdmin: false, isKormanit: false },
      { id: 'div-1' },
    )

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ role: 'COORDINATOR', divisionId: 'div-1' }]),
      }),
    })

    const canActivate = await guard.canActivate(ctx)
    expect(canActivate).toBe(true)
  })
})
