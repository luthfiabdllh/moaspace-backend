import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common'
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
import { RequestsService } from './requests.service.js'
import { CreateRequestTemplateDto } from './dto/create-template.dto.js'
import { UpdateRequestTemplateDto } from './dto/update-template.dto.js'

@ApiTags('Request Templates')
@ApiBearerAuth()
@Controller()
export class RequestTemplatesController {
  constructor(private readonly requestsService: RequestsService) {}

  @Get('divisions/:divisionId/templates')
  @ApiOperation({ summary: 'Ambil daftar template request untuk divisi tertentu' })
  @ApiResponse({ status: 200, description: 'Daftar template berhasil diambil' })
  async findByDivision(@Param('divisionId') divisionId: string) {
    return this.requestsService.findAllTemplates(divisionId)
  }

  @Post('divisions/:divisionId/templates')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Buat template formulir request baru (Koordinator divisi pemilik, Super Admin, Kormanit)',
  })
  @ApiResponse({ status: 201, description: 'Template request berhasil dibuat' })
  @ApiResponse({ status: 403, description: 'Bukan koordinator divisi pemilik' })
  async create(
    @Param('divisionId') divisionId: string,
    @Body() dto: CreateRequestTemplateDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.requestsService.createTemplate(divisionId, dto, user)
  }

  @Get('request-templates/:id')
  @ApiOperation({ summary: 'Ambil detail satu template request' })
  @ApiResponse({ status: 200, description: 'Detail template berhasil diambil' })
  @ApiResponse({ status: 404, description: 'Template tidak ditemukan' })
  async findOne(@Param('id') id: string) {
    return this.requestsService.findTemplateById(id)
  }

  @Patch('request-templates/:id')
  @ApiOperation({ summary: 'Perbarui nama, deskripsi, atau fields template request' })
  @ApiResponse({ status: 200, description: 'Template request berhasil diperbarui' })
  @ApiResponse({ status: 403, description: 'Bukan koordinator divisi pemilik' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRequestTemplateDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.requestsService.updateTemplate(id, dto, user)
  }

  @Delete('request-templates/:id')
  @ApiOperation({ summary: 'Hapus template request' })
  @ApiResponse({ status: 200, description: 'Template request berhasil dihapus' })
  @ApiResponse({ status: 403, description: 'Bukan koordinator divisi pemilik' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.requestsService.deleteTemplate(id, user)
  }
}
