import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString } from 'class-validator'

export class QueryRequestsDto {
  @ApiPropertyOptional({
    description: 'Arah request berdasarkan peran divisi pengguna',
    enum: ['incoming', 'outgoing', 'all'],
    default: 'all',
  })
  @IsOptional()
  @IsIn(['incoming', 'outgoing', 'all'])
  direction?: 'incoming' | 'outgoing' | 'all' = 'all'

  @ApiPropertyOptional({
    description: 'Filter spesifik berdasarkan ID Divisi',
  })
  @IsOptional()
  @IsString()
  divisionId?: string

  @ApiPropertyOptional({
    description: 'Filter berdasarkan status request',
    enum: [
      'DRAFT',
      'WAITING_ORIGIN_APPROVAL',
      'SUBMITTED',
      'NEED_INFO',
      'REJECTED',
      'ACCEPTED',
      'IN_PROGRESS',
      'DELIVERED',
      'REVISION',
      'CONFIRMED',
    ],
  })
  @IsOptional()
  @IsIn([
    'DRAFT',
    'WAITING_ORIGIN_APPROVAL',
    'SUBMITTED',
    'NEED_INFO',
    'REJECTED',
    'ACCEPTED',
    'IN_PROGRESS',
    'DELIVERED',
    'REVISION',
    'CONFIRMED',
  ])
  status?:
    | 'DRAFT'
    | 'WAITING_ORIGIN_APPROVAL'
    | 'SUBMITTED'
    | 'NEED_INFO'
    | 'REJECTED'
    | 'ACCEPTED'
    | 'IN_PROGRESS'
    | 'DELIVERED'
    | 'REVISION'
    | 'CONFIRMED'

  @ApiPropertyOptional({
    description: 'Pencarian teks pada judul request',
  })
  @IsOptional()
  @IsString()
  search?: string
}
