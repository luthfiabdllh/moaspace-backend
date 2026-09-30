import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString } from 'class-validator'

export class TriageRequestDto {
  @ApiProperty({
    description: 'Aksi triage koordinator divisi tujuan',
    enum: ['ACCEPT', 'REJECT', 'NEED_INFO'],
  })
  @IsIn(['ACCEPT', 'REJECT', 'NEED_INFO'], {
    message: 'Aksi triage harus berupa ACCEPT, REJECT, atau NEED_INFO',
  })
  action: 'ACCEPT' | 'REJECT' | 'NEED_INFO'

  @ApiPropertyOptional({
    description:
      'Alasan penolakan atau penjelasan informasi yang dibutuhkan (wajib jika REJECT atau NEED_INFO)',
  })
  @IsOptional()
  @IsString()
  reason?: string
}
