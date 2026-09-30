import { BadRequestException, UnauthorizedException } from '@nestjs/common'
import bcrypt from 'bcrypt'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthService } from './auth.service.js'

describe('AuthService', () => {
  let authService: AuthService
  let mockDb: any
  let mockJwtService: any
  let mockConfigService: any

  const mockUser = {
    id: 'user-123',
    name: 'Test Member',
    email: 'test@moaspace.com',
    passwordHash: '$2b$10$hashedpassword123',
    isSuperAdmin: false,
    status: 'ACTIVE',
  }

  beforeEach(() => {
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      transaction: vi.fn(),
    }

    mockJwtService = {
      sign: vi.fn().mockReturnValue('mock-jwt-token'),
    }

    mockConfigService = {
      get: vi.fn((key: string, defaultVal?: any) => {
        if (key === 'JWT_SECRET') return 'test-secret-at-least-32-chars-long!!'
        if (key === 'ACCESS_TOKEN_TTL') return 900
        if (key === 'REFRESH_TOKEN_TTL') return 604800
        if (key === 'NODE_ENV') return 'development'
        return defaultVal
      }),
    }

    authService = new AuthService(mockDb, mockJwtService, mockConfigService)
  })

  describe('validateUser', () => {
    it('should successfully validate user with correct password', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockUser]),
        }),
      })

      vi.spyOn(bcrypt, 'compare').mockImplementation(async () => true)

      const result = await authService.validateUser('test@moaspace.com', 'password123')
      expect(result.id).toBe('user-123')
      expect(result.email).toBe('test@moaspace.com')
    })

    it('should reject if user not found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      })

      await expect(
        authService.validateUser('unknown@moaspace.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException)
    })

    it('should reject if user is INACTIVE', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ ...mockUser, status: 'INACTIVE' }]),
        }),
      })

      await expect(
        authService.validateUser('test@moaspace.com', 'password123'),
      ).rejects.toThrow('Akun Anda dinonaktifkan')
    })

    it('should reject if account is not activated yet (null passwordHash)', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ ...mockUser, passwordHash: null }]),
        }),
      })

      await expect(
        authService.validateUser('test@moaspace.com', 'password123'),
      ).rejects.toThrow('Akun belum diaktivasi')
    })

    it('should reject if password does not match', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockUser]),
        }),
      })

      vi.spyOn(bcrypt, 'compare').mockImplementation(async () => false)

      await expect(
        authService.validateUser('test@moaspace.com', 'wrongpassword'),
      ).rejects.toThrow('Email atau kata sandi salah')
    })
  })

  describe('googleAuth', () => {
    it('should reject unregistered Google accounts per PRD Workflow 1', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      })

      await expect(
        authService.googleAuth('mock-google-token:notregistered@moaspace.com'),
      ).rejects.toThrow('Email Google ini belum didaftarkan oleh Super Admin')
    })

    it('should successfully authenticate registered Google user and link googleId', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ ...mockUser, googleId: null }]),
        }),
      })

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{}]),
        }),
      })

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue([{}]),
      })

      const res = await authService.googleAuth('mock-google-token:test@moaspace.com')
      expect(res.accessToken).toBe('mock-jwt-token')
      expect(res.user.email).toBe('test@moaspace.com')
    })
  })

  describe('activate', () => {
    it('should throw BadRequestException for invalid token', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      })

      await expect(
        authService.activate('invalid-token', 'NewPassword123'),
      ).rejects.toThrow(BadRequestException)
    })
  })

  describe('forgotPassword', () => {
    it('should return uniform success message even for non-existent email', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      })

      const res = await authService.forgotPassword('nonexistent@moaspace.com')
      expect(res.success).toBe(true)
      expect(res.message).toContain('Jika email Anda terdaftar')
    })
  })
})
