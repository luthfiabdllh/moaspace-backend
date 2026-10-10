import { ApiProperty } from '@nestjs/swagger'
import { IsEnum } from 'class-validator'

export class UpdateSubunitMemberRoleDto {
  @ApiProperty({
    enum: ['MEMBER', 'COORDINATOR'],
    example: 'COORDINATOR',
    description: 'Peran anggota di subunit (COORDINATOR = Koordinator Mahasiswa Subunit / Kormasit)',
  })
  @IsEnum(['MEMBER', 'COORDINATOR'], {
    message: 'Role harus berupa MEMBER atau COORDINATOR',
  })
  role!: 'MEMBER' | 'COORDINATOR'
}
