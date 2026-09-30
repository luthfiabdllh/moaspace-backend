import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator'

export class QueryActivityLogsDto {
  @ApiPropertyOptional({
    description: 'Kata kunci pencarian nama aktor, email, aksi, atau detail',
    example: 'Ahmad',
  })
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({
    description: 'Filter jenis aksi aktivitas',
    example: 'ROLE_CHANGED',
  })
  @IsOptional()
  @IsString()
  action?: string

  @ApiPropertyOptional({
    description: 'Filter tipe entitas (USER, DIVISION_MEMBER, EPIC, dll)',
    example: 'USER',
  })
  @IsOptional()
  @IsString()
  entityType?: string

  @ApiPropertyOptional({
    description: 'Filter ID entitas tertentu',
  })
  @IsOptional()
  @IsString()
  entityId?: string

  @ApiPropertyOptional({
    description: 'Kolom pengurutan data',
    enum: ['createdAt', 'action', 'actorName'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsEnum(['createdAt', 'action', 'actorName'])
  sortBy?: 'createdAt' | 'action' | 'actorName' = 'createdAt'

  @ApiPropertyOptional({
    description: 'Arah pengurutan data',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc'

  @ApiPropertyOptional({
    description: 'Nomor halaman (1-indexed)',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1

  @ApiPropertyOptional({
    description: 'Jumlah data per halaman (maksimal 100)',
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20
}
