import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, IsUUID } from 'class-validator'

export class QueryStoriesDto {
  @ApiPropertyOptional({ description: 'Filter berdasarkan ID divisi' })
  @IsOptional()
  @IsUUID('all', { message: 'Format divisionId tidak valid.' })
  divisionId?: string

  @ApiPropertyOptional({ description: 'Filter berdasarkan ID Epic' })
  @IsOptional()
  @IsUUID('all', { message: 'Format epicId tidak valid.' })
  epicId?: string

  @ApiPropertyOptional({ description: 'Filter status selesai (true = sudah ditutup, false = aktif)' })
  @IsOptional()
  @IsString()
  isClosed?: string

  @ApiPropertyOptional({ description: 'Pencarian berdasarkan judul atau tag proker' })
  @IsOptional()
  @IsString()
  search?: string
}
