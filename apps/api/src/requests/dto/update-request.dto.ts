import { ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'

export class UpdateRequestDto {
  @ApiPropertyOptional({ description: 'ID template form yang digunakan' })
  @IsOptional()
  @IsString()
  templateId?: string

  @ApiPropertyOptional({
    description: 'Judul permohonan request',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string

  @ApiPropertyOptional({
    description: 'Data brief jawaban form dinamis sesuai field template',
  })
  @IsOptional()
  @IsObject()
  brief?: Record<string, unknown>

  @ApiPropertyOptional({
    description: 'Tenggat waktu pengerjaan (deadline)',
    example: '2026-10-15T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Format tanggal deadline tidak valid' })
  deadline?: string
}
