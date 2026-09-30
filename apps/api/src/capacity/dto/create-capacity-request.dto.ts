import { ApiProperty } from '@nestjs/swagger'
import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator'

export class CreateCapacityRequestDto {
  @ApiProperty({
    example: 6,
    description: 'Kapasitas Story Point yang diajukan untuk minggu berjalan (1-30)',
  })
  @IsInt()
  @Min(1, { message: 'Kapasitas SP minimal 1.' })
  @Max(30, { message: 'Kapasitas SP maksimal 30.' })
  requestedSp!: number

  @ApiProperty({
    example: 'Izin sakit 2 hari dan menjadi PJ acara kampus pada hari Kamis',
    description: 'Alasan penyesuaian kapasitas kerja',
  })
  @IsString()
  @IsNotEmpty({ message: 'Alasan pengajuan kapasitas wajib diisi.' })
  @MaxLength(500, { message: 'Alasan maksimal 500 karakter.' })
  note!: string
}
