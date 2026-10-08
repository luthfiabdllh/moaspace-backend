import { describe, it, expect, beforeEach } from 'vitest'
import { UnprocessableEntityException } from '@nestjs/common'
import { TaskTransitionService, type TaskTransitionInput } from './task-transition.service.js'

describe('TaskTransitionService', () => {
  let service: TaskTransitionService

  const coordinatorActor = {
    userId: 'user-coord',
    isCoordinator: true,
    isAssignee: false,
  }

  const assigneeActor = {
    userId: 'user-assignee',
    isCoordinator: false,
    isAssignee: true,
  }

  const otherMemberActor = {
    userId: 'user-other',
    isCoordinator: false,
    isAssignee: false,
  }

  beforeEach(() => {
    service = new TaskTransitionService()
  })

  describe('BACKLOG -> TODO', () => {
    it('allows coordinator to move when assignee and storyPoints are set', () => {
      const task: TaskTransitionInput = {
        id: 'task-1',
        status: 'BACKLOG',
        assigneeId: 'user-assignee',
        storyPoints: 3,
        divisionId: 'div-1',
        revisionCount: 0,
        startedAt: null,
      }

      const res = service.validateTransition(task, 'TODO', coordinatorActor)
      expect(res.status).toBe('TODO')
    })

    it('rejects when storyPoints is NOT set', () => {
      const task: TaskTransitionInput = {
        id: 'task-1',
        status: 'BACKLOG',
        assigneeId: 'user-assignee',
        storyPoints: null,
        divisionId: 'div-1',
        revisionCount: 0,
        startedAt: null,
      }

      expect(() =>
        service.validateTransition(task, 'TODO', coordinatorActor),
      ).toThrow('Estimasi Story Point (skala 1, 2, 3, 5, 8) wajib diisi sebelum memindahkan task ke To Do.')
    })

    it('rejects when assignee is NOT set', () => {
      const task: TaskTransitionInput = {
        id: 'task-1',
        status: 'BACKLOG',
        assigneeId: null,
        storyPoints: 3,
        divisionId: 'div-1',
        revisionCount: 0,
        startedAt: null,
      }

      expect(() =>
        service.validateTransition(task, 'TODO', coordinatorActor),
      ).toThrow(UnprocessableEntityException)
    })

    it('rejects member attempting to move from BACKLOG to TODO', () => {
      const task: TaskTransitionInput = {
        id: 'task-1',
        status: 'BACKLOG',
        assigneeId: 'user-assignee',
        divisionId: 'div-1',
        revisionCount: 0,
        startedAt: null,
      }

      expect(() =>
        service.validateTransition(task, 'TODO', assigneeActor),
      ).toThrow(UnprocessableEntityException)
    })
  })

  describe('TODO -> IN_PROGRESS', () => {
    it('allows assignee to start task and records startedAt', () => {
      const task: TaskTransitionInput = {
        id: 'task-1',
        status: 'TODO',
        assigneeId: 'user-assignee',
        divisionId: 'div-1',
        revisionCount: 0,
        startedAt: null,
      }

      const res = service.validateTransition(task, 'IN_PROGRESS', assigneeActor)
      expect(res.status).toBe('IN_PROGRESS')
      expect(res.startedAt).toBeDefined()
      expect(res.spLockedAt).toBeDefined()
    })

    it('rejects another member from starting someone elses task', () => {
      const task: TaskTransitionInput = {
        id: 'task-1',
        status: 'TODO',
        assigneeId: 'user-assignee',
        divisionId: 'div-1',
        revisionCount: 0,
        startedAt: null,
      }

      expect(() =>
        service.validateTransition(task, 'IN_PROGRESS', otherMemberActor),
      ).toThrow(UnprocessableEntityException)
    })
  })

  describe('IN_PROGRESS -> REVIEW', () => {
    it('allows assignee to submit task to review', () => {
      const task: TaskTransitionInput = {
        id: 'task-1',
        status: 'IN_PROGRESS',
        assigneeId: 'user-assignee',
        divisionId: 'div-1',
        revisionCount: 0,
        startedAt: new Date(),
      }

      const res = service.validateTransition(task, 'REVIEW', assigneeActor)
      expect(res.status).toBe('REVIEW')
    })
  })

  describe('REVIEW -> DONE', () => {
    it('allows coordinator to approve task and sets completedAt', () => {
      const task: TaskTransitionInput = {
        id: 'task-1',
        status: 'REVIEW',
        assigneeId: 'user-assignee',
        divisionId: 'div-1',
        revisionCount: 0,
        startedAt: new Date(),
      }

      const res = service.validateTransition(task, 'DONE', coordinatorActor)
      expect(res.status).toBe('DONE')
      expect(res.completedAt).toBeDefined()
    })

    it('rejects assignee trying to self-approve to DONE', () => {
      const task: TaskTransitionInput = {
        id: 'task-1',
        status: 'REVIEW',
        assigneeId: 'user-assignee',
        divisionId: 'div-1',
        revisionCount: 0,
        startedAt: new Date(),
      }

      expect(() =>
        service.validateTransition(task, 'DONE', assigneeActor),
      ).toThrow(UnprocessableEntityException)
    })
  })

  describe('REVIEW -> IN_PROGRESS (Revision)', () => {
    it('increments revisionCount when coordinator requests changes', () => {
      const task: TaskTransitionInput = {
        id: 'task-1',
        status: 'REVIEW',
        assigneeId: 'user-assignee',
        divisionId: 'div-1',
        revisionCount: 1,
        startedAt: new Date(),
      }

      const res = service.validateTransition(task, 'IN_PROGRESS', coordinatorActor)
      expect(res.status).toBe('IN_PROGRESS')
      expect(res.revisionCount).toBe(2)
    })
  })

  describe('Coordinator backward moves (Transisi G)', () => {
    it('allows coordinator to send TODO back to BACKLOG', () => {
      const task: TaskTransitionInput = {
        id: 'task-1',
        status: 'TODO',
        assigneeId: 'user-assignee',
        divisionId: 'div-1',
        revisionCount: 0,
        startedAt: null,
      }

      const res = service.validateTransition(task, 'BACKLOG', coordinatorActor)
      expect(res.status).toBe('BACKLOG')
    })

    it('allows coordinator to send IN_PROGRESS back to TODO', () => {
      const task: TaskTransitionInput = {
        id: 'task-1',
        status: 'IN_PROGRESS',
        assigneeId: 'user-assignee',
        divisionId: 'div-1',
        revisionCount: 0,
        startedAt: new Date(),
      }

      const res = service.validateTransition(task, 'TODO', coordinatorActor)
      expect(res.status).toBe('TODO')
    })

    it('allows coordinator to send IN_PROGRESS directly back to BACKLOG (previously unreachable)', () => {
      const task: TaskTransitionInput = {
        id: 'task-1',
        status: 'IN_PROGRESS',
        assigneeId: 'user-assignee',
        divisionId: 'div-1',
        revisionCount: 0,
        startedAt: new Date(),
      }

      const res = service.validateTransition(task, 'BACKLOG', coordinatorActor)
      expect(res.status).toBe('BACKLOG')
    })

    it('allows coordinator to send REVIEW directly back to TODO', () => {
      const task: TaskTransitionInput = {
        id: 'task-1',
        status: 'REVIEW',
        assigneeId: 'user-assignee',
        divisionId: 'div-1',
        revisionCount: 0,
        startedAt: new Date(),
      }

      const res = service.validateTransition(task, 'TODO', coordinatorActor)
      expect(res.status).toBe('TODO')
    })

    it('allows coordinator to send REVIEW directly back to BACKLOG', () => {
      const task: TaskTransitionInput = {
        id: 'task-1',
        status: 'REVIEW',
        assigneeId: 'user-assignee',
        divisionId: 'div-1',
        revisionCount: 0,
        startedAt: new Date(),
      }

      const res = service.validateTransition(task, 'BACKLOG', coordinatorActor)
      expect(res.status).toBe('BACKLOG')
    })

    it('still routes REVIEW -> IN_PROGRESS through the revision-specific rule (revisionCount increments)', () => {
      const task: TaskTransitionInput = {
        id: 'task-1',
        status: 'REVIEW',
        assigneeId: 'user-assignee',
        divisionId: 'div-1',
        revisionCount: 0,
        startedAt: new Date(),
      }

      const res = service.validateTransition(task, 'IN_PROGRESS', coordinatorActor)
      expect(res.status).toBe('IN_PROGRESS')
      expect(res.revisionCount).toBe(1)
    })

    it('rejects a non-coordinator member from moving IN_PROGRESS back to BACKLOG', () => {
      const task: TaskTransitionInput = {
        id: 'task-1',
        status: 'IN_PROGRESS',
        assigneeId: 'user-assignee',
        divisionId: 'div-1',
        revisionCount: 0,
        startedAt: new Date(),
      }

      expect(() =>
        service.validateTransition(task, 'BACKLOG', assigneeActor),
      ).toThrow(UnprocessableEntityException)
    })
  })

  describe('Coordinator forward shortcuts (Transisi H)', () => {
    it('allows coordinator to jump BACKLOG directly to IN_PROGRESS and sets startedAt/spLockedAt', () => {
      const task: TaskTransitionInput = {
        id: 'task-1',
        status: 'BACKLOG',
        assigneeId: 'user-assignee',
        storyPoints: 5,
        divisionId: 'div-1',
        revisionCount: 0,
        startedAt: null,
      }

      const res = service.validateTransition(task, 'IN_PROGRESS', coordinatorActor)
      expect(res.status).toBe('IN_PROGRESS')
      expect(res.startedAt).toBeDefined()
      expect(res.spLockedAt).toBeDefined()
    })

    it('allows coordinator to jump BACKLOG directly to DONE and sets completedAt + startedAt', () => {
      const task: TaskTransitionInput = {
        id: 'task-1',
        status: 'BACKLOG',
        assigneeId: 'user-assignee',
        storyPoints: 5,
        divisionId: 'div-1',
        revisionCount: 0,
        startedAt: null,
      }

      const res = service.validateTransition(task, 'DONE', coordinatorActor)
      expect(res.status).toBe('DONE')
      expect(res.completedAt).toBeDefined()
      expect(res.startedAt).toBeDefined()
    })

    it('allows coordinator to jump TODO directly to DONE', () => {
      const task: TaskTransitionInput = {
        id: 'task-1',
        status: 'TODO',
        assigneeId: 'user-assignee',
        storyPoints: 3,
        divisionId: 'div-1',
        revisionCount: 0,
        startedAt: null,
      }

      const res = service.validateTransition(task, 'DONE', coordinatorActor)
      expect(res.status).toBe('DONE')
      expect(res.completedAt).toBeDefined()
    })

    it('rejects jump into/past TODO when storyPoints is not set, even for coordinator', () => {
      const task: TaskTransitionInput = {
        id: 'task-1',
        status: 'BACKLOG',
        assigneeId: 'user-assignee',
        storyPoints: null,
        divisionId: 'div-1',
        revisionCount: 0,
        startedAt: null,
      }

      expect(() =>
        service.validateTransition(task, 'IN_PROGRESS', coordinatorActor),
      ).toThrow('Estimasi Story Point (skala 1, 2, 3, 5, 8) wajib diisi sebelum memindahkan task melewati To Do.')
    })

    it('rejects jump into/past TODO when assignee is not set, even for coordinator', () => {
      const task: TaskTransitionInput = {
        id: 'task-1',
        status: 'BACKLOG',
        assigneeId: null,
        storyPoints: 5,
        divisionId: 'div-1',
        revisionCount: 0,
        startedAt: null,
      }

      expect(() =>
        service.validateTransition(task, 'REVIEW', coordinatorActor),
      ).toThrow(UnprocessableEntityException)
    })

    it('rejects a non-coordinator member from jumping BACKLOG directly to IN_PROGRESS', () => {
      const task: TaskTransitionInput = {
        id: 'task-1',
        status: 'BACKLOG',
        assigneeId: 'user-assignee',
        storyPoints: 5,
        divisionId: 'div-1',
        revisionCount: 0,
        startedAt: null,
      }

      expect(() =>
        service.validateTransition(task, 'IN_PROGRESS', assigneeActor),
      ).toThrow(UnprocessableEntityException)
    })
  })

  describe('Illegal shortcut', () => {
    it('rejects non-coordinator jump from BACKLOG directly to DONE', () => {
      const task: TaskTransitionInput = {
        id: 'task-1',
        status: 'BACKLOG',
        assigneeId: 'user-assignee',
        divisionId: 'div-1',
        revisionCount: 0,
        startedAt: null,
      }

      expect(() =>
        service.validateTransition(task, 'DONE', assigneeActor),
      ).toThrow(UnprocessableEntityException)
    })
  })
})
