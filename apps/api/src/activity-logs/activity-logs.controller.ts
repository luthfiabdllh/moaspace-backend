import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import { SuperAdminGuard } from '../auth/guards/super-admin.guard.js'
import { ActivityLogsService } from './activity-logs.service.js'
import { QueryActivityLogsDto } from './dto/query-activity-logs.dto.js'

@ApiTags('Activity Logs')
@ApiBearerAuth()
@UseGuards(SuperAdminGuard)
@Controller('activity-logs')
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Ambil daftar activity log dengan pencarian, filter, sorting & paginasi (Super Admin & Koordinator Mahasiswa Unit)',
  })
  @ApiResponse({
    status: 200,
    description: 'Daftar activity log beserta metadata paginasi berhasil diambil',
  })
  async getLogs(@Query() query: QueryActivityLogsDto) {
    return this.activityLogsService.findAll(query)
  }
}
