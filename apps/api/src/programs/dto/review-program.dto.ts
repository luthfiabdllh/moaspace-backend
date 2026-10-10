import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class ReviewProgramDto {
  @ApiProperty({
    description: 'Keputusan review (APPROVED atau REJECTED)',
    enum: ['APPROVED', 'REJECTED'],
    example: 'APPROVED',
  })
  @IsNotEmpty({ message: 'Keputusan review wajib diisi.' })
  @IsEnum(['APPROVED', 'REJECTED'], {
    message: 'Keputusan harus APPROVED atau REJECTED.',
  })
  decision!: 'APPROVED' | 'REJECTED'

  @ApiPropertyOptional({
    description: 'Catatan atau alasan penolakan/revisi jika ditolak',
    example: 'Harap sesuaikan tanggal kegiatan agar tidak bertabrakan dengan panen raya dusun.',
  })
  @IsOptional()
  @IsString({ message: 'Alasan review harus berupa teks.' })
  reason?: string
}
