import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator'

export class CreateTaskDto {
  @ApiProperty({ description: 'ID Story induk tempat task ini bernaung' })
  @IsNotEmpty({ message: 'Story ID wajib diisi.' })
  @IsUUID('all', { message: 'Format storyId tidak valid.' })
  storyId!: string

  @ApiProperty({ description: 'Judul unit kerja task', example: 'Buat ilustrasi maskot Moa' })
  @IsNotEmpty({ message: 'Judul task tidak boleh kosong.' })
  @IsString({ message: 'Judul task harus berupa teks.' })
  @MaxLength(255, { message: 'Judul task maksimal 255 karakter.' })
  title!: string

  @ApiPropertyOptional({ description: 'Deskripsi detail pekerjaan task' })
  @IsOptional()
  @IsString({ message: 'Deskripsi harus berupa teks.' })
  description?: string

  @ApiPropertyOptional({ description: 'ID anggota tim yang ditugaskan' })
  @IsOptional()
  @IsUUID('all', { message: 'Format assigneeId tidak valid.' })
  assigneeId?: string

  @ApiPropertyOptional({
    description: 'Status awal task',
    enum: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'],
    default: 'BACKLOG',
  })
  @IsOptional()
  @IsEnum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'], {
    message: 'Status task tidak valid.',
  })
  status?: 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE'

  @ApiPropertyOptional({
    description: 'Prioritas task',
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
    default: 'MEDIUM',
  })
  @IsOptional()
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'], {
    message: 'Prioritas task tidak valid.',
  })
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

  @ApiPropertyOptional({ description: 'Tenggat waktu pengerjaan (ISO8601)' })
  @IsOptional()
  @IsDateString({}, { message: 'Format tenggat waktu tidak valid.' })
  dueDate?: string

  @ApiPropertyOptional({
    description: 'Estimasi Story Point (skala Fibonacci KKN: 1, 2, 3, 5, 8)',
    example: 3,
  })
  @IsOptional()
  @IsEnum([1, 2, 3, 5, 8], {
    message: 'Skala Story Point hanya boleh 1, 2, 3, 5, atau 8. Estimasi > 8 wajib dipecah.',
  })
  storyPoints?: number

  @ApiPropertyOptional({
    description: 'Set true untuk override peringatan overcapacity jika utilisasi anggota > 100%',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  override?: boolean

  @ApiPropertyOptional({ description: 'Posisi urutan task dalam kolom (fractional index)' })
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
  blockedReason?: string
}
