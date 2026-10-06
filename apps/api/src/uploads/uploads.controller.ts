import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Query,
  Res,
} from '@nestjs/common'
import type { Response } from 'express'
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import {
  CurrentUser,
  type RequestUser,
} from '../common/decorators/current-user.decorator.js'
import { Public } from '../common/decorators/public.decorator.js'
import { UploadsService } from './uploads.service.js'
import { PresignedUrlDto } from './dto/presigned-url.dto.js'

@ApiTags('Uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('presigned-url')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mendapatkan presigned URL untuk upload gambar ke Cloudflare R2',
  })
  @ApiResponse({
    status: 200,
    description: 'Presigned URL berhasil dibuat',
    schema: {
      properties: {
        uploadUrl: {
          type: 'string',
          example: 'https://xxx.r2.cloudflarestorage.com/moaspace/...',
        },
        fileUrl: {
          type: 'string',
          example: 'https://pub-xxx.r2.dev/editor/2026/10/uuid.png',
        },
        key: {
          type: 'string',
          example: 'editor/2026/10/uuid.png',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validasi input gagal (tipe file / ukuran)' })
  @ApiResponse({ status: 401, description: 'Tidak terautentikasi' })
  @ApiResponse({ status: 500, description: 'Konfigurasi R2 error atau gagal generate URL' })
  async createPresignedUrl(
    @Body() dto: PresignedUrlDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.uploadsService.createPresignedUploadUrl(dto, user)
  }

  @Get('file')
  @Public()
  @ApiOperation({
    summary: 'Streaming file gambar dari Cloudflare R2 dengan caching',
  })
  @ApiResponse({ status: 200, description: 'File gambar berhasil dimuat' })
  @ApiResponse({ status: 404, description: 'File tidak ditemukan' })
  async getFile(@Query('key') key: string, @Res() res: Response) {
    if (!key) {
      throw new NotFoundException('Parameter key file tidak valid.')
    }

    const { body, contentType, contentLength, eTag } =
      await this.uploadsService.getFileStream(key)

    if (contentType) res.setHeader('Content-Type', contentType)
    if (contentLength) res.setHeader('Content-Length', contentLength)
    if (eTag) res.setHeader('ETag', eTag)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')

    ;(body as any).pipe(res)
  }
}

