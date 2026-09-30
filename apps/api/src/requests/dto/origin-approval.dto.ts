import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString } from 'class-validator'

export class OriginApprovalDto {
  @ApiProperty({
    description: 'Aksi persetujuan koordinator divisi asal',
    enum: ['APPROVE', 'REJECT'],
  })
  @IsIn(['APPROVE', 'REJECT'], { message: 'Aksi harus berupa APPROVE atau REJECT' })
  action: 'APPROVE' | 'REJECT'

  @ApiPropertyOptional({
    description: 'Alasan jika ditolak secara internal (wajib jika action REJECT)',
  })
  @IsOptional()
  @IsString()
  reason?: string
}
