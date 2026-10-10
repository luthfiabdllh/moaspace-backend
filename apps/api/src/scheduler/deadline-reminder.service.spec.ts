import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DeadlineReminderService } from './deadline-reminder.service.js'

describe('DeadlineReminderService', () => {
  let service: DeadlineReminderService
  let db: any
  let mailService: any

  beforeEach(() => {
    db = {
      select: vi.fn(),
      from: vi.fn(),
    }
    mailService = {
      sendTaskDeadlineReminder: vi.fn().mockResolvedValue(undefined),
      sendRequestDeadlineReminder: vi.fn().mockResolvedValue(undefined),
    }
    service = new DeadlineReminderService(db, mailService)
  })

  it('handles empty tasks and requests gracefully', async () => {
    // Tasks query returns empty
    const mockTaskQuery = {
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    }

    // Requests query returns empty
    const mockRequestQuery = {
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    }

    db.select
      .mockReturnValueOnce(mockTaskQuery)
      .mockReturnValueOnce(mockRequestQuery)

    const result = await service.checkAndSendDeadlines()

    expect(result).toEqual({ tasksNotified: 0, requestsNotified: 0 })
    expect(mailService.sendTaskDeadlineReminder).not.toHaveBeenCalled()
    expect(mailService.sendRequestDeadlineReminder).not.toHaveBeenCalled()
  })

  it('notifies assignee when task deadline is today in WIB', async () => {
    const now = new Date()
    const wibOffsetMs = 7 * 60 * 60 * 1000
    const wibNow = new Date(now.getTime() + wibOffsetMs)
    const todayStr = wibNow.toISOString().slice(0, 10)

    const mockTasks = [
      {
        task: {
          id: 'task-today',
          title: 'Kerjakan Desain',
          dueDate: `${todayStr}T09:00:00.000Z`,
          priority: 'HIGH',
        },
        assignee: {
          id: 'user-1',
          name: 'Budi',
          email: 'budi@example.com',
        },
        division: {
          id: 'div-1',
          name: 'Media Kreatif',
        },
      },
    ]

    const mockTaskQuery = {
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockTasks),
    }

    const mockRequestQuery = {
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    }

    db.select
      .mockReturnValueOnce(mockTaskQuery)
      .mockReturnValueOnce(mockRequestQuery)

    const result = await service.checkAndSendDeadlines()

    expect(result.tasksNotified).toBe(1)
    expect(mailService.sendTaskDeadlineReminder).toHaveBeenCalledWith(
      { email: 'budi@example.com', name: 'Budi' },
      expect.objectContaining({
        id: 'task-today',
        title: 'Kerjakan Desain',
      }),
      true, // isToday
    )
  })

  it('notifies coordinators when request target date is tomorrow in WIB', async () => {
    const now = new Date()
    const wibOffsetMs = 7 * 60 * 60 * 1000
    const wibNow = new Date(now.getTime() + wibOffsetMs)
    const tomorrowDate = new Date(wibNow.getTime() + 24 * 60 * 60 * 1000)
    const tomorrowStr = tomorrowDate.toISOString().slice(0, 10)

    const mockRequests = [
      {
        request: {
          id: 'req-tomorrow',
          title: 'Request Spanduk Acara',
          toDivisionId: 'div-target',
          status: 'IN_PROGRESS',
          deadline: `${tomorrowStr}T10:00:00.000Z`,
        },
        toDivision: {
          id: 'div-target',
          name: 'Media Kreatif',
        },
      },
    ]

    const mockCoordinators = [
      {
        id: 'coord-1',
        name: 'Koordinator MK',
        email: 'coord@example.com',
      },
    ]

    const mockTaskQuery = {
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    }

    const mockRequestQuery = {
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockRequests),
    }

    const mockCoordQuery = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockCoordinators),
    }

    db.select
      .mockReturnValueOnce(mockTaskQuery)
      .mockReturnValueOnce(mockRequestQuery)
      .mockReturnValueOnce(mockCoordQuery)

    const result = await service.checkAndSendDeadlines()

    expect(result.requestsNotified).toBe(1)
    expect(mailService.sendRequestDeadlineReminder).toHaveBeenCalledWith(
      { id: 'coord-1', name: 'Koordinator MK', email: 'coord@example.com' },
      expect.objectContaining({
        id: 'req-tomorrow',
        title: 'Request Spanduk Acara',
      }),
      false, // isToday = false (tomorrow)
    )
  })
})
