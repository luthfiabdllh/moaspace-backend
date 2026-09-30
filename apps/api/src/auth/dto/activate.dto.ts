import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString, MinLength } from 'class-validator'

export class ActivateDto {
  @ApiProperty({ description: 'One-time activation token received via email' })
  @IsString()
  @IsNotEmpty({ message: 'Token aktivasi tidak boleh kosong' })
  token!: string

  @ApiProperty({ example: 'NewSecretPass123', description: 'New password (minimum 8 characters)' })
  @IsString()
  @MinLength(8, { message: 'Kata sandi baru minimal 8 karakter' })
  @IsNotEmpty({ message: 'Kata sandi tidak boleh kosong' })
  password!: string
}
