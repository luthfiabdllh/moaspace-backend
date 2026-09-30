import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator'

export class QueryTasksDto {
  @ApiPropertyOptional({ description: 'Filter berdasarkan ID Story' })
  @IsOptional()
  @IsUUID('all', { message: 'Format storyId tidak valid.' })
  storyId?: string

  @ApiPropertyOptional({ description: 'Filter berdasarkan ID divisi pemilik story' })
  @IsOptional()
  @IsUUID('all', { message: 'Format divisionId tidak valid.' })
  divisionId?: string

  @ApiPropertyOptional({ description: 'Filter berdasarkan ID assignee/pelaksana' })
  @IsOptional()
  @IsUUID('all', { message: 'Format assigneeId tidak valid.' })
  assigneeId?: string

  @ApiPropertyOptional({
    description: 'Filter berdasarkan status task',
    enum: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'],
  })
  @IsOptional()
  @IsEnum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'])
  status?: 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE'

  @ApiPropertyOptional({
    description: 'Filter berdasarkan prioritas task',
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
  })
  @IsOptional()
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

  @ApiPropertyOptional({ description: 'Pencarian kata kunci judul atau deskripsi task' })
  @IsOptional()
  @IsString()
  search?: string
}
