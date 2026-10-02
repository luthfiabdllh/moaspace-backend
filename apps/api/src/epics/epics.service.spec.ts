import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EpicsService } from './epics.service.js'

describe('EpicsService', () => {
  let service: EpicsService
  let mockDb: any
  let mockActivityLogsService: any

  beforeEach(() => {
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    }

    mockActivityLogsService = {
      record: vi.fn().mockResolvedValue({ id: 'log-1' }),
      findByEntity: vi.fn().mockResolvedValue([]),
    }

    service = new EpicsService(mockDb, mockActivityLogsService)
  })

  describe('create', () => {
    it('should throw ForbiddenException if non-admin tries to create CROSS epic', async () => {
      const regularUser = {
        userId: 'user-1',
        email: 'user@moaspace.com',
        isSuperAdmin: false,
        isKormanit: false,
      }

      await expect(
        service.create(
          {
            title: 'Cross Epic',
            scope: 'CROSS',
          },
          regularUser,
        ),
      ).rejects.toThrow(ForbiddenException)
    })

    it('should allow super admin to create CROSS epic with participating divisions', async () => {
      const adminUser = {
        userId: 'admin-1',
        email: 'admin@moaspace.com',
        isSuperAdmin: true,
        isKormanit: false,
      }

      const createdEpic = {
        id: 'epic-1',
        title: 'Program Digitalisasi Desa',
        scope: 'CROSS',
        ownerDivisionId: null,
      }

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdEpic]),
        }),
      })

      // mock findOne
      vi.spyOn(service, 'findOne').mockResolvedValue(createdEpic as any)

      const res = await service.create(
        {
          title: 'Program Digitalisasi Desa',
          scope: 'CROSS',
          participatingDivisionIds: ['div-1', 'div-2'],
        },
        adminUser,
      )

      expect(res.id).toBe('epic-1')
      expect(mockActivityLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'EPIC_CREATED',
          entityType: 'EPIC',
        }),
      )
    })
  })

  describe('findOne', () => {
    it('should throw NotFoundException if epic does not exist', async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      })

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      )
    })
  })
})
