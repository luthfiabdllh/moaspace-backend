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
import { AddUserDivisionDto } from './dto/add-user-division.dto.js'
import { CreateUserDto } from './dto/create-user.dto.js'
import { MoveUserDivisionDto } from './dto/move-user-division.dto.js'
import { UpdateUserDivisionRoleDto } from './dto/update-user-division-role.dto.js'
import { UpdateUserGlobalRoleDto } from './dto/update-user-global-role.dto.js'
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js'
import { UpdateUserAcademicDto } from './dto/update-user-academic.dto.js'
import { UsersService } from './users.service.js'

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UseGuards(SuperAdminGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Daftarkan anggota baru tim KKN dan kirim tautan aktivasi (Super Admin & Koordinator Mahasiswa Unit)',
  })
  @ApiResponse({
    status: 201,
    description: 'Anggota berhasil didaftarkan dan tautan aktivasi terbit',
  })
  @ApiResponse({ status: 409, description: 'Email sudah terdaftar' })
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.usersService.create(dto, actor?.userId)
  }

  @Get()
  @ApiOperation({
    summary:
      'Daftar seluruh anggota tim KKN beserta divisi & role (Super Admin & Koordinator Mahasiswa Unit)',
  })
  @ApiResponse({
    status: 200,
    description: 'Daftar anggota berhasil diambil',
  })
  async findAll() {
    return this.usersService.findAll()
  }

  @Patch(':id/status')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({
    summary:
      'Ubah status aktif/nonaktif anggota (Super Admin & Koordinator Mahasiswa Unit)',
  })
  @ApiResponse({
    status: 200,
    description: 'Status pengguna berhasil diperbarui',
  })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.usersService.updateStatus(id, dto.status, actor?.userId)
  }

  @Post(':id/divisions')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({
    summary:
      'Tambahkan anggota ke divisi lain (Multi-divisi) (Super Admin & Koordinator Mahasiswa Unit)',
  })
  @ApiResponse({
    status: 201,
    description: 'Keanggotaan divisi berhasil ditambahkan',
  })
  async addDivision(
    @Param('id') id: string,
    @Body() dto: AddUserDivisionDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.usersService.addDivision(id, dto, actor?.userId)
  }

  @Patch(':id/divisions/:divisionId/role')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({
    summary:
      'Ubah role anggota di divisi tertentu (Super Admin & Koordinator Mahasiswa Unit)',
  })
  @ApiResponse({
    status: 200,
    description: 'Role divisi berhasil diubah',
  })
  async updateDivisionRole(
    @Param('id') id: string,
    @Param('divisionId') divisionId: string,
    @Body() dto: UpdateUserDivisionRoleDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.usersService.updateDivisionRole(id, divisionId, dto, actor?.userId)
  }

  @Delete(':id/divisions/:divisionId')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({
    summary:
      'Hapus keanggotaan divisi seorang anggota (Super Admin & Koordinator Mahasiswa Unit)',
  })
  @ApiResponse({
    status: 200,
    description: 'Keanggotaan divisi berhasil dihapus',
  })
  async removeDivision(
    @Param('id') id: string,
    @Param('divisionId') divisionId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.usersService.removeDivision(id, divisionId, actor?.userId)
  }

  @Post(':id/divisions/move')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({
    summary:
      'Pindahkan anggota dari satu divisi ke divisi lain (Super Admin & Koordinator Mahasiswa Unit)',
  })
  @ApiResponse({
    status: 200,
    description: 'Anggota berhasil dipindahkan ke divisi baru',
  })
  async moveDivision(
    @Param('id') id: string,
    @Body() dto: MoveUserDivisionDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.usersService.moveDivision(id, dto, actor?.userId)
  }

  @Patch(':id/global-role')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({
    summary:
      'Ubah hak akses Koordinator Mahasiswa Unit (Super Admin & Koordinator Mahasiswa Unit)',
  })
  @ApiResponse({
    status: 200,
    description: 'Peran Koordinator Mahasiswa Unit berhasil diperbarui',
  })
  async updateGlobalRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserGlobalRoleDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.usersService.updateGlobalRole(id, dto, actor?.userId)
  }

  @Post(':id/resend-activation')
  @UseGuards(SuperAdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Kirim ulang link aktivasi untuk anggota yang belum aktif (Super Admin & Koordinator Mahasiswa Unit)',
  })
  @ApiResponse({
    status: 200,
    description: 'Tautan aktivasi baru berhasil diterbitkan',
  })
  async resendActivation(@Param('id') id: string) {
    return this.usersService.resendActivation(id)
  }

  @Patch(':id/academic')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({
    summary:
      'Perbarui klaster, peran Kormater, atau subunit posko mahasiswa (Super Admin & Koordinator Mahasiswa Unit)',
  })
  @ApiResponse({
    status: 200,
    description: 'Informasi klaster dan subunit mahasiswa berhasil diperbarui',
  })
  async updateAcademic(
    @Param('id') id: string,
    @Body() dto: UpdateUserAcademicDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.usersService.updateAcademic(id, dto, actor?.userId)
  }
}

