import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator'

export class LoginDto {
  @ApiProperty({ example: 'admin@moaspace.com', description: 'Registered user email' })
  @IsEmail({}, { message: 'Format email tidak valid' })
  @IsNotEmpty({ message: 'Email tidak boleh kosong' })
  email!: string

  @ApiProperty({ example: 'admin123', description: 'User password (minimum 8 characters)' })
  @IsString()
  @MinLength(8, { message: 'Kata sandi minimal 8 karakter' })
  @IsNotEmpty({ message: 'Kata sandi tidak boleh kosong' })
  password!: string

  @ApiPropertyOptional({ example: true, description: 'Ingat saya untuk sesi panjang (30 hari)' })
  @IsOptional()
  @IsBoolean({ message: 'Format rememberMe harus boolean' })
  rememberMe?: boolean
}
