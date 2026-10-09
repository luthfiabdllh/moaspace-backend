import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CalendarService } from './calendar.service.js'

describe('CalendarService', () => {
  let service: CalendarService
  let db: any
  let configService: any

  beforeEach(() => {
    db = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    }
    configService = {
      get: vi.fn((key: string, defaultValue?: any) => {
        if (key === 'GOOGLE_CLIENT_ID') return 'mock-client-id'
        if (key === 'GOOGLE_CLIENT_SECRET') return 'mock-client-secret'
        if (key === 'GOOGLE_CALENDAR_REDIRECT_URL') return 'http://localhost:3001/api/calendar/callback'
        return defaultValue
      }),
    }
    service = new CalendarService(db, configService)
  })

  describe('getAuthUrl', () => {
    it('returns a Google OAuth URL with calendar scope and state', () => {
      const url = service.getAuthUrl('user-123')
      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth')
      expect(url).toContain('scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar')
      expect(url).toContain('state=user-123')
      expect(url).toContain('prompt=consent')
    })
  })

  describe('getStatus', () => {
    it('returns not connected when no integration exists in DB', async () => {
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })

      const status = await service.getStatus('user-123')
      expect(status).toEqual({
        isConnected: false,
        syncEnabled: false,
        calendarName: null,
        updatedAt: null,
      })
    })

    it('returns integration status when integration exists', async () => {
      const now = new Date()
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'int-1',
                userId: 'user-123',
                calendarName: 'MoaSpace - Tim KKN',
                syncEnabled: true,
                updatedAt: now,
              },
            ]),
          }),
        }),
      })

      const status = await service.getStatus('user-123')
      expect(status).toEqual({
        isConnected: true,
        syncEnabled: true,
        calendarName: 'MoaSpace - Tim KKN',
        updatedAt: now,
      })
    })
  })
})
