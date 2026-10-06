import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'node:crypto'
import { PresignedUrlDto } from './dto/presigned-url.dto.js'
import type { RequestUser } from '../common/decorators/current-user.decorator.js'

export interface PresignedUrlResponse {
  uploadUrl: string
  fileUrl: string
  key: string
}

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name)

  constructor(private readonly configService: ConfigService) {}

  private getR2Config() {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID')
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID')
    const secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY')
    const bucketName = this.configService.get<string>('R2_BUCKET_NAME')
    const publicUrl = this.configService.get<string>('R2_PUBLIC_URL')

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
      this.logger.error(
        'Cloudflare R2 configuration missing. Please ensure R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_URL are set.',
      )
      throw new InternalServerErrorException(
        'Layanan penyimpanan file belum dikonfigurasi dengan benar di server.',
      )
    }

    return {
      accountId,
      accessKeyId,
      secretAccessKey,
      bucketName,
      publicUrl: publicUrl.replace(/\/+$/, ''),
    }
  }

  async createPresignedUploadUrl(
    dto: PresignedUrlDto,
    user?: RequestUser,
  ): Promise<PresignedUrlResponse> {
    const { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl } =
      this.getR2Config()

    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    })

    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    }

    let ext = extMap[dto.contentType] || 'png'
    const match = dto.filename.match(/\.([a-zA-Z0-9]+)$/)
    if (match && match[1]) {
      const rawExt = match[1].toLowerCase()
      if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(rawExt)) {
        ext = rawExt === 'jpeg' ? 'jpg' : rawExt
      }
    }

    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const uniqueId = randomUUID()
    const key = `editor/${year}/${month}/${uniqueId}.${ext}`

    try {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        ContentType: dto.contentType,
      })

      // Short-lived presigned URL valid for 5 minutes (300 seconds)
      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 })
      // If publicUrl points to *.r2.dev, route through application proxy URL
      // to avoid Indonesian ISP (Telkomsel/Indihome) SSL intercept errors
      const fileUrl = publicUrl.includes('r2.dev')
        ? `/api/uploads/file?key=${encodeURIComponent(key)}`
        : `${publicUrl}/${key}`

      this.logger.log(
        `Generated presigned upload URL for key: ${key} by user: ${user?.userId ?? 'anonymous'}`,
      )

      return {
        uploadUrl,
        fileUrl,
        key,
      }
    } catch (error) {
      this.logger.error('Failed to generate presigned upload URL', error)
      throw new InternalServerErrorException('Gagal membuat URL unggah file.')
    }
  }

  async getFileStream(key: string) {
    const { accountId, accessKeyId, secretAccessKey, bucketName } =
      this.getR2Config()

    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    })

    try {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      })

      const response = await s3Client.send(command)
      return {
        body: response.Body,
        contentType: response.ContentType || 'image/png',
        contentLength: response.ContentLength,
        eTag: response.ETag,
      }
    } catch (error) {
      this.logger.error(`Failed to fetch file from R2 for key: ${key}`, error)
      throw new NotFoundException('File tidak ditemukan di penyimpanan.')
    }
  }
}
