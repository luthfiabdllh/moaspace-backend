import { ApiProperty } from '@nestjs/swagger'
import { IsEnum } from 'class-validator'

export class UpdateUserStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'], example: 'ACTIVE', description: 'Status pengguna' })
  @IsEnum(['ACTIVE', 'INACTIVE'], { message: 'Status harus bernilai ACTIVE atau INACTIVE' })
  status!: 'ACTIVE' | 'INACTIVE'
}
