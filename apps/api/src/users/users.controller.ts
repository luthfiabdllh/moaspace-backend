import {
  Body,
  Controller,
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
import { CreateUserDto } from './dto/create-user.dto.js'
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js'
import { UsersService } from './users.service.js'

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(SuperAdminGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Daftarkan anggota baru tim KKN dan kirim tautan aktivasi (Super Admin)' })
  @ApiResponse({ status: 201, description: 'Anggota berhasil didaftarkan dan tautan aktivasi terbit' })
  @ApiResponse({ status: 409, description: 'Email sudah terdaftar' })
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto)
  }

  @Get()
  @ApiOperation({ summary: 'Daftar seluruh anggota tim KKN beserta divisi & role (Super Admin)' })
  @ApiResponse({ status: 200, description: 'Daftar anggota berhasil diambil' })
  async findAll() {
    return this.usersService.findAll()
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Ubah status aktif/nonaktif anggota (Super Admin)' })
  @ApiResponse({ status: 200, description: 'Status pengguna berhasil diperbarui' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.usersService.updateStatus(id, dto.status)
  }

  @Post(':id/resend-activation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kirim ulang link aktivasi untuk anggota yang belum aktif (Super Admin)' })
  @ApiResponse({ status: 200, description: 'Tautan aktivasi baru berhasil diterbitkan' })
  async resendActivation(@Param('id') id: string) {
    return this.usersService.resendActivation(id)
  }
}
