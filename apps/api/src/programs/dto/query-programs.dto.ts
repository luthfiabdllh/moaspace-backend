import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator'

export class QueryProgramsDto {
  @ApiPropertyOptional({
    description: 'Filter berdasarkan lingkup (UNIT / SUBUNIT)',
    enum: ['UNIT', 'SUBUNIT'],
  })
  @IsOptional()
  @IsEnum(['UNIT', 'SUBUNIT'])
  scope?: 'UNIT' | 'SUBUNIT'

  @ApiPropertyOptional({
    description: 'Filter berdasarkan Subunit posko',
  })
  @IsOptional()
  @IsUUID('all')
  subunitId?: string

  @ApiPropertyOptional({
    description: 'Filter berdasarkan klaster keilmuan',
    enum: ['SAINTEK', 'SOSHUM', 'MEDIKA', 'AGRO', 'UNIT_SHARED'],
  })
  @IsOptional()
  @IsEnum(['SAINTEK', 'SOSHUM', 'MEDIKA', 'AGRO', 'UNIT_SHARED'])
  cluster?: 'SAINTEK' | 'SOSHUM' | 'MEDIKA' | 'AGRO' | 'UNIT_SHARED'

  @ApiPropertyOptional({
    description: 'Filter berdasarkan status program',
    enum: ['PROPOSED', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
  })
  @IsOptional()
  @IsEnum(['PROPOSED', 'ACTIVE', 'COMPLETED', 'CANCELLED'])
  status?: 'PROPOSED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

  @ApiPropertyOptional({
    description: 'Filter berdasarkan PIC Utama',
  })
  @IsOptional()
  @IsUUID('all')
  primaryPicId?: string

  @ApiPropertyOptional({
    description: 'Pencarian kata kunci pada judul atau deskripsi',
  })
  @IsOptional()
  @IsString()
  search?: string
}
