import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class CreateUserDto {
  @ApiProperty({ example: 'ahmad@moaspace.com', description: 'Alamat email anggota' })
  @IsEmail({}, { message: 'Format email tidak valid' })
  @IsNotEmpty({ message: 'Email tidak boleh kosong' })
  email!: string

  @ApiProperty({ example: 'Ahmad Fauzi', description: 'Nama lengkap anggota' })
  @IsString()
  @IsNotEmpty({ message: 'Nama lengkap tidak boleh kosong' })
  name!: string

  @ApiProperty({ description: 'ID divisi penempatan' })
  @IsString()
  @IsNotEmpty({ message: 'Divisi wajib dipilih' })
  divisionId!: string

  @ApiProperty({
    enum: ['MEMBER', 'COORDINATOR', 'KORMANIT', 'KOORDINATOR_MAHASISWA_UNIT'],
    example: 'MEMBER',
    description: 'Role anggota di divisi atau Koordinator Mahasiswa Unit (Akses Penuh)',
  })
  @IsEnum(['MEMBER', 'COORDINATOR', 'KORMANIT', 'KOORDINATOR_MAHASISWA_UNIT'], {
    message: 'Role harus berupa MEMBER, COORDINATOR, atau KOORDINATOR_MAHASISWA_UNIT',
  })
  role!: 'MEMBER' | 'COORDINATOR' | 'KORMANIT' | 'KOORDINATOR_MAHASISWA_UNIT'

  @ApiPropertyOptional({
    enum: ['SAINTEK', 'SOSHUM', 'MEDIKA', 'AGRO'],
    example: 'SAINTEK',
    description: 'Klaster keilmuan mahasiswa KKN',
  })
  @IsEnum(['SAINTEK', 'SOSHUM', 'MEDIKA', 'AGRO'], {
    message: 'Klaster harus berupa SAINTEK, SOSHUM, MEDIKA, atau AGRO',
  })
  @IsOptional()
  cluster?: 'SAINTEK' | 'SOSHUM' | 'MEDIKA' | 'AGRO'

  @ApiPropertyOptional({
    example: false,
    description: 'Status Koordinator Mahasiswa Klaster (Kormater)',
  })
  @IsBoolean()
  @IsOptional()
  isClusterCoordinator?: boolean

  @ApiPropertyOptional({ description: 'ID subunit posko penempatan mahasiswa' })
  @IsString()
  @IsOptional()
  subunitId?: string

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

