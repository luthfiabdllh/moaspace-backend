import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator'

export class ConvertToStoryDto {
  @ApiPropertyOptional({
    description: 'Judul story deliverable (default: judul request)',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string

  @ApiPropertyOptional({
    description: 'ID Epic yang menaungi Story ini (opsional)',
  })
  @IsOptional()
  @IsString()
  epicId?: string

  @ApiPropertyOptional({
    description: 'Definisi atau kriteria selesai (Done Criteria)',
  })
  @IsOptional()
  @IsString()
  doneCriteria?: string

  @ApiPropertyOptional({
    description: 'Target tanggal penyelesaian',
    example: '2026-10-15T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Format tanggal target tidak valid' })
  targetDate?: string

  @ApiPropertyOptional({
    description: 'Tag program kerja / inisiatif KKN',
    example: 'EXPO_KKN',
  })
  @IsOptional()
  @IsString()
  prokerTag?: string
}
