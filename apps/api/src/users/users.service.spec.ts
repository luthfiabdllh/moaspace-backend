import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UsersService } from './users.service.js'

describe('UsersService', () => {
  let usersService: UsersService
  let mockDb: any

  beforeEach(() => {
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      transaction: vi.fn(),
    }

    usersService = new UsersService(mockDb)
  })

  describe('create', () => {
    it('should successfully register member and generate activation token', async () => {
      // 1. Cek email tidak ada
      const mockWhereEmail = vi.fn().mockResolvedValue([])
      // 2. Cek divisi ada
      const mockWhereDiv = vi.fn().mockResolvedValue([{ id: 'div-1', name: 'Media Kreatif' }])

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: mockWhereEmail,
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: mockWhereDiv,
        }),
      })

      mockDb.transaction.mockImplementation(async (callback: any) => {
        const tx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue([{}]),
          }),
        }
        return callback(tx)
      })

      const res = await usersService.create({
        email: 'budi@moaspace.com',
        name: 'Budi Santoso',
        divisionId: 'div-1',
        role: 'MEMBER',
      })

      expect(res.success).toBe(true)
      expect(res.user.email).toBe('budi@moaspace.com')
      expect(res.user.name).toBe('Budi Santoso')
      expect(res.user.status).toBe('ACTIVE')
      expect(res.activationUrl).toContain('http://localhost:3001/activate?token=')
    })

    it('should throw ConflictException if email is already registered', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'existing-id' }]),
        }),
      })

      await expect(
        usersService.create({
          email: 'admin@moaspace.com',
          name: 'Another Admin',
          divisionId: 'div-1',
          role: 'COORDINATOR',
        }),
      ).rejects.toThrow(ConflictException)
    })

    it('should throw NotFoundException if division does not exist', async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      })

      await expect(
        usersService.create({
          email: 'new@moaspace.com',
          name: 'New Person',
          divisionId: 'nonexistent-div',
          role: 'MEMBER',
        }),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('updateStatus', () => {
    it('should prevent deactivating Super Admin account', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'admin-id', isSuperAdmin: true }]),
        }),
      })

      await expect(
        usersService.updateStatus('admin-id', 'INACTIVE'),
      ).rejects.toThrow(BadRequestException)
    })
  })
})
