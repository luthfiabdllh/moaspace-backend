import { ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { TemplateFieldDto } from './create-template.dto.js'

export class UpdateRequestTemplateDto {
  @ApiPropertyOptional({
    description: 'Nama template request',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string

  @ApiPropertyOptional({ description: 'Deskripsi tujuan permohonan' })
  @IsOptional()
  @IsString()
  description?: string

  @ApiPropertyOptional({
    description: 'Daftar field dinamis yang harus diisi pemohon',
    type: [TemplateFieldDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateFieldDto)
  fields?: TemplateFieldDto[]
}
