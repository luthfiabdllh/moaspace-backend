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
    it('allows coordinator to move when assignee is set', () => {
      const task: TaskTransitionInput = {
        id: 'task-1',
        status: 'BACKLOG',
        assigneeId: 'user-assignee',
        divisionId: 'div-1',
        revisionCount: 0,
        startedAt: null,
      }

      const res = service.validateTransition(task, 'TODO', coordinatorActor)
      expect(res.status).toBe('TODO')
    })

    it('rejects when assignee is NOT set', () => {
      const task: TaskTransitionInput = {
        id: 'task-1',
        status: 'BACKLOG',
        assigneeId: null,
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

  describe('Illegal shortcut', () => {
    it('rejects invalid jump from BACKLOG directly to DONE', () => {
      const task: TaskTransitionInput = {
        id: 'task-1',
        status: 'BACKLOG',
        assigneeId: 'user-assignee',
        divisionId: 'div-1',
        revisionCount: 0,
        startedAt: null,
      }

      expect(() =>
        service.validateTransition(task, 'DONE', coordinatorActor),
      ).toThrow(UnprocessableEntityException)
    })
  })
})
