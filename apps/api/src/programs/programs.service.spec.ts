import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProgramsService } from './programs.service.js'

describe('ProgramsService', () => {
  let service: ProgramsService
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

    service = new ProgramsService(mockDb, mockActivityLogsService)
  })

  describe('create', () => {
    it('harus melempar BadRequestException jika scope SUBUNIT tanpa subunitId', async () => {
      await expect(
        service.create(
          {
            title: 'Program Tanpa Subunit',
            scope: 'SUBUNIT',
            cluster: 'SAINTEK',
            primaryPicId: 'user-1',
          },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('harus melempar BadRequestException jika PIC Utama tidak aktif (INACTIVE)', async () => {
      // Check subunit
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: 'sub-1', name: 'Posko 1' }]),
            }),
          }),
        })
        // Check primaryPic
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: 'user-inactive', name: 'Mhs Nonaktif', status: 'INACTIVE' },
              ]),
            }),
          }),
        })

      await expect(
        service.create(
          {
            title: 'Program Kerja Keren',
            scope: 'SUBUNIT',
            subunitId: 'sub-1',
            cluster: 'SAINTEK',
            primaryPicId: 'user-inactive',
          },
          'user-admin',
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('harus berhasil membuat proker baru dengan status PROPOSED', async () => {
      mockDb.select
        // Subunit check
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: 'sub-1', name: 'Posko 1' }]),
            }),
          }),
        })
        // Primary PIC check
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: 'user-active', name: 'Mhs Aktif', status: 'ACTIVE' },
              ]),
            }),
          }),
        })

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      })

      // Mock findOne (which calls findAll and epics query)
      vi.spyOn(service, 'findOne').mockResolvedValue({
        id: 'prog-1',
        title: 'Program Kerja Keren',
        status: 'PROPOSED',
        clusterApprovalStatus: 'PENDING',
        governanceApprovalStatus: 'PENDING',
      } as any)

      const result = await service.create(
        {
          title: 'Program Kerja Keren',
          scope: 'SUBUNIT',
          subunitId: 'sub-1',
          cluster: 'SAINTEK',
          primaryPicId: 'user-active',
        },
        'user-admin',
      )

      expect(result.id).toBe('prog-1')
      expect(result.status).toBe('PROPOSED')
      expect(mockActivityLogsService.record).toHaveBeenCalled()
    })
  })

  describe('reviewCluster', () => {
    it('harus menolak jika reviewer bukan Kormater klaster bersangkutan dan bukan Super Admin', async () => {
      // Program check
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: 'prog-1',
                  cluster: 'SAINTEK',
                  clusterApprovalStatus: 'PENDING',
                },
              ]),
            }),
          }),
        })
        // Reviewer user check (Kormater SOSHUM mencoba mereview program SAINTEK)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: 'user-soshum',
                  cluster: 'SOSHUM',
                  isClusterCoordinator: true,
                },
              ]),
            }),
          }),
        })

      await expect(
        service.reviewCluster(
          'prog-1',
          { decision: 'APPROVED' },
          'user-soshum',
          false, // bukan super admin
        ),
      ).rejects.toThrow(ForbiddenException)
    })

    it('harus mengubah status menjadi ACTIVE jika disetujui Kormater dan governance sudah APPROVED', async () => {
      mockDb.select
        // Program check
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: 'prog-1',
                  cluster: 'SAINTEK',
                  status: 'PROPOSED',
                  clusterApprovalStatus: 'PENDING',
                  governanceApprovalStatus: 'APPROVED',
                },
              ]),
            }),
          }),
        })
        // Reviewer user check (Kormater SAINTEK)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: 'user-saintek-coord',
                  cluster: 'SAINTEK',
                  isClusterCoordinator: true,
                },
              ]),
            }),
          }),
        })

      const updateSetMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      })
      mockDb.update.mockReturnValue({ set: updateSetMock })

      vi.spyOn(service, 'findOne').mockResolvedValue({
        id: 'prog-1',
        status: 'ACTIVE',
        clusterApprovalStatus: 'APPROVED',
        governanceApprovalStatus: 'APPROVED',
      } as any)

      const result = await service.reviewCluster(
        'prog-1',
        { decision: 'APPROVED' },
        'user-saintek-coord',
        false,
      )

      expect(result.status).toBe('ACTIVE')
      expect(updateSetMock).toHaveBeenCalledWith(
        expect.objectContaining({
          clusterApprovalStatus: 'APPROVED',
          status: 'ACTIVE',
        }),
      )
    })
  })

  describe('reviewGovernance', () => {
    it('harus menolak jika reviewer bukan Kormasit posko terkait dan bukan Super Admin', async () => {
      // Program check
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: 'prog-1',
                  scope: 'SUBUNIT',
                  subunitId: 'sub-1',
                },
              ]),
            }),
          }),
        })
        // Check Kormasit membership di subunit
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]), // Bukan koordinator posko sub-1
            }),
          }),
        })

      await expect(
        service.reviewGovernance(
          'prog-1',
          { decision: 'APPROVED' },
          'user-random',
          false,
        ),
      ).rejects.toThrow(ForbiddenException)
    })
  })
})
