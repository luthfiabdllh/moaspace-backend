import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsNotEmpty, IsString } from 'class-validator'

export class MoveTaskDto {
  @ApiProperty({
    description: 'Status target di papan Kanban',
    enum: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'],
  })
  @IsNotEmpty({ message: 'Status target wajib diisi.' })
  @IsEnum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'], {
    message: 'Status target tidak valid.',
  })
  status!: 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE'

  @ApiProperty({
    description: 'Posisi baru kartu dalam kolom (fractional index)',
    example: 'a0',
  })
  @IsNotEmpty({ message: 'Posisi kartu wajib diisi.' })
  @IsString({ message: 'Posisi kartu harus berupa teks.' })
  position!: string

  @ApiProperty({
    description: 'Set true untuk override peringatan overcapacity jika pemindahan mengaktifkan beban > 100%',
    required: false,
    default: false,
  })
  override?: boolean
}

