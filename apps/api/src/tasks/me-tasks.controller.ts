import { Controller, Get } from '@nestjs/common'
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
import { TasksService } from './tasks.service.js'

@ApiTags('Me')
@ApiBearerAuth()
@Controller('me')
export class MeTasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get('tasks')
  @ApiOperation({
    summary: 'Tugas Saya lintas semua divisi yang diikuti oleh user aktif',
  })
  @ApiResponse({
    status: 200,
    description: 'Daftar tugas user aktif terkelompok per kolom status',
  })
  async getMyTasks(@CurrentUser() user: RequestUser) {
    return this.tasksService.getMeTasks(user)
  }
}
