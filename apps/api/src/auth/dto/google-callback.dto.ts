import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class GoogleCallbackDto {
  @ApiProperty({ description: 'Kode otorisasi dari Google OAuth 2.0 consent' })
  @IsString()
  @IsNotEmpty({ message: 'Kode otorisasi Google tidak boleh kosong' })
  code!: string

  @ApiPropertyOptional({ description: 'Redirect URI yang dipakai saat request otorisasi awal' })
  @IsString()
  @IsOptional()
  redirectUri?: string
}
