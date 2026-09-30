import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator'

export class ChangePasswordDto {
  @ApiPropertyOptional({
    description:
      'Kata sandi saat ini (wajib jika akun sebelumnya sudah memiliki kata sandi)',
  })
  @IsOptional()
  @IsString()
  currentPassword?: string

  @ApiProperty({
    example: 'rahasia123',
    description: 'Kata sandi baru (minimal 8 karakter)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Kata sandi baru tidak boleh kosong' })
  @MinLength(8, { message: 'Kata sandi baru minimal 8 karakter' })
  newPassword!: string
}
