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
  SUBUNIT = 'SUBUNIT',
  CLUSTER = 'CLUSTER',
}

export const ACADEMIC_CLUSTERS = ['SAINTEK', 'SOSHUM', 'MEDIKA', 'AGRO'] as const
export type AcademicClusterType = (typeof ACADEMIC_CLUSTERS)[number]

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

  @ApiPropertyOptional({ description: 'ID posko/subunit target jika targetType SUBUNIT' })
  @IsString()
  @IsOptional()
  targetSubunitId?: string

  @ApiPropertyOptional({
    description: 'Klaster target jika targetType CLUSTER',
    enum: ACADEMIC_CLUSTERS,
  })
  @IsEnum(ACADEMIC_CLUSTERS, { message: 'Klaster harus berupa SAINTEK, SOSHUM, MEDIKA, atau AGRO' })
  @IsOptional()
  targetCluster?: AcademicClusterType

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

  @ApiPropertyOptional({ description: 'Kirim notifikasi email ke audiens target', default: true })
  @IsBoolean()
  @IsOptional()
  sendEmail?: boolean
}
