import { ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator'

export class UpdateEpicDto {
  @ApiPropertyOptional({ description: 'Judul epic pekerjaan' })
  @IsOptional()
  @IsString({ message: 'Judul epic harus berupa teks.' })
  @MaxLength(255, { message: 'Judul epic maksimal 255 karakter.' })
  title?: string

  @ApiPropertyOptional({ description: 'Deskripsi lengkap epic' })
  @IsOptional()
  @IsString({ message: 'Deskripsi harus berupa teks.' })
  description?: string

  @ApiPropertyOptional({ description: 'Tanggal mulai (ISO8601)' })
  @IsOptional()
  @IsDateString({}, { message: 'Format tanggal mulai tidak valid.' })
  startDate?: string

  @ApiPropertyOptional({ description: 'Tanggal selesai (ISO8601)' })
  @IsOptional()
  @IsDateString({}, { message: 'Format tanggal selesai tidak valid.' })
  endDate?: string

  @ApiPropertyOptional({ description: 'Tag program kerja KKN' })
  @IsOptional()
  @IsString({ message: 'Tag proker harus berupa teks.' })
  @MaxLength(100, { message: 'Tag proker maksimal 100 karakter.' })
  prokerTag?: string

  @ApiPropertyOptional({ description: 'ID Program Kerja KKN induk' })
  @IsOptional()
  @IsUUID('all', { message: 'Format ID program kerja tidak valid.' })
  programId?: string

  @ApiPropertyOptional({ description: 'ID divisi pemilik (khusus scope DIVISION)' })
  @IsOptional()
  @IsUUID('all', { message: 'Format ID divisi pemilik tidak valid.' })
  ownerDivisionId?: string

  @ApiPropertyOptional({
    description: 'Daftar ID divisi yang berpartisipasi (khusus scope CROSS)',
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Participating division IDs harus berupa array.' })
  @IsUUID('all', { each: true, message: 'Format ID divisi peserta tidak valid.' })
  participatingDivisionIds?: string[]

  @ApiPropertyOptional({ description: 'Tutup atau buka kembali epic pekerjaan' })
  @IsOptional()
  @IsBoolean({ message: 'isClosed harus berupa boolean.' })
  isClosed?: boolean
}
