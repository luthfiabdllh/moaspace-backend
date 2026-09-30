import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsNotEmpty, IsString } from 'class-validator'

export class AddUserDivisionDto {
  @ApiProperty({ description: 'ID divisi yang akan ditambahkan' })
  @IsString()
  @IsNotEmpty({ message: 'Divisi wajib dipilih' })
  divisionId!: string

  @ApiProperty({
    enum: ['MEMBER', 'COORDINATOR'],
    example: 'MEMBER',
    description: 'Role anggota di divisi ini',
  })
  @IsEnum(['MEMBER', 'COORDINATOR'], {
    message: 'Role harus berupa MEMBER atau COORDINATOR',
  })
  role!: 'MEMBER' | 'COORDINATOR'
}
