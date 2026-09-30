import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean } from 'class-validator'

export class UpdateUserGlobalRoleDto {
  @ApiProperty({
    example: true,
    description: 'Status peran Koordinator Mahasiswa Unit (akses penuh setara Super Admin)',
  })
  @IsBoolean()
  isKormanit!: boolean
}
