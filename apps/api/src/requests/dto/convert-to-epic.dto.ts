import { ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator'

export class ConvertToEpicDto {
  @ApiPropertyOptional({
    description: 'Judul Inisiatif / Epic (default: judul request)',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string

  @ApiPropertyOptional({
    description: 'Deskripsi lengkap Inisiatif / Epic',
  })
  @IsOptional()
  @IsString()
  description?: string

  @ApiPropertyOptional({
    description: 'Cakupan inisiatif: DIVISION (divisi sendiri) atau CROSS (lintas divisi)',
    enum: ['DIVISION', 'CROSS'],
    default: 'CROSS',
  })
  @IsOptional()
  @IsEnum(['DIVISION', 'CROSS'], {
    message: 'Scope harus DIVISION atau CROSS.',
  })
  scope?: 'DIVISION' | 'CROSS'

  @ApiPropertyOptional({
    description: 'Daftar ID divisi yang berpartisipasi (khusus jika scope CROSS)',
    type: [String],
    example: ['uuid-divisi-1', 'uuid-divisi-2'],
  })
  @IsOptional()
  @IsArray({ message: 'Participating division IDs harus berupa array.' })
  @IsUUID('all', { each: true, message: 'Format ID divisi peserta tidak valid.' })
  participatingDivisionIds?: string[]

  @ApiPropertyOptional({
    description: 'Tag program kerja / inisiatif',
    example: 'EXPO_KKN',
  })
  @IsOptional()
  @IsString()
  prokerTag?: string

  @ApiPropertyOptional({
    description: 'Target tanggal penyelesaian (ISO8601)',
    example: '2026-10-31T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Format tanggal target tidak valid' })
  targetDate?: string

  @ApiPropertyOptional({
    description: 'Buat Story deliverable awal di bawah Epic ini (default: true)',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  createInitialStory?: boolean
}
