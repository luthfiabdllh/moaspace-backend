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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { CurrentUser, type RequestUser } from '../common/decorators/current-user.decorator.js'
import { AnnouncementsService } from './announcements.service.js'
import { CreateAnnouncementDto } from './dto/create-announcement.dto.js'
import { UpdateAnnouncementDto } from './dto/update-announcement.dto.js'
import { QueryAnnouncementsDto } from './dto/query-announcements.dto.js'

@ApiTags('Announcements')
@ApiBearerAuth()
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get('permissions')
  @ApiOperation({ summary: 'Cek hak akses pengguna untuk membuat/mengelola pengumuman' })
  async getPermissions(@CurrentUser() user: RequestUser) {
    const canCreate = await this.announcementsService.canManageAnnouncements(user)
    return { canCreate }
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Buat pengumuman baru (Khusus PSDM, Kormanit, Super Admin)' })
  @ApiResponse({ status: 201, description: 'Pengumuman berhasil dibuat' })
  async create(
    @Body() dto: CreateAnnouncementDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.announcementsService.create(dto, user)
  }

  @Get()
  @ApiOperation({ summary: 'Ambil daftar pengumuman yang relevan bagi pengguna' })
  async findAll(
    @Query() query: QueryAnnouncementsDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.announcementsService.findAll(query, user)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ambil detail satu pengumuman' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.announcementsService.findOne(id, user)
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Perbarui pengumuman (Author / Kormanit / Super Admin)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAnnouncementDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.announcementsService.update(id, dto, user)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hapus pengumuman (Author / Kormanit / Super Admin)' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.announcementsService.delete(id, user)
  }
}
