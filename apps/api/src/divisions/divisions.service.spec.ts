import { ConflictException, NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DivisionsService } from './divisions.service.js'

describe('DivisionsService', () => {
  let service: DivisionsService
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
    }

    service = new DivisionsService(mockDb, mockActivityLogsService)
  })

  describe('findAll', () => {
    it('should return divisions with member count and coordinators', async () => {
      const mockDivisions = [
        {
          id: 'div-1',
          name: 'Media Kreatif',
          slug: 'media-kreatif',
          requestApprovalEnabled: true,
          createdAt: new Date(),
        },
      ]

      const mockMembers = [
        {
          divisionId: 'div-1',
          userId: 'user-1',
          role: 'COORDINATOR',
          userName: 'Budi Koordinator',
          userEmail: 'budi@moaspace.com',
          userStatus: 'ACTIVE',
        },
        {
          divisionId: 'div-1',
          userId: 'user-2',
          role: 'MEMBER',
          userName: 'Siti Anggota',
          userEmail: 'siti@moaspace.com',
          userStatus: 'ACTIVE',
        },
      ]

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockDivisions),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockResolvedValue(mockMembers),
          }),
        })

      const result = await service.findAll()
      expect(result).toHaveLength(1)
      expect(result[0]!.memberCount).toBe(2)
      expect(result[0]!.coordinators).toHaveLength(1)
      expect(result[0]!.coordinators[0]!.name).toBe('Budi Koordinator')
    })
  })

  describe('findOne', () => {
    it('should return division with members list', async () => {
      const mockDiv = {
        id: 'div-1',
        name: 'Media Kreatif',
        slug: 'media-kreatif',
        requestApprovalEnabled: false,
      }

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockDiv]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        })

      const res = await service.findOne('div-1')
      expect(res.id).toBe('div-1')
      expect(res.name).toBe('Media Kreatif')
      expect(res.members).toEqual([])
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

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      )
    })
  })

  describe('create', () => {
    it('should create new division and record audit log', async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]), // slug available
        }),
      })

      const newDiv = {
        id: 'new-div-1',
        name: 'Divisi Acara',
        slug: 'divisi-acara',
        requestApprovalEnabled: false,
      }

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([newDiv]),
        }),
      })

      const res = await service.create(
        { name: 'Divisi Acara', slug: 'divisi-acara' },
        'actor-1',
      )
      expect(res.id).toBe('new-div-1')
      expect(mockActivityLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DIVISION_CREATED',
          actorId: 'actor-1',
        }),
      )
    })

    it('should throw ConflictException if slug already exists', async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'existing-id' }]),
        }),
      })

      await expect(
        service.create({ name: 'Media Kreatif', slug: 'media-kreatif' }),
      ).rejects.toThrow(ConflictException)
    })
  })

  describe('addMember', () => {
    it('should add member and record audit log', async () => {
      mockDb.select
        // check division
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: 'div-1', name: 'Media' }]),
          }),
        })
        // check user
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: 'user-1', name: 'Budi' }]),
          }),
        })
        // check existing membership
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        })

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue([{}]),
      })

      const res = await service.addMember(
        'div-1',
        { userId: 'user-1', role: 'MEMBER' },
        'actor-1',
      )

      expect(res.success).toBe(true)
      expect(mockActivityLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DIVISION_ADDED',
        }),
      )
    })
  })
})
