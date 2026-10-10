import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsOptional, IsString } from 'class-validator'
import { AnnouncementCategory, AnnouncementTarget } from './create-announcement.dto.js'

export class QueryAnnouncementsDto {
  @ApiPropertyOptional({ enum: AnnouncementCategory })
  @IsEnum(AnnouncementCategory)
  @IsOptional()
  category?: AnnouncementCategory

  @ApiPropertyOptional({ enum: AnnouncementTarget })
  @IsEnum(AnnouncementTarget)
  @IsOptional()
  targetType?: AnnouncementTarget

  @ApiPropertyOptional({ description: 'Filter divisi target' })
  @IsString()
  @IsOptional()
  divisionId?: string

  @ApiPropertyOptional({ description: 'Filter posko/subunit target' })
  @IsString()
  @IsOptional()
  subunitId?: string

  @ApiPropertyOptional({ description: 'Filter klaster target' })
  @IsString()
  @IsOptional()
  cluster?: string

  @ApiPropertyOptional({ description: 'Pencarian berdasarkan judul pengumuman' })
  @IsString()
  @IsOptional()
  search?: string
}
