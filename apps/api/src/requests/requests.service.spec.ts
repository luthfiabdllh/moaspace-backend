import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RequestsService } from './requests.service.js'
import { BadRequestException } from '@nestjs/common'
import type { RequestUser } from '../common/decorators/current-user.decorator.js'

describe('RequestsService', () => {
  let service: RequestsService
  let db: any
  let activityLogsService: any

  const mockUser: RequestUser = {
    userId: 'user-1',
    email: 'user@moaspace.com',
    isSuperAdmin: false,
    isKormanit: false,
  }

  const mockSuperUser: RequestUser = {
    userId: 'admin-1',
    email: 'admin@moaspace.com',
    isSuperAdmin: true,
    isKormanit: false,
  }

  beforeEach(() => {
    db = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    }
    activityLogsService = {
      record: vi.fn().mockResolvedValue(undefined),
    }
    service = new RequestsService(db, activityLogsService)
  })

  describe('createRequest', () => {
    it('throws BadRequestException if fromDivisionId equals toDivisionId', async () => {
      await expect(
        service.createRequest(
          {
            fromDivisionId: 'div-1',
            toDivisionId: 'div-1',
            title: 'Design Logo',
            brief: { note: 'test' },
          },
          mockUser,
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('sets initial status to WAITING_ORIGIN_APPROVAL if approval is enabled in origin division', async () => {
      // Mock assertMember -> return membership
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([{ id: 'mem-1' }]),
        }),
      })

      // Mock fromDivision lookup
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            { id: 'div-1', name: 'Sponsorship', requestApprovalEnabled: true },
          ]),
        }),
      })

      // Mock toDivision lookup
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            { id: 'div-2', name: 'Media Kreatif' },
          ]),
        }),
      })

      // Mock insert request
      const createdRequest = {
        id: 'req-1',
        fromDivisionId: 'div-1',
        toDivisionId: 'div-2',
        title: 'Poster Expo',
        status: 'WAITING_ORIGIN_APPROVAL',
      }
      db.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([createdRequest]),
        }),
      })

      // Mock insert event
      db.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValueOnce([{ id: 'ev-1' }]),
      })

      const result = await service.createRequest(
        {
          fromDivisionId: 'div-1',
          toDivisionId: 'div-2',
          title: 'Poster Expo',
          brief: { size: 'A3' },
        },
        mockUser,
      )

      expect(result?.status).toBe('WAITING_ORIGIN_APPROVAL')
      expect(activityLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'REQUEST_CREATED',
        }),
      )
    })

    it('sets initial status to SUBMITTED if approval is disabled in origin division', async () => {
      // Mock assertMember
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([{ id: 'mem-1' }]),
        }),
      })

      // Mock fromDivision lookup (approval disabled)
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            { id: 'div-1', name: 'Sponsorship', requestApprovalEnabled: false },
          ]),
        }),
      })

      // Mock toDivision lookup
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            { id: 'div-2', name: 'Media Kreatif' },
          ]),
        }),
      })

      // Mock insert request
      const createdRequest = {
        id: 'req-2',
        fromDivisionId: 'div-1',
        toDivisionId: 'div-2',
        title: 'Poster Expo',
        status: 'SUBMITTED',
      }
      db.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([createdRequest]),
        }),
      })

      // Mock insert event
      db.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValueOnce([{ id: 'ev-2' }]),
      })

      const result = await service.createRequest(
        {
          fromDivisionId: 'div-1',
          toDivisionId: 'div-2',
          title: 'Poster Expo',
          brief: { size: 'A3' },
        },
        mockUser,
      )

      expect(result?.status).toBe('SUBMITTED')
    })
  })

  describe('approveOrigin', () => {
    it('throws if request is not WAITING_ORIGIN_APPROVAL', async () => {
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([{ id: 'req-1', status: 'SUBMITTED' }]),
        }),
      })

      await expect(
        service.approveOrigin('req-1', { action: 'APPROVE' }, mockSuperUser),
      ).rejects.toThrow(BadRequestException)
    })

    it('approves request and changes status to SUBMITTED', async () => {
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            {
              id: 'req-1',
              fromDivisionId: 'div-1',
              status: 'WAITING_ORIGIN_APPROVAL',
            },
          ]),
        }),
      })

      db.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockResolvedValueOnce([
              { id: 'req-1', status: 'SUBMITTED' },
            ]),
          }),
        }),
      })

      db.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValueOnce([]),
      })

      const result = await service.approveOrigin(
        'req-1',
        { action: 'APPROVE' },
        mockSuperUser,
      )
      expect(result?.status).toBe('SUBMITTED')
      expect(activityLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ORIGIN_APPROVED',
        }),
      )
    })
  })

  describe('triage', () => {
    it('rejects without reason', async () => {
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            { id: 'req-1', toDivisionId: 'div-2', status: 'SUBMITTED' },
          ]),
        }),
      })

      await expect(
        service.triage('req-1', { action: 'REJECT' }, mockSuperUser),
      ).rejects.toThrow(BadRequestException)
    })

    it('accepts request and changes status to ACCEPTED', async () => {
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            { id: 'req-1', toDivisionId: 'div-2', status: 'SUBMITTED' },
          ]),
        }),
      })

      db.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockResolvedValueOnce([
              { id: 'req-1', status: 'ACCEPTED' },
            ]),
          }),
        }),
      })

      db.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValueOnce([]),
      })

      const result = await service.triage('req-1', { action: 'ACCEPT' }, mockSuperUser)
      expect(result?.status).toBe('ACCEPTED')
      expect(activityLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TRIAGE_ACCEPT',
        }),
      )
    })
  })

  describe('convertToStory', () => {
    it('creates story in target division and moves status to IN_PROGRESS', async () => {
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            {
              id: 'req-1',
              toDivisionId: 'div-2',
              title: 'Desain Banner',
              status: 'ACCEPTED',
              deadline: new Date('2026-10-10'),
            },
          ]),
        }),
      })

      // Insert story
      db.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([
            { id: 'story-new', title: 'Desain Banner' },
          ]),
        }),
      })

      // Update request
      db.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockResolvedValueOnce([
              { id: 'req-1', linkedStoryId: 'story-new', status: 'IN_PROGRESS' },
            ]),
          }),
        }),
      })

      // Insert event
      db.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValueOnce([]),
      })

      const result = await service.convertToStory('req-1', {}, mockSuperUser)
      expect(result?.story?.id).toBe('story-new')
      expect(result?.request?.status).toBe('IN_PROGRESS')
      expect(activityLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CONVERTED_TO_STORY',
        }),
      )
    })
  })

  describe('deliver', () => {
    it('throws if tasks on linked story are not all DONE', async () => {
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            {
              id: 'req-1',
              toDivisionId: 'div-2',
              linkedStoryId: 'story-1',
              status: 'IN_PROGRESS',
            },
          ]),
        }),
      })

      // Tasks lookup
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            { id: 'task-1', status: 'DONE' },
            { id: 'task-2', status: 'IN_PROGRESS' },
          ]),
        }),
      })

      await expect(
        service.deliver(
          'req-1',
          {
            deliveryNotes: 'Selesai',
            deliveryAttachments: [{ title: 'Link', url: 'https://gdrive/file' }],
          },
          mockSuperUser,
        ),
      ).rejects.toThrow(BadRequestException)
    })
  })

  describe('confirm', () => {
    it('throws if REVISION action has no meaningful reason (empty HTML tag)', async () => {
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            {
              id: 'req-1',
              fromDivisionId: 'div-1',
              requesterId: mockSuperUser.userId,
              linkedStoryId: 'story-1',
              status: 'DELIVERED',
            },
          ]),
        }),
      })

      // isDivisionCoordinator lookup (fromDivisionId)
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([]),
        }),
      })

      await expect(
        service.confirm(
          'req-1',
          { action: 'REVISION', reason: '<p></p>' },
          mockSuperUser,
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('accepts REVISION with meaningful HTML reason and does not reset tasks', async () => {
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            {
              id: 'req-1',
              fromDivisionId: 'div-1',
              requesterId: mockSuperUser.userId,
              linkedStoryId: 'story-1',
              status: 'DELIVERED',
            },
          ]),
        }),
      })

      // isDivisionCoordinator lookup (fromDivisionId)
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([]),
        }),
      })

      db.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockResolvedValueOnce([
              { id: 'req-1', status: 'REVISION' },
            ]),
          }),
        }),
      })

      db.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValueOnce([]),
      })

      const result = await service.confirm(
        'req-1',
        { action: 'REVISION', reason: '<p>Warna kurang kontras</p>' },
        mockSuperUser,
      )

      expect(result?.status).toBe('REVISION')
      // Hanya 1x update dipanggil (status request), task TIDAK direset otomatis.
      expect(db.update).toHaveBeenCalledTimes(1)
      expect(activityLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'REQUEST_REVISION' }),
      )
    })
  })

  describe('startRevision', () => {
    it('throws if request is not in REVISION status', async () => {
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            { id: 'req-1', toDivisionId: 'div-2', status: 'DELIVERED' },
          ]),
        }),
      })

      await expect(
        service.startRevision('req-1', mockSuperUser),
      ).rejects.toThrow(BadRequestException)
    })

    it('moves request from REVISION to IN_PROGRESS and logs the event', async () => {
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            { id: 'req-1', toDivisionId: 'div-2', status: 'REVISION' },
          ]),
        }),
      })

      db.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockResolvedValueOnce([
              { id: 'req-1', status: 'IN_PROGRESS' },
            ]),
          }),
        }),
      })

      db.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValueOnce([]),
      })

      const result = await service.startRevision('req-1', mockSuperUser)

      expect(result?.status).toBe('IN_PROGRESS')
      expect(activityLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'REQUEST_REVISION_STARTED' }),
      )
    })
  })

  describe('draft lifecycle', () => {
    it('creates request with status DRAFT when isDraft is true', async () => {
      // Mock assertMember -> return membership
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([{ id: 'mem-1' }]),
        }),
      })

      // Mock fromDivision lookup
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            { id: 'div-1', name: 'Sponsorship', requestApprovalEnabled: true },
          ]),
        }),
      })

      // Mock toDivision lookup
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            { id: 'div-2', name: 'Media Kreatif' },
          ]),
        }),
      })

      // Mock insert request
      const createdDraft = {
        id: 'req-draft-1',
        fromDivisionId: 'div-1',
        toDivisionId: 'div-2',
        title: 'Draft Poster',
        status: 'DRAFT',
      }
      db.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([createdDraft]),
        }),
      })

      // Mock insert event
      db.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValueOnce([{ id: 'ev-1' }]),
      })

      const result = await service.createRequest(
        {
          fromDivisionId: 'div-1',
          toDivisionId: 'div-2',
          title: 'Draft Poster',
          brief: { note: 'draft' },
          isDraft: true,
        },
        mockUser,
      )

      expect(result?.status).toBe('DRAFT')
    })

    it('submits a draft request and transitions to SUBMITTED or WAITING_ORIGIN_APPROVAL', async () => {
      // Mock 1: getRequestOrThrow
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            {
              id: 'req-draft-1',
              fromDivisionId: 'div-1',
              requesterId: mockUser.userId,
              status: 'DRAFT',
            },
          ]),
        }),
      })

      // Mock 2: fromDivision lookup
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            { requestApprovalEnabled: false },
          ]),
        }),
      })

      // Mock update
      db.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockResolvedValueOnce([
              { id: 'req-draft-1', status: 'SUBMITTED' },
            ]),
          }),
        }),
      })

      // Mock insert event
      db.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValueOnce([{ id: 'ev-sub' }]),
      })

      const res = await service.submitDraft('req-draft-1', mockUser)
      expect(res?.status).toBe('SUBMITTED')
    })
  })
})
