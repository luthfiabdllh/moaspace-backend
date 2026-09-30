import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator'

export class RespondInfoDto {
  @ApiProperty({
    description: 'Data brief yang telah diperbarui atau dilengkapi',
  })
  @IsObject()
  @IsNotEmpty({ message: 'Brief tidak boleh kosong' })
  brief: Record<string, unknown>

  @ApiPropertyOptional({
    description: 'Catatan tanggapan pemohon terkait informasi tambahan',
  })
  @IsOptional()
  @IsString()
  note?: string
}
