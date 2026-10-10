import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator'

export class UpdateUserAcademicDto {
  @ApiPropertyOptional({
    enum: ['SAINTEK', 'SOSHUM', 'MEDIKA', 'AGRO'],
    example: 'SAINTEK',
    description: 'Klaster keilmuan mahasiswa KKN',
  })
  @IsEnum(['SAINTEK', 'SOSHUM', 'MEDIKA', 'AGRO'], {
    message: 'Klaster harus berupa SAINTEK, SOSHUM, MEDIKA, atau AGRO',
  })
  @IsOptional()
  cluster?: 'SAINTEK' | 'SOSHUM' | 'MEDIKA' | 'AGRO' | null

  @ApiPropertyOptional({
    example: false,
    description: 'Status Koordinator Mahasiswa Klaster (Kormater)',
  })
  @IsBoolean()
  @IsOptional()
  isClusterCoordinator?: boolean

  @ApiPropertyOptional({ description: 'ID subunit posko penempatan mahasiswa (null jika ingin melepas)' })
  @IsString()
  @IsOptional()
  subunitId?: string | null

  @ApiPropertyOptional({
    enum: ['MEMBER', 'COORDINATOR'],
    example: 'MEMBER',
    description: 'Peran di subunit (COORDINATOR = Koordinator Mahasiswa Subunit / Kormasit)',
  })
  @IsEnum(['MEMBER', 'COORDINATOR'], {
    message: 'Role subunit harus berupa MEMBER atau COORDINATOR',
  })
  @IsOptional()
  subunitRole?: 'MEMBER' | 'COORDINATOR'
}
