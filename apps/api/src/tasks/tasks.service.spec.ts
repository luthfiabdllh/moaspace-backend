import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TasksService } from './tasks.service.js'

describe('TasksService', () => {
  let service: TasksService
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

    service = new TasksService(mockDb, mockActivityLogsService)
  })

  describe('create', () => {
    it('should throw ForbiddenException if user is not member of story division', async () => {
      const nonMember = {
        userId: 'user-outsider',
        email: 'outsider@moaspace.com',
        isSuperAdmin: false,
        isKormanit: false,
      }

      mockDb.select
        // select story
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: 'story-1', divisionId: 'div-1' }]),
          }),
        })
        // check membership
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]), // not a member
          }),
        })

      await expect(
        service.create(
          {
            storyId: 'story-1',
            title: 'Buat Feed IG',
          },
          nonMember,
        ),
      ).rejects.toThrow(ForbiddenException)
    })

    it('should allow division member to create task', async () => {
      const member = {
        userId: 'user-member',
        email: 'member@moaspace.com',
        isSuperAdmin: false,
        isKormanit: false,
      }

      mockDb.select
        // select story
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: 'story-1', divisionId: 'div-1' }]),
          }),
        })
        // check membership
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ role: 'MEMBER' }]),
          }),
        })
        // checkAndUpdateStoryCompletion: all tasks
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: 'task-1', status: 'BACKLOG' }]),
          }),
        })
        // checkAndUpdateStoryCompletion: story
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: 'story-1', closedAt: null }]),
          }),
        })

      const createdTask = {
        id: 'task-1',
        storyId: 'story-1',
        title: 'Buat Feed IG',
        status: 'BACKLOG',
      }

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdTask]),
        }),
      })

      vi.spyOn(service, 'findOne').mockResolvedValue(createdTask as any)

      const res = await service.create(
        {
          storyId: 'story-1',
          title: 'Buat Feed IG',
        },
        member,
      )

      expect(res.id).toBe('task-1')
      expect(mockActivityLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TASK_CREATED',
          entityType: 'TASK',
        }),
      )
    })
  })

  describe('findOne', () => {
    it('should throw NotFoundException if task does not exist', async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
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
