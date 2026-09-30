import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module.js'
import { ActivityLogsModule } from '../activity-logs/activity-logs.module.js'
import { CapacityService } from './capacity.service.js'
import { CapacityController } from './capacity.controller.js'

@Module({
  imports: [DatabaseModule, ActivityLogsModule],
  controllers: [CapacityController],
  providers: [CapacityService],
  exports: [CapacityService],
})
export class CapacityModule {}
