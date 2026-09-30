import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'

export class ReviewCapacityRequestDto {
  @ApiProperty({
    example: 'APPROVE',
    enum: ['APPROVE', 'REJECT'],
    description: 'Tindakan persetujuan: APPROVE atau REJECT',
  })
  @IsIn(['APPROVE', 'REJECT'], {
    message: 'Tindakan hanya boleh APPROVE atau REJECT.',
  })
  action!: 'APPROVE' | 'REJECT'

  @ApiPropertyOptional({
    example: 6,
    description: 'Kapasitas final yang disetujui (opsional jika ingin mengubah nilai dari requestedSp)',
  })
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Kapasitas SP minimal 1.' })
  @Max(30, { message: 'Kapasitas SP maksimal 30.' })
  approvedSp?: number

  @ApiPropertyOptional({
    example: 'Kapasitas tetap 10 SP karena acara kampus diadakan di luar jam kerja KKN.',
    description: 'Catatan reviewer jika menolak atau mengubah nilai',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Catatan peninjauan maksimal 500 karakter.' })
  note?: string
}
