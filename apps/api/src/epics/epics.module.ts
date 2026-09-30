import { Module } from '@nestjs/common'
import { EpicsController } from './epics.controller.js'
import { EpicsService } from './epics.service.js'
import { ActivityLogsModule } from '../activity-logs/activity-logs.module.js'

@Module({
  imports: [ActivityLogsModule],
  controllers: [EpicsController],
  providers: [EpicsService],
  exports: [EpicsService],
})
export class EpicsModule {}
