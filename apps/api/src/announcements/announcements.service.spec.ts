import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ForbiddenException, BadRequestException } from '@nestjs/common'
import { AnnouncementsService } from './announcements.service.js'
import { AnnouncementCategory, AnnouncementTarget } from './dto/create-announcement.dto.js'

describe('AnnouncementsService', () => {
  let service: AnnouncementsService
  let db: any
  let activityLogsService: any
  let calendarService: any

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
    calendarService = {
      syncAnnouncementEvent: vi.fn().mockResolvedValue(undefined),
    }
    const mailService = {
      sendAnnouncementNotification: vi.fn().mockResolvedValue(undefined),
    }
    service = new AnnouncementsService(db, activityLogsService, calendarService, mailService as any)
  })

  describe('canManageAnnouncements', () => {
    it('returns true for Super Admin', async () => {
      const user = { userId: 'admin-1', isSuperAdmin: true, isKormanit: false } as any
      const result = await service.canManageAnnouncements(user)
      expect(result).toBe(true)
    })

    it('returns true for Kormanit', async () => {
      const user = { userId: 'kormanit-1', isSuperAdmin: false, isKormanit: true } as any
      const result = await service.canManageAnnouncements(user)
      expect(result).toBe(true)
    })

    it('returns true for PSDM division member', async () => {
      const user = { userId: 'psdm-1', isSuperAdmin: false, isKormanit: false } as any
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ divisionId: 'div-psdm', role: 'MEMBER', slug: 'psdm' }]),
          }),
        }),
      })

      const result = await service.canManageAnnouncements(user)
      expect(result).toBe(true)
    })

    it('returns true for division coordinator (role === COORDINATOR)', async () => {
      const user = { userId: 'coord-1', isSuperAdmin: false, isKormanit: false } as any
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ divisionId: 'div-medkref', role: 'COORDINATOR', slug: 'media-kreatif' }]),
          }),
        }),
      })

      const result = await service.canManageAnnouncements(user)
      expect(result).toBe(true)
    })

    it('returns false for regular member of non-PSDM division', async () => {
      const user = { userId: 'media-1', isSuperAdmin: false, isKormanit: false } as any
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ divisionId: 'div-medkref', role: 'MEMBER', slug: 'media-kreatif' }]),
          }),
        }),
      })

      const result = await service.canManageAnnouncements(user)
      expect(result).toBe(false)
    })
  })

  describe('create', () => {
    it('throws ForbiddenException if user is not authorized to create announcement', async () => {
      const user = { userId: 'media-1', isSuperAdmin: false, isKormanit: false } as any
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ divisionId: 'div-medkref', role: 'MEMBER', slug: 'media-kreatif' }]),
          }),
        }),
      })

      await expect(
        service.create(
          {
            title: 'Test',
            content: { type: 'doc' },
            category: AnnouncementCategory.INFO,
            targetType: AnnouncementTarget.ALL,
          },
          user,
        ),
      ).rejects.toThrow(ForbiddenException)
    })

    it('throws ForbiddenException if division coordinator tries to target ALL', async () => {
      const user = { userId: 'coord-1', isSuperAdmin: false, isKormanit: false } as any
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ divisionId: 'div-medkref', role: 'COORDINATOR', slug: 'media-kreatif' }]),
          }),
        }),
      })

      await expect(
        service.create(
          {
            title: 'Pengumuman Media',
            content: { html: '<p>Halo</p>' },
            category: AnnouncementCategory.INFO,
            targetType: AnnouncementTarget.ALL,
          },
          user,
        ),
      ).rejects.toThrow(ForbiddenException)
    })

    it('throws ForbiddenException if division coordinator tries to target another division', async () => {
      const user = { userId: 'coord-1', isSuperAdmin: false, isKormanit: false } as any
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ divisionId: 'div-medkref', role: 'COORDINATOR', slug: 'media-kreatif' }]),
          }),
        }),
      })

      await expect(
        service.create(
          {
            title: 'Pengumuman Acara',
            content: { html: '<p>Halo</p>' },
            category: AnnouncementCategory.INFO,
            targetType: AnnouncementTarget.DIVISION,
            targetDivisionId: 'div-acara',
          },
          user,
        ),
      ).rejects.toThrow(ForbiddenException)
    })

    it('throws BadRequestException if eventEndDate is before eventStartDate', async () => {
      const user = { userId: 'admin-1', isSuperAdmin: true, isKormanit: false } as any

      await expect(
        service.create(
          {
            title: 'Test',
            content: { type: 'doc' },
            category: AnnouncementCategory.MEETING,
            targetType: AnnouncementTarget.ALL,
            eventStartDate: '2026-10-15T14:00:00Z',
            eventEndDate: '2026-10-15T12:00:00Z',
          },
          user,
        ),
      ).rejects.toThrow(BadRequestException)
    })
  })
})
