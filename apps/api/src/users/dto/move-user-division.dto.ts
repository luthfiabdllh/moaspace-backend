import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class MoveUserDivisionDto {
  @ApiProperty({ description: 'ID divisi asal' })
  @IsString()
  @IsNotEmpty({ message: 'Divisi asal wajib dipilih' })
  fromDivisionId!: string

  @ApiProperty({ description: 'ID divisi tujuan' })
  @IsString()
  @IsNotEmpty({ message: 'Divisi tujuan wajib dipilih' })
  toDivisionId!: string

  @ApiPropertyOptional({
    enum: ['MEMBER', 'COORDINATOR'],
    description: 'Role di divisi tujuan (default mengikuti role di divisi asal)',
  })
  @IsOptional()
  @IsEnum(['MEMBER', 'COORDINATOR'], {
    message: 'Role harus berupa MEMBER atau COORDINATOR',
  })
  role?: 'MEMBER' | 'COORDINATOR'
}
