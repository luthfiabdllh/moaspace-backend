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
import { CreateRequestDto } from './dto/create-request.dto.js'
import { UpdateRequestDto } from './dto/update-request.dto.js'
import { QueryRequestsDto } from './dto/query-requests.dto.js'
import { OriginApprovalDto } from './dto/origin-approval.dto.js'
import { TriageRequestDto } from './dto/triage-request.dto.js'
import { RespondInfoDto } from './dto/respond-info.dto.js'
import { ConvertToStoryDto } from './dto/convert-to-story.dto.js'
import { ConvertToEpicDto } from './dto/convert-to-epic.dto.js'
import { DeliverRequestDto } from './dto/deliver-request.dto.js'
import { ConfirmRequestDto } from './dto/confirm-request.dto.js'

@ApiTags('Requests')
@ApiBearerAuth()
@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Buat permohonan kolaborasi antar divisi baru',
  })
  @ApiResponse({ status: 201, description: 'Request berhasil dibuat' })
  @ApiResponse({ status: 400, description: 'Data input tidak valid atau divisi sama' })
  @ApiResponse({ status: 403, description: 'Bukan anggota divisi asal' })
  async create(
    @Body() dto: CreateRequestDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.requestsService.createRequest(dto, user)
  }

  @Get()
  @ApiOperation({
    summary: 'Daftar request antar divisi (Kotak Masuk / Kotak Keluar)',
  })
  @ApiResponse({ status: 200, description: 'Daftar request berhasil diambil' })
  async findAll(
    @Query() query: QueryRequestsDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.requestsService.findAllRequests(query, user)
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detail lengkap permohonan beserta riwayat timeline, progres story, dan hak aksi',
  })
  @ApiResponse({ status: 200, description: 'Detail request berhasil diambil' })
  @ApiResponse({ status: 403, description: 'Tidak memiliki hak akses melihat' })
  @ApiResponse({ status: 404, description: 'Request tidak ditemukan' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.requestsService.findOneRequest(id, user)
  }

  @Patch(':id/origin-approval')
  @ApiOperation({
    summary:
      'Persetujuan awal oleh koordinator divisi asal (APPROVE -> SUBMITTED, REJECT -> REJECTED)',
  })
  @ApiResponse({ status: 200, description: 'Status permohonan berhasil diperbarui' })
  @ApiResponse({ status: 403, description: 'Bukan koordinator divisi asal' })
  async approveOrigin(
    @Param('id') id: string,
    @Body() dto: OriginApprovalDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.requestsService.approveOrigin(id, dto, user)
  }

  @Patch(':id/triage')
  @ApiOperation({
    summary:
      'Triage oleh koordinator divisi tujuan (ACCEPT / REJECT / NEED_INFO)',
  })
  @ApiResponse({ status: 200, description: 'Triage berhasil diproses' })
  @ApiResponse({ status: 403, description: 'Bukan koordinator divisi tujuan' })
  async triage(
    @Param('id') id: string,
    @Body() dto: TriageRequestDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.requestsService.triage(id, dto, user)
  }

  @Patch(':id/respond-info')
  @ApiOperation({
    summary:
      'Pemohon melengkapi brief atau memberikan informasi tambahan yang diminta',
  })
  @ApiResponse({ status: 200, description: 'Informasi berhasil dilengkapi, status kembali SUBMITTED' })
  @ApiResponse({ status: 403, description: 'Bukan pemohon atau anggota divisi asal' })
  async respondInfo(
    @Param('id') id: string,
    @Body() dto: RespondInfoDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.requestsService.respondInfo(id, dto, user)
  }

  @Post(':id/convert-to-story')
  @ApiOperation({
    summary:
      'Konversi request ACCEPTED menjadi deliverable Story di board divisi tujuan (status -> IN_PROGRESS)',
  })
  @ApiResponse({ status: 201, description: 'Story berhasil dibuat dan ditautkan ke request' })
  @ApiResponse({ status: 400, description: 'Status bukan ACCEPTED' })
  @ApiResponse({ status: 403, description: 'Bukan koordinator divisi tujuan' })
  async convertToStory(
    @Param('id') id: string,
    @Body() dto: ConvertToStoryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.requestsService.convertToStory(id, dto, user)
  }

  @Post(':id/convert-to-epic')
  @ApiOperation({
    summary:
      'Konversi permohonan yang disetujui menjadi Inisiatif / Epic (Level 1) di /epics',
  })
  @ApiResponse({ status: 201, description: 'Epic berhasil dibuat dan ditautkan ke request' })
  @ApiResponse({ status: 400, description: 'Status bukan ACCEPTED' })
  @ApiResponse({ status: 403, description: 'Bukan koordinator divisi tujuan' })
  async convertToEpic(
    @Param('id') id: string,
    @Body() dto: ConvertToEpicDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.requestsService.convertToEpic(id, dto, user)
  }

  @Patch(':id/deliver')
  @ApiOperation({
    summary:
      'Pengiriman hasil pengerjaan request (seluruh task story wajib DONE)',
  })
  @ApiResponse({ status: 200, description: 'Hasil kerja berhasil dikirimkan' })
  @ApiResponse({ status: 400, description: 'Masih ada task belum DONE atau lampiran kosong' })
  @ApiResponse({ status: 403, description: 'Bukan koordinator divisi tujuan' })
  async deliver(
    @Param('id') id: string,
    @Body() dto: DeliverRequestDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.requestsService.deliver(id, dto, user)
  }

  @Patch(':id/confirm')
  @ApiOperation({
    summary:
      'Konfirmasi hasil kerja oleh pemohon (CONFIRM -> selesai, REVISION -> buka revisi)',
  })
  @ApiResponse({ status: 200, description: 'Konfirmasi/revisi berhasil dicatat' })
  @ApiResponse({ status: 403, description: 'Bukan pemohon atau koordinator divisi asal' })
  async confirm(
    @Param('id') id: string,
    @Body() dto: ConfirmRequestDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.requestsService.confirm(id, dto, user)
  }

  @Patch(':id/submit-draft')
  @ApiOperation({
    summary: 'Ajukan permohonan yang masih berstatus DRAFT ke alur persetujuan atau triage',
  })
  @ApiResponse({ status: 200, description: 'Draft permohonan berhasil diajukan' })
  @ApiResponse({ status: 400, description: 'Permohonan bukan berstatus DRAFT' })
  @ApiResponse({ status: 403, description: 'Bukan pemohon atau koordinator divisi asal' })
  async submitDraft(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.requestsService.submitDraft(id, user)
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Perbarui permohonan yang masih berstatus DRAFT (judul, brief, deadline, template)',
  })
  @ApiResponse({ status: 200, description: 'Draft permohonan berhasil diperbarui' })
  @ApiResponse({ status: 400, description: 'Permohonan bukan berstatus DRAFT' })
  @ApiResponse({ status: 403, description: 'Bukan pemohon atau koordinator divisi asal' })
  async updateDraft(
    @Param('id') id: string,
    @Body() dto: UpdateRequestDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.requestsService.updateRequest(id, dto, user)
  }
}
