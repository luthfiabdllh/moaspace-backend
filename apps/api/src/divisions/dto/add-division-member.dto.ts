import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator'

export class AddDivisionMemberDto {
  @ApiProperty({ description: 'ID pengguna yang akan ditambahkan ke divisi' })
  @IsNotEmpty({ message: 'User ID tidak boleh kosong.' })
  @IsUUID('all', { message: 'Format User ID tidak valid.' })
  userId!: string

  @ApiProperty({
    description: 'Peran dalam divisi (MEMBER atau COORDINATOR)',
    enum: ['MEMBER', 'COORDINATOR'],
    default: 'MEMBER',
  })
  @IsNotEmpty({ message: 'Peran divisi wajib dipilih.' })
  @IsEnum(['MEMBER', 'COORDINATOR'], {
    message: 'Peran harus salah satu dari: MEMBER, COORDINATOR.',
  })
  role!: 'MEMBER' | 'COORDINATOR'
}
