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
import { StoriesService } from './stories.service.js'
import { CreateStoryDto } from './dto/create-story.dto.js'
import { UpdateStoryDto } from './dto/update-story.dto.js'
import { QueryStoriesDto } from './dto/query-stories.dto.js'

@ApiTags('Stories')
@ApiBearerAuth()
@Controller('stories')
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Get()
  @ApiOperation({
    summary:
      'Daftar deliverable stories per divisi atau per epic beserta progres dinamis',
  })
  @ApiResponse({ status: 200, description: 'Daftar story berhasil diambil' })
  async findAll(@Query() query: QueryStoriesDto) {
    return this.storiesService.findAll(query)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail satu story beserta seluruh task perorangan' })
  @ApiResponse({ status: 200, description: 'Detail story berhasil diambil' })
  @ApiResponse({ status: 404, description: 'Story tidak ditemukan' })
  async findOne(@Param('id') id: string) {
    return this.storiesService.findOne(id)
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Buat story baru (Koordinator divisi pemilik, Super Admin, Kormanit)',
  })
  @ApiResponse({ status: 201, description: 'Story berhasil dibuat' })
  @ApiResponse({ status: 403, description: 'Bukan Koordinator divisi terkait' })
  async create(
    @Body() dto: CreateStoryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.storiesService.create(dto, user)
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Perbarui deliverable story, kriteria selesai, target tanggal, atau status penutupan',
  })
  @ApiResponse({ status: 200, description: 'Story berhasil diperbarui' })
  @ApiResponse({ status: 404, description: 'Story tidak ditemukan' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateStoryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.storiesService.update(id, dto, user)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Hapus story' })
  @ApiResponse({ status: 200, description: 'Story berhasil dihapus' })
  @ApiResponse({ status: 403, description: 'Bukan Koordinator divisi terkait' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.storiesService.delete(id, user)
  }
}
