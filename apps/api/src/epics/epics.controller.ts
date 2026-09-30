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
  Query,
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
import { EpicsService } from './epics.service.js'
import { CreateEpicDto } from './dto/create-epic.dto.js'
import { UpdateEpicDto } from './dto/update-epic.dto.js'
import { QueryEpicsDto } from './dto/query-epics.dto.js'

@ApiTags('Epics')
@ApiBearerAuth()
@Controller('epics')
export class EpicsController {
  constructor(private readonly epicsService: EpicsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Daftar epic pekerjaan divisi / lintas divisi beserta progres dinamis',
  })
  @ApiResponse({ status: 200, description: 'Daftar epic berhasil diambil' })
  async findAll(@Query() query: QueryEpicsDto) {
    return this.epicsService.findAll(query)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail satu epic beserta seluruh story & task' })
  @ApiResponse({ status: 200, description: 'Detail epic berhasil diambil' })
  @ApiResponse({ status: 404, description: 'Epic tidak ditemukan' })
  async findOne(@Param('id') id: string) {
    return this.epicsService.findOne(id)
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Buat epic baru (Koordinator Divisi untuk scope DIVISION; Super Admin/Kormanit untuk CROSS)',
  })
  @ApiResponse({ status: 201, description: 'Epic berhasil dibuat' })
  @ApiResponse({ status: 403, description: 'Tidak memiliki wewenang untuk scope terkait' })
  async create(
    @Body() dto: CreateEpicDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.epicsService.create(dto, user)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Perbarui judul, tanggal, proker, atau tutup/buka epic' })
  @ApiResponse({ status: 200, description: 'Epic berhasil diperbarui' })
  @ApiResponse({ status: 404, description: 'Epic tidak ditemukan' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEpicDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.epicsService.update(id, dto, user)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Hapus epic (Khusus Super Admin & Kormanit)' })
  @ApiResponse({ status: 200, description: 'Epic berhasil dihapus' })
  @ApiResponse({ status: 403, description: 'Hanya Super Admin atau Kormanit' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.epicsService.delete(id, user)
  }
}
