import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TasksService } from './tasks.service.js'
import { TaskTransitionService } from './task-transition.service.js'

describe('TasksService', () => {
  let service: TasksService
  let mockDb: any
  let mockActivityLogsService: any
  let mockCapacityService: any
  let taskTransitionService: TaskTransitionService

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

    mockCapacityService = {
      getUserUtilization: vi.fn().mockResolvedValue({
        userId: 'user-member',
        userName: 'Member Tim',
        userEmail: 'member@moaspace.com',
        activeSp: 8,
        capacitySp: 10,
        utilizationPercentage: 80,
      }),
    }

    taskTransitionService = new TaskTransitionService()
    const mockCalendarService = {
      syncTaskEvent: vi.fn().mockResolvedValue(undefined),
    } as any
    const mockMailService = {
      sendTaskAssignedNotification: vi.fn().mockResolvedValue(undefined),
      sendTaskDeadlineReminder: vi.fn().mockResolvedValue(undefined),
    } as any
    service = new TasksService(
      mockDb,
      mockActivityLogsService,
      taskTransitionService,
      mockCapacityService,
      mockCalendarService,
      mockMailService,
    )
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

    it('should throw BadRequestException if story point is not in Fibonacci scale (e.g. 4 or 13)', async () => {
      const member = {
        userId: 'user-member',
        email: 'member@moaspace.com',
        isSuperAdmin: false,
        isKormanit: false,
      }

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: 'story-1', divisionId: 'div-1' }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ role: 'MEMBER' }]),
          }),
        })

      await expect(
        service.create(
          {
            storyId: 'story-1',
            title: 'Buat Feed IG',
            storyPoints: 4 as any,
          },
          member,
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('should throw ConflictException (409) if assignment causes member utilization > 100% without override', async () => {
      const member = {
        userId: 'user-member',
        email: 'member@moaspace.com',
        isSuperAdmin: false,
        isKormanit: false,
      }

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: 'story-1', divisionId: 'div-1' }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ role: 'MEMBER' }]),
          }),
        })

      // Current active = 8, capacity = 10, adding 5 SP -> 13/10 = 130%
      mockCapacityService.getUserUtilization.mockResolvedValueOnce({
        userId: 'user-member',
        userName: 'Member Tim',
        activeSp: 8,
        capacitySp: 10,
        utilizationPercentage: 80,
      })

      await expect(
        service.create(
          {
            storyId: 'story-1',
            title: 'Buat Feed IG Besar',
            status: 'TODO',
            assigneeId: 'user-member',
            storyPoints: 5,
          },
          member,
        ),
      ).rejects.toThrow(ConflictException)
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

  describe('update (status change goes through TaskTransitionService)', () => {
    const member = {
      userId: 'user-member',
      email: 'member@moaspace.com',
      isSuperAdmin: false,
      isKormanit: false,
    }

    const coordinator = {
      userId: 'user-coord',
      email: 'coord@moaspace.com',
      isSuperAdmin: false,
      isKormanit: false,
    }

    it('rejects a plain member moving BACKLOG -> TODO via PATCH /tasks/:id (same rule as drag-and-drop)', async () => {
      mockDb.select
        // existing task lookup
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                {
                  id: 'task-1',
                  storyId: 'story-1',
                  divisionId: 'div-1',
                  status: 'BACKLOG',
                  title: 'Desain Banner',
                  assigneeId: null,
                  storyPoints: null,
                  spLockedAt: null,
                  revisionCount: 0,
                  startedAt: null,
                },
              ]),
            }),
          }),
        })
        // membership lookup (plain MEMBER, not COORDINATOR)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ role: 'MEMBER' }]),
          }),
        })

      await expect(
        service.update('task-1', { status: 'TODO' }, member),
      ).rejects.toThrow(UnprocessableEntityException)
    })

    it('rejects moving BACKLOG -> TODO via update() when storyPoints is still empty, even for a coordinator (regression: previously bypassed validation entirely)', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                {
                  id: 'task-1',
                  storyId: 'story-1',
                  divisionId: 'div-1',
                  status: 'BACKLOG',
                  title: 'Desain Banner',
                  assigneeId: 'user-member',
                  storyPoints: null,
                  spLockedAt: null,
                  revisionCount: 0,
                  startedAt: null,
                },
              ]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ role: 'COORDINATOR' }]),
          }),
        })

      await expect(
        service.update('task-1', { status: 'TODO' }, coordinator),
      ).rejects.toThrow(
        'Estimasi Story Point (skala 1, 2, 3, 5, 8) wajib diisi sebelum memindahkan task ke To Do.',
      )
    })

    it('allows coordinator to move BACKLOG -> TODO via update() when SP & assignee are already set', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                {
                  id: 'task-1',
                  storyId: 'story-1',
                  divisionId: 'div-1',
                  status: 'BACKLOG',
                  title: 'Desain Banner',
                  assigneeId: 'user-member',
                  storyPoints: 1,
                  spLockedAt: null,
                  revisionCount: 0,
                  startedAt: null,
                },
              ]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ role: 'COORDINATOR' }]),
          }),
        })
        // checkAndUpdateStoryCompletion: all tasks
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: 'task-1', status: 'TODO' }]),
          }),
        })
        // checkAndUpdateStoryCompletion: story
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: 'story-1', closedAt: null }]),
          }),
        })

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      })

      vi.spyOn(service, 'findOne').mockResolvedValue({ id: 'task-1', status: 'TODO' } as any)

      const res = await service.update('task-1', { status: 'TODO' }, coordinator)
      expect(res.status).toBe('TODO')
      expect(mockActivityLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'TASK_STATUS_CHANGED' }),
      )
    })

    it('still enforces overcapacity when a pure status change (no assignee change) activates the workload', async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              {
                id: 'task-1',
                storyId: 'story-1',
                divisionId: 'div-1',
                status: 'BACKLOG',
                title: 'Desain Banner Besar',
                assigneeId: 'user-member',
                storyPoints: 5,
                spLockedAt: null,
                revisionCount: 0,
                startedAt: null,
              },
            ]),
          }),
        }),
      })
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ role: 'COORDINATOR' }]),
        }),
      })

      // Current active = 8, capacity = 10, adding 5 SP -> 13/10 = 130%
      mockCapacityService.getUserUtilization.mockResolvedValueOnce({
        userId: 'user-member',
        userName: 'Member Tim',
        activeSp: 8,
        capacitySp: 10,
      })

      await expect(
        service.update('task-1', { status: 'TODO' }, coordinator),
      ).rejects.toThrow(ConflictException)
    })
  })

  describe('findOne', () => {
    it('should throw NotFoundException if task does not exist', async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                leftJoin: vi.fn().mockReturnValue({
                  leftJoin: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([]),
                  }),
                }),
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

