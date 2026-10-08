import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString } from 'class-validator'

export class ConfirmRequestDto {
  @ApiProperty({
    description: 'Aksi konfirmasi hasil kerja oleh pemohon',
    enum: ['CONFIRM', 'REVISION'],
  })
  @IsIn(['CONFIRM', 'REVISION'], {
    message: 'Aksi harus berupa CONFIRM atau REVISION',
  })
  action: 'CONFIRM' | 'REVISION'

  @ApiPropertyOptional({
    description:
      'Catatan atau alasan jika mengajukan REVISION (wajib jika action REVISION). ' +
      'Berupa HTML rich-text dari editor TipTap, boleh menyertakan gambar.',
  })
  @IsOptional()
  @IsString()
  reason?: string
}
