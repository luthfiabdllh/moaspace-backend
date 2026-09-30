import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsDateString, IsOptional } from 'class-validator'

export class QueryCapacityDto {
  @ApiPropertyOptional({
    example: '2026-09-28',
    description: 'Awal pekan (Senin) format YYYY-MM-DD. Jika kosong menggunakan pekan berjalan.',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Format tanggal awal pekan tidak valid (YYYY-MM-DD).' })
  weekStart?: string
}
