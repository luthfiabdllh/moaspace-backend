import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString, MaxLength } from 'class-validator'

export class BlockTaskDto {
  @ApiProperty({
    description: 'Alasan kendala / blocker yang dialami',
    example: 'Menunggu asset desain dari divisi Media Kreatif',
  })
  @IsNotEmpty({ message: 'Alasan kendala wajib diisi.' })
  @IsString({ message: 'Alasan kendala harus berupa teks.' })
  @MaxLength(500, { message: 'Alasan kendala maksimal 500 karakter.' })
  reason!: string
}
