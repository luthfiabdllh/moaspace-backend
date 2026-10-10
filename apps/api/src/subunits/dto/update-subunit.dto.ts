import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString } from 'class-validator'

export class UpdateSubunitDto {
  @ApiPropertyOptional({ example: 'Subunit 1 - Dusun Karangrejo Baru', description: 'Nama Subunit / Posko KKN' })
  @IsString()
  @IsOptional()
  name?: string

  @ApiPropertyOptional({ example: 'Balai Dusun Karangrejo RT 02 / RW 01', description: 'Alamat fisik / lokasi posko' })
  @IsString()
  @IsOptional()
  location?: string

  @ApiPropertyOptional({ example: 'Fokus program pemberdayaan UMKM dan sanitasi lingkungan', description: 'Deskripsi posko subunit' })
  @IsString()
  @IsOptional()
  description?: string
}
