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
import {
  CurrentUser,
  type RequestUser,
} from '../common/decorators/current-user.decorator.js'
import { SubunitsService } from './subunits.service.js'
import { CreateSubunitDto } from './dto/create-subunit.dto.js'
import { UpdateSubunitDto } from './dto/update-subunit.dto.js'
import { AddSubunitMemberDto } from './dto/add-subunit-member.dto.js'
import { UpdateSubunitMemberRoleDto } from './dto/update-subunit-member-role.dto.js'

@ApiTags('Subunits')
@ApiBearerAuth()
@Controller('subunits')
export class SubunitsController {
  constructor(private readonly subunitsService: SubunitsService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar seluruh subunit posko KKN beserta jumlah anggota & Kormasit' })
  @ApiResponse({ status: 200, description: 'Daftar subunit berhasil diambil' })
  async findAll() {
    return this.subunitsService.findAll()
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail satu subunit posko beserta daftar anggotanya' })
  @ApiResponse({ status: 200, description: 'Detail subunit berhasil diambil' })
  @ApiResponse({ status: 404, description: 'Subunit tidak ditemukan' })
  async findOne(@Param('id') id: string) {
    return this.subunitsService.findOne(id)
  }

  @Post()
  @UseGuards(SuperAdminGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Buat subunit baru (Super Admin / Kormanit)' })
  @ApiResponse({ status: 201, description: 'Subunit berhasil dibuat' })
  async create(
    @Body() dto: CreateSubunitDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.subunitsService.create(dto, user?.userId)
  }

  @Patch(':id')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Perbarui informasi subunit posko (Super Admin / Kormanit)' })
  @ApiResponse({ status: 200, description: 'Subunit berhasil diperbarui' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSubunitDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.subunitsService.update(id, dto, user?.userId)
  }

  @Delete(':id')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Hapus subunit posko (Super Admin / Kormanit)' })
  @ApiResponse({ status: 200, description: 'Subunit berhasil dihapus' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.subunitsService.remove(id, user?.userId)
  }

  @Post(':id/members')
  @UseGuards(SuperAdminGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tambahkan anggota ke subunit posko (Super Admin / Kormanit)' })
  @ApiResponse({ status: 201, description: 'Anggota berhasil ditambahkan ke subunit' })
  async addMember(
    @Param('id') subunitId: string,
    @Body() dto: AddSubunitMemberDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.subunitsService.addMember(subunitId, dto, user?.userId)
  }

  @Patch(':id/members/:userId')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Ubah peran anggota di subunit: Anggota <-> Kormasit (Super Admin / Kormanit)' })
  @ApiResponse({ status: 200, description: 'Peran anggota di subunit berhasil diubah' })
  async updateMemberRole(
    @Param('id') subunitId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateSubunitMemberRoleDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.subunitsService.updateMemberRole(subunitId, userId, dto, user?.userId)
  }

  @Delete(':id/members/:userId')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Hapus anggota dari subunit posko (Super Admin / Kormanit)' })
  @ApiResponse({ status: 200, description: 'Anggota berhasil dihapus dari subunit' })
  async removeMember(
    @Param('id') subunitId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.subunitsService.removeMember(subunitId, userId, user?.userId)
  }
}
