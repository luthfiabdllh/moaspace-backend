import { Controller, Get } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { DivisionsService } from './divisions.service.js'

@ApiTags('Divisions')
@ApiBearerAuth()
@Controller('divisions')
export class DivisionsController {
  constructor(private readonly divisionsService: DivisionsService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar seluruh divisi KKN' })
  @ApiResponse({ status: 200, description: 'Daftar divisi berhasil diambil' })
  async findAll() {
    return this.divisionsService.findAll()
  }
}
