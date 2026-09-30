import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator'

export class CreateStoryDto {
  @ApiProperty({ description: 'ID divisi yang bertanggung jawab atas story ini' })
  @IsNotEmpty({ message: 'Division ID wajib diisi.' })
  @IsUUID('all', { message: 'Format divisionId tidak valid.' })
  divisionId!: string

  @ApiPropertyOptional({ description: 'ID Epic induk (opsional jika pekerjaan rutin divisi)' })
  @IsOptional()
  @IsUUID('all', { message: 'Format epicId tidak valid.' })
  epicId?: string

  @ApiProperty({ description: 'Judul deliverable story', example: 'Desain Banner Utama & Template Feed IG' })
  @IsNotEmpty({ message: 'Judul story tidak boleh kosong.' })
  @IsString({ message: 'Judul story harus berupa teks.' })
  @MaxLength(255, { message: 'Judul story maksimal 255 karakter.' })
  title!: string

  @ApiPropertyOptional({ description: 'Kriteria selesai (Definition of Done)' })
  @IsOptional()
  @IsString({ message: 'Kriteria selesai harus berupa teks.' })
  doneCriteria?: string

  @ApiPropertyOptional({ description: 'Target tanggal penyelesaian (ISO8601)' })
  @IsOptional()
  @IsDateString({}, { message: 'Format target tanggal tidak valid.' })
  targetDate?: string

  @ApiPropertyOptional({ description: 'Tag program kerja terkait' })
  @IsOptional()
  @IsString({ message: 'Tag proker harus berupa teks.' })
  @MaxLength(100, { message: 'Tag proker maksimal 100 karakter.' })
  prokerTag?: string

  @ApiPropertyOptional({ description: 'ID tiket request asal (jika dilahirkan dari request divisi)' })
  @IsOptional()
  @IsString()
  sourceRequestId?: string
}
