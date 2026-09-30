import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString } from 'class-validator'

export class UpdateProfileDto {
  @ApiProperty({
    example: 'Ahmad Fauzi',
    description: 'Nama lengkap baru pengguna',
  })
  @IsString()
  @IsNotEmpty({ message: 'Nama lengkap tidak boleh kosong' })
  name!: string
}
