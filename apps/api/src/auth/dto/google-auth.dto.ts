import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString } from 'class-validator'

export class GoogleAuthDto {
  @ApiProperty({ description: 'Google ID token from Google OAuth popup / library' })
  @IsString()
  @IsNotEmpty({ message: 'ID token Google tidak boleh kosong' })
  idToken!: string
}
