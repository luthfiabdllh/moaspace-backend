import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UsersService } from './users.service.js'

describe('UsersService', () => {
  let usersService: UsersService
  let mockDb: any
  let mockActivityLogsService: any

  beforeEach(() => {
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn(),
    }

    mockActivityLogsService = {
      record: vi.fn().mockResolvedValue({ id: 'log-1' }),
      findByEntity: vi.fn().mockResolvedValue([]),
      findRecent: vi.fn().mockResolvedValue([]),
    }

    usersService = new UsersService(mockDb, mockActivityLogsService)
  })

  describe('create', () => {
    it('should successfully register member and generate activation token', async () => {
      // 1. Cek email tidak ada
      const mockWhereEmail = vi.fn().mockResolvedValue([])
      // 2. Cek divisi ada
      const mockWhereDiv = vi
        .fn()
        .mockResolvedValue([{ id: 'div-1', name: 'Media Kreatif' }])

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: mockWhereEmail,
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: mockWhereDiv,
          }),
        })

      mockDb.transaction.mockImplementation(async (callback: any) => {
        const tx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue([{}]),
          }),
        }
        return callback(tx)
      })

      const res = await usersService.create(
        {
          email: 'budi@moaspace.com',
          name: 'Budi Santoso',
          divisionId: 'div-1',
          role: 'MEMBER',
        },
        'admin-id',
      )

      expect(res.success).toBe(true)
      expect(res.user.email).toBe('budi@moaspace.com')
      expect(res.user.name).toBe('Budi Santoso')
      expect(res.user.status).toBe('ACTIVE')
      expect(res.activationUrl).toContain('http://localhost:3001/activate?token=')
      expect(mockActivityLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'USER',
          action: 'USER_CREATED',
          actorId: 'admin-id',
        }),
      )
    })

    it('should throw ConflictException if email is already registered', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'existing-id' }]),
        }),
      })

      await expect(
        usersService.create({
          email: 'admin@moaspace.com',
          name: 'Another Admin',
          divisionId: 'div-1',
          role: 'COORDINATOR',
        }),
      ).rejects.toThrow(ConflictException)
    })

    it('should throw NotFoundException if division does not exist', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        })

      await expect(
        usersService.create({
          email: 'new@moaspace.com',
          name: 'New Person',
          divisionId: 'nonexistent-div',
          role: 'MEMBER',
        }),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('updateStatus', () => {
    it('should prevent deactivating Super Admin or Koordinator Mahasiswa Unit account', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockResolvedValue([{ id: 'admin-id', isSuperAdmin: true, isKormanit: false }]),
        }),
      })

      await expect(
        usersService.updateStatus('admin-id', 'INACTIVE'),
      ).rejects.toThrow(BadRequestException)
    })
  })

  describe('addDivision & updateDivisionRole & moveDivision', () => {
    it('should add division for multi-division membership and record activity log', async () => {
      // 1. check user
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'user-1', name: 'Budi' }]),
        }),
      })
      // 2. check division
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'div-2', name: 'Humas' }]),
        }),
      })
      // 3. check existing membership
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      })

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue([{}]),
      })

      const res = await usersService.addDivision(
        'user-1',
        { divisionId: 'div-2', role: 'COORDINATOR' },
        'admin-id',
      )

      expect(res.success).toBe(true)
      expect(mockActivityLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DIVISION_ADDED',
          actorId: 'admin-id',
        }),
      )
    })

    it('should update division role and record activity log', async () => {
      // 1. check user
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'user-1', name: 'Budi' }]),
        }),
      })
      // 2. check membership
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              {
                id: 'm-1',
                role: 'MEMBER',
                divisionName: 'Media Kreatif',
              },
            ]),
          }),
        }),
      })

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{}]),
        }),
      })

      const res = await usersService.updateDivisionRole(
        'user-1',
        'div-1',
        { role: 'COORDINATOR' },
        'admin-id',
      )

      expect(res.success).toBe(true)
      expect(mockActivityLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ROLE_CHANGED',
          actorId: 'admin-id',
        }),
      )
    })

    it('should move member from division A to division B and record activity log', async () => {
      // 1. check user
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'user-1', name: 'Budi' }]),
        }),
      })
      // 2. check fromMembership
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              {
                id: 'm-1',
                role: 'MEMBER',
                divisionName: 'Media Kreatif',
              },
            ]),
          }),
        }),
      })
      // 3. check toDivision
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'div-2', name: 'Acara' }]),
        }),
      })
      // 4. check existing in toDivision
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      })

      mockDb.transaction.mockImplementation(async (callback: any) => {
        const tx = {
          delete: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{}]),
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue([{}]),
          }),
        }
        return callback(tx)
      })

      const res = await usersService.moveDivision(
        'user-1',
        { fromDivisionId: 'div-1', toDivisionId: 'div-2', role: 'COORDINATOR' },
        'admin-id',
      )

      expect(res.success).toBe(true)
      expect(mockActivityLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DIVISION_MOVED',
          actorId: 'admin-id',
        }),
      )
    })
  })
})
