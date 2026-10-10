import { BadRequestException, ConflictException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SubunitsService } from './subunits.service.js'

describe('SubunitsService', () => {
  let service: SubunitsService
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

    service = new SubunitsService(mockDb, mockActivityLogsService)
  })

  describe('findAll', () => {
    it('harus mengembalikan subunit beserta jumlah anggota dan kormasit', async () => {
      const mockSubunits = [
        {
          id: 'sub-1',
          name: 'Subunit 1 - Dusun Karangrejo',
          slug: 'subunit-1-dusun-karangrejo',
          location: 'Balai Dusun Karangrejo',
          description: 'Fokus UMKM',
          createdAt: new Date(),
        },
      ]

      const mockMembers = [
        {
          subunitId: 'sub-1',
          userId: 'user-1',
          role: 'COORDINATOR',
          userName: 'Budi Kormasit',
          userEmail: 'budi@moaspace.com',
          userCluster: 'SAINTEK',
          isClusterCoordinator: false,
          userStatus: 'ACTIVE',
        },
        {
          subunitId: 'sub-1',
          userId: 'user-2',
          role: 'MEMBER',
          userName: 'Siti Anggota',
          userEmail: 'siti@moaspace.com',
          userCluster: 'SOSHUM',
          isClusterCoordinator: false,
          userStatus: 'ACTIVE',
        },
      ]

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockSubunits),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockMembers),
            }),
          }),
        })

      const result = await service.findAll()

      expect(result).toHaveLength(1)
      expect(result[0]!.memberCount).toBe(2)
      expect(result[0]!.coordinators).toHaveLength(1)
      expect(result[0]!.coordinators[0]!.name).toBe('Budi Kormasit')
    })
  })

  describe('create', () => {
    it('harus membuat subunit baru jika slug belum ada', async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      })

      const newSubunit = {
        id: 'sub-new',
        name: 'Subunit 2 - Sukamaju',
        slug: 'subunit-2-sukamaju',
        location: 'Posko 2',
        description: null,
      }

      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([newSubunit]),
        }),
      })

      const result = await service.create({
        name: 'Subunit 2 - Sukamaju',
        location: 'Posko 2',
      })

      expect(result.id).toBe('sub-new')
      expect(mockActivityLogsService.record).toHaveBeenCalled()
    })

    it('harus throw ConflictException jika slug sudah dipakai', async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'sub-existing' }]),
        }),
      })

      await expect(
        service.create({ name: 'Subunit Duplicate', slug: 'sub-dup' }),
      ).rejects.toThrow(ConflictException)
    })
  })

  describe('addMember', () => {
    it('harus menolak jika mahasiswa sudah terdaftar di subunit lain (1 mahasiswa = 1 subunit)', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: 'sub-1', name: 'Subunit 1' }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: 'user-1', name: 'Andi', status: 'ACTIVE' }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                { id: 'sub-mem-1', subunitId: 'sub-2', subunitName: 'Subunit 2' },
              ]),
            }),
          }),
        })

      await expect(
        service.addMember('sub-1', { userId: 'user-1', role: 'MEMBER' }),
      ).rejects.toThrow(ConflictException)
    })

    it('harus menolak jika akun mahasiswa berstatus INACTIVE', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: 'sub-1', name: 'Subunit 1' }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: 'user-1', name: 'Andi', status: 'INACTIVE' }]),
          }),
        })

      await expect(
        service.addMember('sub-1', { userId: 'user-1', role: 'MEMBER' }),
      ).rejects.toThrow(BadRequestException)
    })
  })
})
