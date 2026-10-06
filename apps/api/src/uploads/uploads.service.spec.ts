import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UploadsService } from './uploads.service.js'
import { InternalServerErrorException } from '@nestjs/common'

// Mock @aws-sdk/s3-request-presigner
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://mock-presigned-url.r2.cloudflarestorage.com/test?signature=xxx'),
}))

// Mock @aws-sdk/client-s3
vi.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: class {
      constructor() {}
    },
    PutObjectCommand: vi.fn().mockImplementation(function (args) {
      return args
    }),
  }
})

describe('UploadsService', () => {
  let service: UploadsService
  let mockConfigService: any

  beforeEach(() => {
    mockConfigService = {
      get: vi.fn((key: string) => {
        const config: Record<string, string> = {
          R2_ACCOUNT_ID: 'test-account-id',
          R2_ACCESS_KEY_ID: 'test-access-key',
          R2_SECRET_ACCESS_KEY: 'test-secret-key',
          R2_BUCKET_NAME: 'moaspace-bucket',
          R2_PUBLIC_URL: 'https://pub-test.r2.dev',
        }
        return config[key]
      }),
    }
    service = new UploadsService(mockConfigService)
  })

  it('should throw InternalServerErrorException if R2 configuration is missing', async () => {
    mockConfigService.get = vi.fn().mockReturnValue(undefined)

    await expect(
      service.createPresignedUploadUrl({
        filename: 'image.png',
        contentType: 'image/png',
        size: 1024,
      }),
    ).rejects.toThrow(InternalServerErrorException)
  })

  it('should generate a valid presigned upload URL and public file URL', async () => {
    const result = await service.createPresignedUploadUrl(
      {
        filename: 'screenshot.png',
        contentType: 'image/png',
        size: 2048,
      },
      {
        userId: 'user-123',
        email: 'user@example.com',
        isSuperAdmin: false,
      },
    )

    expect(result.uploadUrl).toBe('https://mock-presigned-url.r2.cloudflarestorage.com/test?signature=xxx')
    expect(result.fileUrl).toMatch(/^\/api\/uploads\/file\?key=editor%2F\d{4}%2F\d{2}%2F[a-f0-9-]+\.png$/)
    expect(result.key).toMatch(/^editor\/\d{4}\/\d{2}\/[a-f0-9-]+\.png$/)
  })

  it('should use custom domain when R2_PUBLIC_URL is not on r2.dev', async () => {
    mockConfigService.get = vi.fn((key: string) => {
      if (key === 'R2_PUBLIC_URL') return 'https://assets.moaspace.com'
      return 'val'
    })

    const result = await service.createPresignedUploadUrl({
      filename: 'design.webp',
      contentType: 'image/webp',
      size: 1024,
    })

    expect(result.fileUrl.startsWith('https://assets.moaspace.com/editor/')).toBe(true)
  })

  it('should normalize jpeg extension to jpg', async () => {
    const result = await service.createPresignedUploadUrl({
      filename: 'photo.jpeg',
      contentType: 'image/jpeg',
      size: 5000,
    })

    expect(result.key).toMatch(/\.jpg$/)
    expect(result.fileUrl).toMatch(/\.jpg$/)
  })
})
