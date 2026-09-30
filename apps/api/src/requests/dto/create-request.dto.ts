import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsDateString,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'

export class CreateRequestDto {
  @ApiProperty({ description: 'ID divisi asal pembuat request' })
  @IsString()
  @IsNotEmpty({ message: 'Divisi asal wajib diisi' })
  fromDivisionId: string

  @ApiProperty({ description: 'ID divisi tujuan permohonan' })
  @IsString()
  @IsNotEmpty({ message: 'Divisi tujuan wajib diisi' })
  toDivisionId: string

  @ApiPropertyOptional({ description: 'ID template form yang digunakan' })
  @IsOptional()
  @IsString()
  templateId?: string

  @ApiProperty({
    description: 'Judul permohonan request (contoh: Kebutuhan Poster Expo KKN)',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty({ message: 'Judul permohonan wajib diisi' })
  @MaxLength(255)
  title: string

  @ApiProperty({
    description: 'Data brief jawaban form dinamis sesuai field template',
    example: { ukuran: 'A3', platform: 'Instagram Feed', teks: 'Moa Bercerita 2026' },
  })
  @IsObject()
  brief: Record<string, unknown>

  @ApiPropertyOptional({
    description: 'Tenggat waktu pengerjaan (deadline)',
    example: '2026-10-15T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Format tanggal deadline tidak valid' })
  deadline?: string

  @ApiPropertyOptional({ description: 'ID task asal yang memicu request ini' })
  @IsOptional()
  @IsString()
  sourceTaskId?: string

  @ApiPropertyOptional({ description: 'ID story asal yang memicu request ini' })
  @IsOptional()
  @IsString()
  sourceStoryId?: string
}
