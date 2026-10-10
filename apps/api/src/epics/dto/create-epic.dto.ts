import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator'

export class CreateEpicDto {
  @ApiProperty({ description: 'Judul epic pekerjaan', example: 'Penyusunan Konten Edukasi Digital' })
  @IsNotEmpty({ message: 'Judul epic tidak boleh kosong.' })
  @IsString({ message: 'Judul epic harus berupa teks.' })
  @MaxLength(255, { message: 'Judul epic maksimal 255 karakter.' })
  title!: string

  @ApiPropertyOptional({ description: 'Deskripsi lengkap epic' })
  @IsOptional()
  @IsString({ message: 'Deskripsi harus berupa teks.' })
  description?: string

  @ApiPropertyOptional({ description: 'Tanggal mulai (ISO8601)', example: '2026-10-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString({}, { message: 'Format tanggal mulai tidak valid.' })
  startDate?: string

  @ApiPropertyOptional({ description: 'Tanggal selesai (ISO8601)', example: '2026-10-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString({}, { message: 'Format tanggal selesai tidak valid.' })
  endDate?: string

  @ApiPropertyOptional({ description: 'Tag program kerja KKN terkait', example: 'PROKER-01' })
  @IsOptional()
  @IsString({ message: 'Tag proker harus berupa teks.' })
  @MaxLength(100, { message: 'Tag proker maksimal 100 karakter.' })
  prokerTag?: string

  @ApiPropertyOptional({ description: 'ID Program Kerja KKN induk', example: 'uuid' })
  @IsOptional()
  @IsUUID('all', { message: 'Format ID program kerja tidak valid.' })
  programId?: string

  @ApiProperty({
    description: 'Cakupan epic (DIVISION = khusus satu divisi, CROSS = lintas divisi)',
    enum: ['DIVISION', 'CROSS'],
    default: 'DIVISION',
  })
  @IsNotEmpty({ message: 'Scope epic wajib diisi.' })
  @IsEnum(['DIVISION', 'CROSS'], {
    message: 'Scope harus DIVISION atau CROSS.',
  })
  scope!: 'DIVISION' | 'CROSS'

  @ApiPropertyOptional({
    description: 'ID divisi pemilik (wajib jika scope DIVISION)',
  })
  @IsOptional()
  @IsUUID('all', { message: 'Format ID divisi pemilik tidak valid.' })
  ownerDivisionId?: string

  @ApiPropertyOptional({
    description: 'Daftar ID divisi yang berpartisipasi (khusus jika scope CROSS)',
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Participating division IDs harus berupa array.' })
  @IsUUID('all', { each: true, message: 'Format ID divisi peserta tidak valid.' })
  participatingDivisionIds?: string[]
}
