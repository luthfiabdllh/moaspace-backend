import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator'

export class UpdateDivisionDto {
  @ApiPropertyOptional({ description: 'Nama divisi', example: 'Media & Publikasi Kreatif' })
  @IsOptional()
  @IsString({ message: 'Nama divisi harus berupa teks.' })
  @MaxLength(100, { message: 'Nama divisi maksimal 100 karakter.' })
  name?: string

  @ApiPropertyOptional({
    description: 'Slug unik divisi URL-friendly',
    example: 'media-publikasi-kreatif',
  })
  @IsOptional()
  @IsString({ message: 'Slug harus berupa teks.' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug hanya boleh memuat huruf kecil, angka, dan tanda hubung (-).',
  })
  slug?: string

  @ApiPropertyOptional({
    description: 'Status aktifasi persetujuan request pekerjaan untuk divisi ini',
  })
  @IsOptional()
  @IsBoolean({ message: 'requestApprovalEnabled harus berupa boolean.' })
  requestApprovalEnabled?: boolean
}
