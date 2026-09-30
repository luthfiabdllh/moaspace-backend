import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator'

export class QueryBoardDto {
  @ApiPropertyOptional({ description: 'Filter berdasarkan ID assignee' })
  @IsOptional()
  @IsUUID('all', { message: 'Format assigneeId tidak valid.' })
  assigneeId?: string

  @ApiPropertyOptional({ description: 'Filter berdasarkan ID epic' })
  @IsOptional()
  @IsUUID('all', { message: 'Format epicId tidak valid.' })
  epicId?: string

  @ApiPropertyOptional({ description: 'Filter berdasarkan tag program kerja' })
  @IsOptional()
  @IsString()
  prokerTag?: string

  @ApiPropertyOptional({
    description: 'Filter berdasarkan prioritas',
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
  })
  @IsOptional()
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'], {
    message: 'Prioritas tidak valid.',
  })
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

  @ApiPropertyOptional({ description: 'Filter task yang terkena kendala/blocker' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isBlocked?: boolean

  @ApiPropertyOptional({ description: 'Kata kunci pencarian judul task' })
  @IsOptional()
  @IsString()
  search?: string
}
