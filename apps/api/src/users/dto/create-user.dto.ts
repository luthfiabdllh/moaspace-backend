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

  @ApiProperty({ enum: ['MEMBER', 'COORDINATOR'], example: 'MEMBER', description: 'Role anggota di divisi' })
  @IsEnum(['MEMBER', 'COORDINATOR'], { message: 'Role harus berupa MEMBER atau COORDINATOR' })
  role!: 'MEMBER' | 'COORDINATOR'
}
