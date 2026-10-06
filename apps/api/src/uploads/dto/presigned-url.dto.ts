import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsNumber, IsString, Max, Min } from 'class-validator';

export class PresignedUrlDto {
  @ApiProperty({
    description: 'Nama asli file gambar yang akan diunggah',
    example: 'screenshot-desain.png',
  })
  @IsString()
  @IsNotEmpty({ message: 'Nama file tidak boleh kosong' })
  filename: string;

  @ApiProperty({
    description: 'MIME Type dari gambar (hanya JPG, PNG, WebP, GIF)',
    example: 'image/png',
    enum: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  })
  @IsString()
  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'image/gif'], {
    message: 'Format file tidak didukung. Gunakan JPG, PNG, WebP, atau GIF.',
  })
  contentType: string;

  @ApiProperty({
    description: 'Ukuran file dalam bytes (maksimal 5 MB / 5.242.880 bytes)',
    example: 1048576,
  })
  @IsNumber()
  @Min(1, { message: 'Ukuran file minimal 1 byte' })
  @Max(5 * 1024 * 1024, { message: 'Ukuran file maksimal adalah 5 MB' })
  size: number;
}
