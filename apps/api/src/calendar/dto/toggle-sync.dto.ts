import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean } from 'class-validator'

export class ToggleSyncDto {
  @ApiProperty({ description: 'Status aktif/nonaktif sinkronisasi Google Calendar' })
  @IsBoolean()
  enabled!: boolean
}
