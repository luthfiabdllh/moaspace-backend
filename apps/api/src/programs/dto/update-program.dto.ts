import { ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator'

export class UpdateProgramDto {
  @ApiPropertyOptional({
    description: 'Nama / Judul Program Kerja KKN',
    example: 'Sosialisasi & Pembuatan Bank Sampah Dusun',
  })
  @IsOptional()
  @IsString({ message: 'Judul program kerja harus berupa teks.' })
  @MaxLength(255, { message: 'Judul program kerja maksimal 255 karakter.' })
  title?: string

  @ApiPropertyOptional({
    description: 'Deskripsi lengkap program kerja',
  })
  @IsOptional()
  @IsString({ message: 'Deskripsi harus berupa teks.' })
  description?: string

  @ApiPropertyOptional({
    description: 'Lingkup pelaksanaan',
    enum: ['UNIT', 'SUBUNIT'],
  })
  @IsOptional()
  @IsEnum(['UNIT', 'SUBUNIT'], { message: 'Lingkup harus UNIT atau SUBUNIT.' })
  scope?: 'UNIT' | 'SUBUNIT'

  @ApiPropertyOptional({
    description: 'ID Subunit posko',
  })
  @IsOptional()
  @IsUUID('all', { message: 'Format ID subunit tidak valid.' })
  subunitId?: string

  @ApiPropertyOptional({
    description: 'Klaster keilmuan penanggung jawab',
    enum: ['SAINTEK', 'SOSHUM', 'MEDIKA', 'AGRO', 'UNIT_SHARED'],
  })
  @IsOptional()
  @IsEnum(['SAINTEK', 'SOSHUM', 'MEDIKA', 'AGRO', 'UNIT_SHARED'], {
    message: 'Klaster tidak valid.',
  })
  cluster?: 'SAINTEK' | 'SOSHUM' | 'MEDIKA' | 'AGRO' | 'UNIT_SHARED'

  @ApiPropertyOptional({
    description: 'ID Pengguna yang menjadi PIC Utama',
  })
  @IsOptional()
  @IsUUID('all', { message: 'Format ID PIC Utama tidak valid.' })
  primaryPicId?: string

  @ApiPropertyOptional({
    description: 'Status siklus program kerja',
    enum: ['PROPOSED', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
  })
  @IsOptional()
  @IsEnum(['PROPOSED', 'ACTIVE', 'COMPLETED', 'CANCELLED'], {
    message: 'Status program kerja tidak valid.',
  })
  status?: 'PROPOSED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

  @ApiPropertyOptional({
    description: 'Tanggal mulai pelaksanaan (ISO8601)',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Format tanggal mulai tidak valid.' })
  startDate?: string

  @ApiPropertyOptional({
    description: 'Tanggal selesai pelaksanaan (ISO8601)',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Format tanggal selesai tidak valid.' })
  endDate?: string
}
