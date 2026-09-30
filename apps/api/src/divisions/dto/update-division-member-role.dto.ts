import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsNotEmpty } from 'class-validator'

export class UpdateDivisionMemberRoleDto {
  @ApiProperty({
    description: 'Peran baru dalam divisi (MEMBER atau COORDINATOR)',
    enum: ['MEMBER', 'COORDINATOR'],
  })
  @IsNotEmpty({ message: 'Peran divisi wajib dipilih.' })
  @IsEnum(['MEMBER', 'COORDINATOR'], {
    message: 'Peran harus salah satu dari: MEMBER, COORDINATOR.',
  })
  role!: 'MEMBER' | 'COORDINATOR'
}
