import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import type { TemplateFieldDefinition } from '@moaspace/database'

export class TemplateFieldDto implements TemplateFieldDefinition {
  @ApiProperty({ description: 'Key unik untuk field form' })
  @IsString()
  @IsNotEmpty()
  key: string

  @ApiProperty({ description: 'Label tampilan field form' })
  @IsString()
  @IsNotEmpty()
  label: string

  @ApiProperty({
    description: 'Tipe field',
    enum: ['text', 'textarea', 'select', 'date', 'number'],
  })
  @IsIn(['text', 'textarea', 'select', 'date', 'number'])
  type: 'text' | 'textarea' | 'select' | 'date' | 'number'

  @ApiProperty({ description: 'Wajib diisi atau opsional' })
  @IsBoolean()
  required: boolean

  @ApiPropertyOptional({
    description: 'Pilihan opsi jika tipe select',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[]

  @ApiPropertyOptional({ description: 'Teks placeholder input' })
  @IsOptional()
  @IsString()
  placeholder?: string
}

export class CreateRequestTemplateDto {
  @ApiProperty({
    description: 'Nama template request (contoh: Permohonan Desain Media Kreatif)',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty({ message: 'Nama template tidak boleh kosong' })
  @MaxLength(255)
  name: string

  @ApiPropertyOptional({ description: 'Deskripsi tujuan permohonan template ini' })
  @IsOptional()
  @IsString()
  description?: string

  @ApiProperty({
    description: 'Daftar field dinamis yang harus diisi pemohon',
    type: [TemplateFieldDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateFieldDto)
  fields: TemplateFieldDto[]
}
