import { Module } from '@nestjs/common'
import { DivisionsController } from './divisions.controller.js'
import { DivisionsService } from './divisions.service.js'

import { ActivityLogsModule } from '../activity-logs/activity-logs.module.js'

@Module({
  imports: [ActivityLogsModule],
  controllers: [DivisionsController],
  providers: [DivisionsService],
  exports: [DivisionsService],
})
export class DivisionsModule {}
