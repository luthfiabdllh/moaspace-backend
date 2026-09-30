import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js'
import { CurrentUser, type RequestUser } from '../common/decorators/current-user.decorator.js'
import { CapacityService } from './capacity.service.js'
import { CreateCapacityRequestDto } from './dto/create-capacity-request.dto.js'
import { ReviewCapacityRequestDto } from './dto/review-capacity-request.dto.js'
import { QueryCapacityDto } from './dto/query-capacity.dto.js'

@ApiTags('Capacity & Workload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class CapacityController {
  constructor(private readonly capacityService: CapacityService) {}

  @Get('me/capacity')
  @ApiOperation({
    summary: 'Ambil Kapasitas & Utilisasi Pengguna Saat Ini',
    description: 'Mengambil metrik beban kerja aktif dan kuota kapasitas mingguan akun yang sedang login.',
  })
  @ApiResponse({ status: 200, description: 'Metrik utilisasi berhasil diambil.' })
  async getMyCapacity(
    @CurrentUser() user: RequestUser,
    @Query() query: QueryCapacityDto,
  ) {
    return this.capacityService.getUserUtilization(user.userId, query.weekStart)
  }

  @Post('me/capacity/request')
  @ApiOperation({
    summary: 'Ajukan Penyesuaian Kapasitas Mingguan',
    description: 'Anggota mengajukan perubahan kapasitas kerja mingguan beserta alasan/catatan izin.',
  })
  @ApiResponse({ status: 201, description: 'Pengajuan penyesuaian kapasitas berhasil dikirim.' })
  async requestAdjustment(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateCapacityRequestDto,
  ) {
    return this.capacityService.requestAdjustment(user, dto)
  }

  @Get('divisions/:id/capacity')
  @ApiOperation({
    summary: 'Ambil Utilisasi Seluruh Anggota Divisi',
    description: 'Mengambil daftar kapasitas dan beban kerja anggota divisi (termasuk task dari divisi lain) untuk pekan bersangkutan.',
  })
  @ApiResponse({ status: 200, description: 'Daftar kapasitas anggota berhasil diambil.' })
  async getDivisionCapacities(
    @Param('id') divisionId: string,
    @Query() query: QueryCapacityDto,
  ) {
    return this.capacityService.getDivisionCapacities(divisionId, query.weekStart)
  }

  @Patch('capacity/requests/:id')
  @ApiOperation({
    summary: 'Persetujuan / Penolakan Pengajuan Kapasitas',
    description: 'Koordinator divisi atau Super Admin menyetujui atau menolak pengajuan penyesuaian kapasitas anggota.',
  })
  @ApiResponse({ status: 200, description: 'Pengajuan kapasitas berhasil ditinjau.' })
  async reviewAdjustment(
    @Param('id') capacityId: string,
    @CurrentUser() reviewer: RequestUser,
    @Body() dto: ReviewCapacityRequestDto,
  ) {
    return this.capacityService.reviewAdjustment(capacityId, reviewer, dto)
  }

  @Post('capacity/cron/run')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger Pembentukan Baris Kapasitas Mingguan (Cron)',
    description: 'Membentuk baris kapasitas default untuk seluruh anggota aktif pada pekan berjalan.',
  })
  @ApiResponse({ status: 200, description: 'Sinkronisasi kapasitas mingguan selesai.' })
  async runCron() {
    return this.capacityService.ensureWeeklyCapacities()
  }
}
