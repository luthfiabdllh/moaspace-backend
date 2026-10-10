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

export class CreateProgramDto {
  @ApiProperty({
    description: 'Nama / Judul Program Kerja KKN',
    example: 'Sosialisasi & Pembuatan Bank Sampah Dusun',
  })
  @IsNotEmpty({ message: 'Judul program kerja tidak boleh kosong.' })
  @IsString({ message: 'Judul program kerja harus berupa teks.' })
  @MaxLength(255, { message: 'Judul program kerja maksimal 255 karakter.' })
  title!: string

  @ApiPropertyOptional({
    description: 'Deskripsi lengkap, latar belakang, dan tujuan program kerja',
  })
  @IsOptional()
  @IsString({ message: 'Deskripsi harus berupa teks.' })
  description?: string

  @ApiProperty({
    description: 'Lingkup pelaksanaan (UNIT = seluruh unit, SUBUNIT = posko dusun tertentu)',
    enum: ['UNIT', 'SUBUNIT'],
    default: 'SUBUNIT',
  })
  @IsNotEmpty({ message: 'Lingkup program kerja wajib dipilih.' })
  @IsEnum(['UNIT', 'SUBUNIT'], { message: 'Lingkup harus UNIT atau SUBUNIT.' })
  scope!: 'UNIT' | 'SUBUNIT'

  @ApiPropertyOptional({
    description: 'ID Subunit posko (wajib jika scope adalah SUBUNIT)',
  })
  @IsOptional()
  @IsUUID('all', { message: 'Format ID subunit tidak valid.' })
  subunitId?: string

  @ApiProperty({
    description: 'Klaster keilmuan penanggung jawab',
    enum: ['SAINTEK', 'SOSHUM', 'MEDIKA', 'AGRO', 'UNIT_SHARED'],
    default: 'UNIT_SHARED',
  })
  @IsNotEmpty({ message: 'Klaster keilmuan wajib dipilih.' })
  @IsEnum(['SAINTEK', 'SOSHUM', 'MEDIKA', 'AGRO', 'UNIT_SHARED'], {
    message: 'Klaster tidak valid.',
  })
  cluster!: 'SAINTEK' | 'SOSHUM' | 'MEDIKA' | 'AGRO' | 'UNIT_SHARED'

  @ApiProperty({
    description: 'ID Pengguna yang menjadi PIC Utama',
  })
  @IsNotEmpty({ message: 'PIC Utama wajib ditentukan.' })
  @IsUUID('all', { message: 'Format ID PIC Utama tidak valid.' })
  primaryPicId!: string

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

  @ApiPropertyOptional({
    description: 'Daftar ID Pengguna sebagai Co-PIC',
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Co-PIC harus berupa array ID pengguna.' })
  @IsUUID('all', { each: true, message: 'Format ID Co-PIC tidak valid.' })
  coPicIds?: string[]

  @ApiPropertyOptional({
    description: 'Daftar ID Pengguna sebagai anggota tim pelaksana',
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Daftar anggota harus berupa array ID pengguna.' })
  @IsUUID('all', { each: true, message: 'Format ID anggota tim tidak valid.' })
  memberIds?: string[]
}
