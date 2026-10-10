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
import { ProgramsService } from './programs.service.js'
import { CreateProgramDto } from './dto/create-program.dto.js'
import { UpdateProgramDto } from './dto/update-program.dto.js'
import { ReviewProgramDto } from './dto/review-program.dto.js'
import { AddProgramMemberDto } from './dto/add-program-member.dto.js'
import { QueryProgramsDto } from './dto/query-programs.dto.js'

@ApiTags('Programs')
@ApiBearerAuth()
@Controller('programs')
export class ProgramsController {
  constructor(private readonly programsService: ProgramsService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar seluruh program kerja KKN dengan ringkasan progres dan status approval' })
  @ApiResponse({ status: 200, description: 'Daftar program kerja berhasil diambil' })
  async findAll(@Query() query: QueryProgramsDto) {
    return this.programsService.findAll(query)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail satu program kerja beserta daftar Epics yang tertaut' })
  @ApiResponse({ status: 200, description: 'Detail program kerja berhasil diambil' })
  @ApiResponse({ status: 404, description: 'Program kerja tidak ditemukan' })
  async findOne(@Param('id') id: string) {
    return this.programsService.findOne(id)
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Ajukan program kerja KKN baru (status awal: PROPOSED)' })
  @ApiResponse({ status: 201, description: 'Program kerja berhasil diajukan' })
  async create(
    @Body() dto: CreateProgramDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.programsService.create(dto, user.userId)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Pembaruan informasi program kerja (PIC / Super Admin)' })
  @ApiResponse({ status: 200, description: 'Program kerja berhasil diperbarui' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProgramDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.programsService.update(id, dto, user.userId, user.isSuperAdmin)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Hapus program kerja (PIC / Super Admin)' })
  @ApiResponse({ status: 200, description: 'Program kerja berhasil dihapus' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.programsService.delete(id, user.userId, user.isSuperAdmin)
  }

  @Post(':id/review/cluster')
  @ApiOperation({ summary: 'Review aspek keilmuan program kerja oleh Koordinator Klaster (Kormater)' })
  @ApiResponse({ status: 200, description: 'Review keilmuan berhasil disimpan' })
  async reviewCluster(
    @Param('id') id: string,
    @Body() dto: ReviewProgramDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.programsService.reviewCluster(id, dto, user.userId, user.isSuperAdmin)
  }

  @Post(':id/review/governance')
  @ApiOperation({ summary: 'Review aspek tata kelola & wilayah oleh Koordinator Subunit (Kormasit) / Kormanit' })
  @ApiResponse({ status: 200, description: 'Review tata kelola berhasil disimpan' })
  async reviewGovernance(
    @Param('id') id: string,
    @Body() dto: ReviewProgramDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.programsService.reviewGovernance(id, dto, user.userId, user.isSuperAdmin)
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tambahkan anggota ke tim pelaksana program kerja' })
  @ApiResponse({ status: 201, description: 'Anggota tim pelaksana berhasil ditambahkan' })
  async addMember(
    @Param('id') id: string,
    @Body() dto: AddProgramMemberDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.programsService.addMember(id, dto, user.userId, user.isSuperAdmin)
  }

  @Delete(':id/members/:userId')
  @ApiOperation({ summary: 'Keluarkan anggota dari tim pelaksana program kerja' })
  @ApiResponse({ status: 200, description: 'Anggota tim pelaksana berhasil dikeluarkan' })
  async removeMember(
    @Param('id') id: string,
    @Param('userId') memberUserId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.programsService.removeMember(id, memberUserId, user.userId, user.isSuperAdmin)
  }
}
