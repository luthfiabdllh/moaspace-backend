import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class CreateSubunitDto {
  @ApiProperty({ example: 'Subunit 1 - Dusun Karangrejo', description: 'Nama Subunit / Posko KKN' })
  @IsString()
  @IsNotEmpty({ message: 'Nama subunit tidak boleh kosong' })
  name!: string

  @ApiPropertyOptional({ example: 'karangrejo', description: 'Slug URL unik (otomatis di-generate jika kosong)' })
  @IsString()
  @IsOptional()
  slug?: string

  @ApiPropertyOptional({ example: 'Balai Dusun Karangrejo RT 02 / RW 01', description: 'Alamat fisik / lokasi posko' })
  @IsString()
  @IsOptional()
  location?: string

  @ApiPropertyOptional({ example: 'Fokus program pemberdayaan UMKM dan sanitasi lingkungan', description: 'Deskripsi posko subunit' })
  @IsString()
  @IsOptional()
  description?: string
}
