import { ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator'

export class UpdateStoryDto {
  @ApiPropertyOptional({ description: 'ID Epic induk (opsional)' })
  @IsOptional()
  @IsUUID('all', { message: 'Format epicId tidak valid.' })
  epicId?: string | null

  @ApiPropertyOptional({ description: 'Judul story' })
  @IsOptional()
  @IsString({ message: 'Judul story harus berupa teks.' })
  @MaxLength(255, { message: 'Judul story maksimal 255 karakter.' })
  title?: string

  @ApiPropertyOptional({ description: 'Kriteria selesai' })
  @IsOptional()
  @IsString({ message: 'Kriteria selesai harus berupa teks.' })
  doneCriteria?: string

  @ApiPropertyOptional({ description: 'Target tanggal' })
  @IsOptional()
  @IsDateString({}, { message: 'Format target tanggal tidak valid.' })
  targetDate?: string

  @ApiPropertyOptional({ description: 'Tag proker' })
  @IsOptional()
  @IsString({ message: 'Tag proker harus berupa teks.' })
  @MaxLength(100, { message: 'Tag proker maksimal 100 karakter.' })
  prokerTag?: string

  @ApiPropertyOptional({ description: 'Tutup atau buka kembali story' })
  @IsOptional()
  @IsBoolean({ message: 'isClosed harus berupa boolean.' })
  isClosed?: boolean
}
