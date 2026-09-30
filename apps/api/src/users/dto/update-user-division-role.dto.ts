import { ApiProperty } from '@nestjs/swagger'
import { IsEnum } from 'class-validator'

export class UpdateUserDivisionRoleDto {
  @ApiProperty({
    enum: ['MEMBER', 'COORDINATOR'],
    example: 'COORDINATOR',
    description: 'Role baru anggota di divisi ini',
  })
  @IsEnum(['MEMBER', 'COORDINATOR'], {
    message: 'Role harus berupa MEMBER atau COORDINATOR',
  })
  role!: 'MEMBER' | 'COORDINATOR'
}
