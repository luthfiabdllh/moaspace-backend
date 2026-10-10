import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator'

export class AddProgramMemberDto {
  @ApiProperty({ description: 'ID Pengguna anggota tim pelaksana' })
  @IsNotEmpty({ message: 'User ID tidak boleh kosong.' })
  @IsUUID('all', { message: 'Format ID pengguna tidak valid.' })
  userId!: string

  @ApiProperty({
    description: 'Peran anggota dalam program kerja (CO_PIC atau MEMBER)',
    enum: ['CO_PIC', 'MEMBER'],
    default: 'MEMBER',
  })
  @IsNotEmpty({ message: 'Peran anggota wajib ditentukan.' })
  @IsEnum(['CO_PIC', 'MEMBER'], {
    message: 'Peran harus CO_PIC atau MEMBER.',
  })
  role!: 'CO_PIC' | 'MEMBER'
}
