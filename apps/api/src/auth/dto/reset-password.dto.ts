import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString, MinLength } from 'class-validator'

export class ResetPasswordDto {
  @ApiProperty({ description: 'Password reset token received via email' })
  @IsString()
  @IsNotEmpty({ message: 'Token reset tidak boleh kosong' })
  token!: string

  @ApiProperty({ example: 'NewPassword123', description: 'New password (minimum 8 characters)' })
  @IsString()
  @MinLength(8, { message: 'Kata sandi baru minimal 8 karakter' })
  @IsNotEmpty({ message: 'Kata sandi tidak boleh kosong' })
  password!: string
}
