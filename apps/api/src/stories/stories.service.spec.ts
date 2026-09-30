import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StoriesService } from './stories.service.js'

describe('StoriesService', () => {
  let service: StoriesService
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

    service = new StoriesService(mockDb, mockActivityLogsService)
  })

  describe('create', () => {
    it('should throw ForbiddenException if user is not coordinator of division', async () => {
      const regularUser = {
        userId: 'user-1',
        email: 'user@moaspace.com',
        isSuperAdmin: false,
        isKormanit: false,
      }

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]), // no coordinator membership
        }),
      })

      await expect(
        service.create(
          {
            divisionId: 'div-1',
            title: 'Desain Banner',
          },
          regularUser,
        ),
      ).rejects.toThrow(ForbiddenException)
    })

    it('should allow coordinator to create story without epic', async () => {
      const coordinatorUser = {
        userId: 'user-coord',
        email: 'coord@moaspace.com',
        isSuperAdmin: false,
        isKormanit: false,
      }

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ role: 'COORDINATOR' }]),
        }),
      })

      const createdStory = {
        id: 'story-1',
        title: 'Desain Banner',
        divisionId: 'div-1',
        epicId: null,
      }

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdStory]),
        }),
      })

      vi.spyOn(service, 'findOne').mockResolvedValue(createdStory as any)

      const res = await service.create(
        {
          divisionId: 'div-1',
          title: 'Desain Banner',
        },
        coordinatorUser,
      )

      expect(res.id).toBe('story-1')
      expect(mockActivityLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'STORY_CREATED',
          entityType: 'STORY',
        }),
      )
    })
  })

  describe('findOne', () => {
    it('should throw NotFoundException if story does not exist', async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
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
