import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator'

export class QueryEpicsDto {
  @ApiPropertyOptional({ description: 'Filter berdasarkan scope (DIVISION atau CROSS)' })
  @IsOptional()
  @IsEnum(['DIVISION', 'CROSS'], {
    message: 'Scope harus DIVISION atau CROSS.',
  })
  scope?: 'DIVISION' | 'CROSS'

  @ApiPropertyOptional({ description: 'Filter berdasarkan ID divisi pemilik atau peserta' })
  @IsOptional()
  @IsUUID('all', { message: 'Format divisionId tidak valid.' })
  divisionId?: string

  @ApiPropertyOptional({ description: 'Filter status selesai (true = sudah ditutup, false = aktif)' })
  @IsOptional()
  @IsString()
  isClosed?: string

  @ApiPropertyOptional({ description: 'Pencarian berdasarkan judul, deskripsi, atau tag proker' })
  @IsOptional()
  @IsString()
  search?: string
}
