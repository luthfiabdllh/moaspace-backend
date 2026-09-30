import { ApiProperty } from '@nestjs/swagger'
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import type { DeliveryAttachment } from '@moaspace/database'

export class DeliveryAttachmentDto implements DeliveryAttachment {
  @ApiProperty({ description: 'Judul lampiran hasil (contoh: Desain Poster Final A3)' })
  @IsString()
  @IsNotEmpty()
  title: string

  @ApiProperty({
    description: 'URL file atau tautan Google Drive / Cloud Storage',
    example: 'https://drive.google.com/file/d/xyz/view',
  })
  @IsString()
  @IsNotEmpty()
  url: string
}

export class DeliverRequestDto {
  @ApiProperty({
    description: 'Catatan pengiriman hasil kerja ke pemohon',
    example: 'Hasil desain poster sudah selesai sesuai revisi ukuran A3.',
  })
  @IsString()
  @IsNotEmpty({ message: 'Catatan pengiriman hasil wajib diisi' })
  deliveryNotes: string

  @ApiProperty({
    description: 'Daftar berkas atau tautan hasil kerja (minimal 1 berkas/link)',
    type: [DeliveryAttachmentDto],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Minimal harus ada 1 tautan/lampiran hasil kerja' })
  @ValidateNested({ each: true })
  @Type(() => DeliveryAttachmentDto)
  deliveryAttachments: DeliveryAttachmentDto[]
}
