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
import { TasksService } from './tasks.service.js'
import { CreateTaskDto } from './dto/create-task.dto.js'
import { UpdateTaskDto } from './dto/update-task.dto.js'
import { QueryTasksDto } from './dto/query-tasks.dto.js'
import { MoveTaskDto } from './dto/move-task.dto.js'
import { BlockTaskDto } from './dto/block-task.dto.js'

@ApiTags('Tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar seluruh task dengan filter story, divisi, status, atau assignee' })
  @ApiResponse({ status: 200, description: 'Daftar task berhasil diambil' })
  async findAll(@Query() query: QueryTasksDto) {
    return this.tasksService.findAll(query)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail satu task beserta riwayat log audit perubahan' })
  @ApiResponse({ status: 200, description: 'Detail task berhasil diambil' })
  @ApiResponse({ status: 404, description: 'Task tidak ditemukan' })
  async findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id)
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Buat task baru di dalam story' })
  @ApiResponse({ status: 201, description: 'Task berhasil dibuat' })
  @ApiResponse({ status: 403, description: 'Bukan anggota divisi terkait' })
  async create(
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tasksService.create(dto, user)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Perbarui task, pindahkan status kanban, atau ubah assignee' })
  @ApiResponse({ status: 200, description: 'Task berhasil diperbarui' })
  @ApiResponse({ status: 404, description: 'Task tidak ditemukan' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tasksService.update(id, dto, user)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Hapus task dari story (Khusus Koordinator Divisi / Admin)' })
  @ApiResponse({ status: 200, description: 'Task berhasil dihapus' })
  @ApiResponse({ status: 403, description: 'Bukan Koordinator divisi terkait' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tasksService.delete(id, user)
  }

  @Patch(':id/move')
  @ApiOperation({ summary: 'Pindahkan status atau susunan kartu di Kanban board (Validasi aturan transisi alur kerja)' })
  @ApiResponse({ status: 200, description: 'Kartu berhasil dipindahkan' })
  @ApiResponse({ status: 422, description: 'Pelanggaran aturan transisi status' })
  async move(
    @Param('id') id: string,
    @Body() dto: MoveTaskDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tasksService.move(id, dto, user)
  }

  @Post(':id/block')
  @ApiOperation({ summary: 'Tandai task sebagai terkendala/blocked' })
  @ApiResponse({ status: 200, description: 'Flag kendala berhasil dipasang' })
  @ApiResponse({ status: 422, description: 'Task sudah DONE' })
  async block(
    @Param('id') id: string,
    @Body() dto: BlockTaskDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tasksService.block(id, dto, user)
  }

  @Post(':id/unblock')
  @ApiOperation({ summary: 'Lepas tanda kendala/blocker dari task' })
  @ApiResponse({ status: 200, description: 'Flag kendala berhasil dilepas' })
  async unblock(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tasksService.unblock(id, user)
  }
}
