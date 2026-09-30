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
  UseGuards,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import { SuperAdminGuard } from '../auth/guards/super-admin.guard.js'
import { DivisionRoleGuard } from '../common/guards/division-role.guard.js'
import { DivisionRole } from '../common/decorators/division-role.decorator.js'
import {
  CurrentUser,
  type RequestUser,
} from '../common/decorators/current-user.decorator.js'
import { DivisionsService } from './divisions.service.js'
import { CreateDivisionDto } from './dto/create-division.dto.js'
import { UpdateDivisionDto } from './dto/update-division.dto.js'
import { AddDivisionMemberDto } from './dto/add-division-member.dto.js'
import { UpdateDivisionMemberRoleDto } from './dto/update-division-member-role.dto.js'

@ApiTags('Divisions')
@ApiBearerAuth()
@Controller('divisions')
export class DivisionsController {
  constructor(private readonly divisionsService: DivisionsService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar seluruh divisi KKN beserta jumlah anggota & koordinator' })
  @ApiResponse({ status: 200, description: 'Daftar divisi berhasil diambil' })
  async findAll() {
    return this.divisionsService.findAll()
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail satu divisi beserta daftar anggotanya' })
  @ApiResponse({ status: 200, description: 'Detail divisi berhasil diambil' })
  @ApiResponse({ status: 404, description: 'Divisi tidak ditemukan' })
  async findOne(@Param('id') id: string) {
    return this.divisionsService.findOne(id)
  }

  @Post()
  @UseGuards(SuperAdminGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Buat divisi baru (Khusus Super Admin & Koordinator Mahasiswa Unit)',
  })
  @ApiResponse({ status: 201, description: 'Divisi baru berhasil dibuat' })
  @ApiResponse({ status: 409, description: 'Slug divisi sudah digunakan' })
  async create(
    @Body() dto: CreateDivisionDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.divisionsService.create(dto, actor?.userId)
  }

  @Patch(':id')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({
    summary:
      'Perbarui nama, slug, atau toggle approval request divisi (Super Admin & Kormanit)',
  })
  @ApiResponse({ status: 200, description: 'Divisi berhasil diperbarui' })
  @ApiResponse({ status: 404, description: 'Divisi tidak ditemukan' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDivisionDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.divisionsService.update(id, dto, actor?.userId)
  }

  @Post(':id/members')
  @UseGuards(DivisionRoleGuard)
  @DivisionRole('COORDINATOR')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Tambah anggota ke dalam divisi (Koordinator Divisi, Super Admin, Kormanit)',
  })
  @ApiResponse({ status: 201, description: 'Anggota berhasil ditambahkan ke divisi' })
  @ApiResponse({ status: 404, description: 'Divisi atau Pengguna tidak ditemukan' })
  @ApiResponse({ status: 409, description: 'Pengguna sudah terdaftar di divisi' })
  async addMember(
    @Param('id') id: string,
    @Body() dto: AddDivisionMemberDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.divisionsService.addMember(id, dto, actor?.userId)
  }

  @Patch(':id/members/:userId')
  @UseGuards(DivisionRoleGuard)
  @DivisionRole('COORDINATOR')
  @ApiOperation({
    summary:
      'Ubah peran anggota dalam divisi (Koordinator Divisi, Super Admin, Kormanit)',
  })
  @ApiResponse({ status: 200, description: 'Peran anggota berhasil diperbarui' })
  @ApiResponse({ status: 404, description: 'Anggota tidak terdaftar di divisi' })
  async updateMemberRole(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateDivisionMemberRoleDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.divisionsService.updateMemberRole(id, userId, dto, actor?.userId)
  }

  @Delete(':id/members/:userId')
  @UseGuards(DivisionRoleGuard)
  @DivisionRole('COORDINATOR')
  @ApiOperation({
    summary:
      'Hapus anggota dari divisi (Koordinator Divisi, Super Admin, Kormanit)',
  })
  @ApiResponse({ status: 200, description: 'Anggota berhasil dihapus dari divisi' })
  @ApiResponse({ status: 404, description: 'Anggota tidak terdaftar di divisi' })
  async removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.divisionsService.removeMember(id, userId, actor?.userId)
  }
}
