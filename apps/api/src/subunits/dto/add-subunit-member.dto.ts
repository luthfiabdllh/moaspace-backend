import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsNotEmpty, IsString } from 'class-validator'

export class AddSubunitMemberDto {
  @ApiProperty({ description: 'ID pengguna yang akan ditambahkan ke subunit' })
  @IsString()
  @IsNotEmpty({ message: 'User ID tidak boleh kosong' })
  userId!: string

  @ApiProperty({
    enum: ['MEMBER', 'COORDINATOR'],
    example: 'MEMBER',
    description: 'Peran anggota di subunit (COORDINATOR = Koordinator Mahasiswa Subunit / Kormasit)',
  })
  @IsEnum(['MEMBER', 'COORDINATOR'], {
    message: 'Role harus berupa MEMBER atau COORDINATOR',
  })
  role!: 'MEMBER' | 'COORDINATOR'
}
