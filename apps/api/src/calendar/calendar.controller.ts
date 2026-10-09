import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { CalendarService } from './calendar.service.js'
import { CalendarCallbackDto } from './dto/calendar-callback.dto.js'
import { ToggleSyncDto } from './dto/toggle-sync.dto.js'

@ApiTags('Calendar')
@ApiBearerAuth()
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('auth-url')
  @ApiOperation({ summary: 'Dapatkan Google Calendar OAuth URL' })
  @ApiResponse({ status: 200, description: 'URL otorisasi Google Calendar' })
  getAuthUrl(
    @CurrentUser() user: RequestUser,
    @Query('redirectUri') redirectUri?: string,
  ) {
    const url = this.calendarService.getAuthUrl(user.userId, redirectUri)
    return { url }
  }

  @Post('callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tukarkan auth code Google Calendar dengan token' })
  @ApiResponse({ status: 200, description: 'Google Calendar berhasil terhubung' })
  async handleCallback(
    @CurrentUser() user: RequestUser,
    @Body() dto: CalendarCallbackDto,
  ) {
    return this.calendarService.handleCallback(user.userId, dto.code, dto.redirectUri)
  }

  @Get('status')
  @ApiOperation({ summary: 'Cek status integrasi Google Calendar pengguna' })
  @ApiResponse({ status: 200, description: 'Status integrasi Google Calendar' })
  async getStatus(@CurrentUser() user: RequestUser) {
    return this.calendarService.getStatus(user.userId)
  }

  @Patch('toggle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aktifkan atau nonaktifkan sinkronisasi Google Calendar' })
  async toggleSync(
    @CurrentUser() user: RequestUser,
    @Body() dto: ToggleSyncDto,
  ) {
    return this.calendarService.toggleSync(user.userId, dto.enabled)
  }

  @Delete('disconnect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Putuskan koneksi Google Calendar' })
  async disconnect(@CurrentUser() user: RequestUser) {
    return this.calendarService.disconnect(user.userId)
  }

  @Post('sync-now')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sinkronisasi ulang semua tugas dan permohonan ke Google Calendar' })
  async syncNow(@CurrentUser() user: RequestUser) {
    await this.calendarService.syncAllUserItems(user.userId)
    return { success: true, message: 'Sinkronisasi berhasil dijalankan' }
  }
}
