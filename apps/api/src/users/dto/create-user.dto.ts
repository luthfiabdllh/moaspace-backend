import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsEnum, IsNotEmpty, IsString } from 'class-validator'

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
}
