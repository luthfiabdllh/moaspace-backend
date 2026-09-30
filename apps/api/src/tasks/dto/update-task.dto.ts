import { ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator'

export class UpdateTaskDto {
  @ApiPropertyOptional({ description: 'Judul task' })
  @IsOptional()
  @IsString({ message: 'Judul task harus berupa teks.' })
  @MaxLength(255, { message: 'Judul task maksimal 255 karakter.' })
  title?: string

  @ApiPropertyOptional({ description: 'Deskripsi task' })
  @IsOptional()
  @IsString({ message: 'Deskripsi harus berupa teks.' })
  description?: string

  @ApiPropertyOptional({ description: 'ID anggota tim yang ditugaskan' })
  @IsOptional()
  @IsUUID('all', { message: 'Format assigneeId tidak valid.' })
  assigneeId?: string | null

  @ApiPropertyOptional({
    description: 'Status task',
    enum: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'],
  })
  @IsOptional()
  @IsEnum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'], {
    message: 'Status task tidak valid.',
  })
  status?: 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE'

  @ApiPropertyOptional({
    description: 'Prioritas task',
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
  })
  @IsOptional()
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'], {
    message: 'Prioritas task tidak valid.',
  })
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

  @ApiPropertyOptional({ description: 'Tenggat waktu pengerjaan (ISO8601)' })
  @IsOptional()
  @IsDateString({}, { message: 'Format tenggat waktu tidak valid.' })
  dueDate?: string | null

  @ApiPropertyOptional({
    description: 'Estimasi Story Point (skala Fibonacci KKN: 1, 2, 3, 5, 8)',
    example: 3,
  })
  @IsOptional()
  @IsEnum([1, 2, 3, 5, 8], {
    message: 'Skala Story Point hanya boleh 1, 2, 3, 5, atau 8. Estimasi > 8 wajib dipecah.',
  })
  storyPoints?: number | null

  @ApiPropertyOptional({
    description: 'Alasan perubahan Story Point (wajib jika task sudah pernah/sedang In Progress)',
    example: 'Klien meminta penambahan 3 variasi revisi desain poster',
  })
  @IsOptional()
  @IsString()
  spReason?: string

  @ApiPropertyOptional({
    description: 'Set true untuk override peringatan overcapacity jika utilisasi anggota > 100%',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  override?: boolean

  @ApiPropertyOptional({ description: 'Posisi urutan task dalam kolom' })
  @IsOptional()
  @IsString()
  position?: string

  @ApiPropertyOptional({ description: 'Status kendala/blocker' })
  @IsOptional()
  @IsBoolean()
  isBlocked?: boolean

  @ApiPropertyOptional({ description: 'Alasan blocker/hambatan jika ada' })
  @IsOptional()
  @IsString()
  blockedReason?: string | null

  @ApiPropertyOptional({ description: 'Jumlah revisi' })
  @IsOptional()
  @IsInt()
  @Min(0)
  revisionCount?: number
}
