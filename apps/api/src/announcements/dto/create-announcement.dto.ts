import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'

export enum AnnouncementCategory {
  URGENT = 'URGENT',
  MEETING = 'MEETING',
  INFO = 'INFO',
  ACTIVITY = 'ACTIVITY',
}

export enum AnnouncementTarget {
  ALL = 'ALL',
  DIVISION = 'DIVISION',
}

export class CreateAnnouncementDto {
  @ApiProperty({ description: 'Judul pengumuman', example: 'Briefing Program Kerja Tim KKN' })
  @IsString()
  @IsNotEmpty({ message: 'Judul pengumuman tidak boleh kosong' })
  @MaxLength(255)
  title!: string

  @ApiProperty({ description: 'Konten pengumuman dalam format Rich-Text JSON (TipTap)' })
  @IsObject()
  @IsNotEmpty({ message: 'Konten pengumuman tidak boleh kosong' })
  content!: Record<string, unknown>

  @ApiPropertyOptional({ enum: AnnouncementCategory, default: AnnouncementCategory.INFO })
  @IsEnum(AnnouncementCategory)
  @IsOptional()
  category?: AnnouncementCategory

  @ApiPropertyOptional({ enum: AnnouncementTarget, default: AnnouncementTarget.ALL })
  @IsEnum(AnnouncementTarget)
  @IsOptional()
  targetType?: AnnouncementTarget

  @ApiPropertyOptional({ description: 'ID divisi target jika targetType DIVISION' })
  @IsString()
  @IsOptional()
  targetDivisionId?: string

  @ApiPropertyOptional({ description: 'Status disematkan di paling atas' })
  @IsBoolean()
  @IsOptional()
  isPinned?: boolean

  @ApiPropertyOptional({ description: 'Waktu mulai agenda/kegiatan' })
  @IsDateString()
  @IsOptional()
  eventStartDate?: string

  @ApiPropertyOptional({ description: 'Waktu selesai agenda/kegiatan' })
  @IsDateString()
  @IsOptional()
  eventEndDate?: string

  @ApiPropertyOptional({ description: 'Lokasi kegiatan atau tautan virtual' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  location?: string
}
